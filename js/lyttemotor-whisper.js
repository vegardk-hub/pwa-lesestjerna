/* Lyttemotor: lokal, på selve enheten (eksperimentell).
 *
 * Motsatt av js/lyttemotor-nettleser.js -- her sendes ingen lyd noe sted.
 * Talegjenkjenningen (en Whisper-modell, trent ekstra på norsk av
 * Nasjonalbiblioteket -- "nb-whisper") kjører helt i nettleseren, via
 * WebAssembly/WebGPU (biblioteket Transformers.js). Modellen (titalls MB)
 * lastes ned fra et CDN første gang den brukes, og ligger igjen i
 * nettleserens hurtiglager etterpå -- andre gang er den der med det samme,
 * helt uten nett.
 *
 * Modellen er ikke bygget for å lytte løpende slik nettlesermotoren gjør.
 * Løsningen her er å lytte etter STILLHET: så lenge det er lyd, tas det opp;
 * blir det stille i et lite øyeblikk (PAUSE_MS), regnes frasen som ferdig,
 * og akkurat den biten sendes til modellen for tolkning -- mens opptaket
 * for neste frase already er i gang. Alle resultater telles derfor som
 * endelige (aldri "midlertidige" -- modellen egner seg ikke til å gjette seg
 * fram underveis slik nettlesermotoren kan).
 *
 * Eksperimentell: ingen ekte mikrofon kunne prøves i verktøyet dette ble
 * bygget med -- se hooks.status() for framdrift, og prøv den for ordentlig
 * i Foreldrekontroll.
 */
(function (global) {
  "use strict";

  var MODELL = "Xenova/nb-whisper-tiny-beta"; // Whisper "tiny", norsktrent, ferdig konvertert for nettleser
  // NB: staar fast paa 3.7.6 med vilje -- 4.x har en kjent feil der akkurat
  // denne (og flere andre) kvantiserte modeller ikke lar seg laste i det
  // hele tatt ("Missing required scale ... DequantizeLinear", en ONNX
  // Runtime-regresjon i biblioteket sin 4.x-serie). Proev en nyere versjon
  // igjen om det dukker opp en fiks, men ikke uten aa teste at lastingen
  // faktisk fortsatt fungerer foerst.
  var CDN = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6";

  var MIN_TERSKEL = 0.008;     // aldri mer folsom enn dette, selv i et helt stille rom
  var KALIBRERING_MS = 600;    // saa lenge lyttes det paa bakgrunnsstoyen foer vi starter
  var PAUSE_MS = 700;          // saa lenge stillhet foer en frase regnes ferdig
  var MAKS_OPPTAK_MS = 12000;  // sikkerhetsnett -- ingen frase tas opp evig

  var stoettes = !!(global.WebAssembly && global.MediaRecorder &&
    global.navigator && global.navigator.mediaDevices && global.navigator.mediaDevices.getUserMedia);

  var lastingBibliotek = null; // Promise<modul> -- selve Transformers.js
  var lastingTranskriber = null; // Promise<funksjon> -- ferdig lastet modell
  var aktivOekt = null; // { avbrutt, stream, ctx, recorder, puls } -- null naar vi ikke lytter

  function lastBibliotek() {
    if (!lastingBibliotek) lastingBibliotek = import(CDN);
    return lastingBibliotek;
  }

  // Lastes bare én gang -- laasen (lastingTranskriber) overlever ogsaa en
  // stopp()/start() etterpaa, saa modellen ikke maa hentes paa nytt for
  // hver eneste oekt.
  function lastTranskriber(hooks) {
    if (lastingTranskriber) return lastingTranskriber;
    hooks.status("Laster ned lyttemotoren … dette skjer bare første gang, og kan ta litt tid.");
    lastingTranskriber = lastBibliotek()
      .then(function (mod) { return mod.pipeline("automatic-speech-recognition", MODELL); })
      .then(function (transkriber) {
        hooks.status("");
        return transkriber;
      });
    lastingTranskriber.catch(function () {
      lastingTranskriber = null; // proev aa laste paa nytt neste gang, ikke heng fast i en feilet oekt
    });
    return lastingTranskriber;
  }

  // Enkel maaling av lydstyrke akkurat naa (0..~1), til aa avgjoere om han
  // snakker eller om det er stille -- ikke ekte stemmegjenkjenning, bare
  // "er det lyd her".
  function lydstyrke(analyser, buffer) {
    analyser.getByteTimeDomainData(buffer);
    var sum = 0;
    for (var i = 0; i < buffer.length; i++) {
      var v = (buffer[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / buffer.length);
  }

  function start(hooks) {
    stopp(); // rydd opp om noe uventet skulle henge igjen fra foer
    var oekt = { avbrutt: false };
    aktivOekt = oekt;

    lastTranskriber(hooks).then(function (transkriber) {
      if (oekt.avbrutt) return null;
      return global.navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        if (oekt.avbrutt) {
          stream.getTracks().forEach(function (t) { t.stop(); });
          return;
        }
        settOppLytting(oekt, stream, transkriber, hooks);
      });
    }).catch(function (e) {
      if (oekt.avbrutt) return;
      var navn = (e && e.name) || "";
      if (navn === "NotAllowedError" || navn === "SecurityError") {
        hooks.feil("not-allowed", "Mikrofonen er sperret. Trykk på hengelåsen i adresselinjen og slipp den inn.");
      } else {
        hooks.feil("whisper-feil", "Klarte ikke å starte den lokale lyttemotoren: " +
          (navn || (e && e.message) || String(e)));
      }
      hooks.tilstand(false);
    });
  }

  function settOppLytting(oekt, stream, transkriber, hooks) {
    var AudioCtx = global.AudioContext || global.webkitAudioContext;
    var ctx = new AudioCtx();
    var kilde = ctx.createMediaStreamSource(stream);
    var analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    kilde.connect(analyser);
    var buffer = new Uint8Array(analyser.fftSize);

    var mimeType = ["audio/webm", "audio/ogg", "audio/mp4"].find(function (t) {
      return global.MediaRecorder.isTypeSupported && global.MediaRecorder.isTypeSupported(t);
    });
    var recorder = new global.MediaRecorder(stream, mimeType ? { mimeType: mimeType } : undefined);
    var biter = [];
    var koe = Promise.resolve(); // transkriberer én frase av gangen, i rekkefoelge

    recorder.ondataavailable = function (e) { if (e.data.size > 0) biter.push(e.data); };
    recorder.onstop = function () {
      var blob = new Blob(biter, { type: recorder.mimeType });
      biter = [];
      // For kort til aa vaere et ord -- stoey eller en glipp i maalingen.
      if (blob.size < 500 || oekt.avbrutt) return;
      koe = koe.then(function () { return transkriberBit(blob, transkriber, hooks); });
    };

    // Mange nettlesere (spesielt Safari/iPad) starter en ny AudioContext i
    // "suspendert" tilstand -- uten aa vekke den her ville analyser-noden
    // aldri faatt levende lyddata, og lydstyrke() ville alltid gitt null
    // uansett hvor hoeyt han snakket. Dette var aarsaken til at INGENTING
    // ble oppfattet foerste gang denne motoren ble proevd.
    ctx.resume().then(function () {
      if (oekt.avbrutt) return;
      startVadLoop(oekt, analyser, buffer, recorder, hooks);
    });

    oekt.stream = stream;
    oekt.ctx = ctx;
    oekt.recorder = recorder;
  }

  // Lytter paa bakgrunnsstoeyen et lite oeyeblikk foerst, og setter terskelen
  // for "han snakker" godt over den -- se MIN_TERSKEL. En fast, gjettet
  // terskel ville enten vaert altfor doev (stille rom) eller altfor
  // folsom (stoeyende rom), og det er ingen maate aa vite hvilket paa
  // forhaand.
  function startVadLoop(oekt, analyser, buffer, recorder, hooks) {
    hooks.status("Lytter etter stemmen din …");
    var maalinger = [];
    var kalStart = Date.now();
    var kalPuls = setInterval(function () {
      if (oekt.avbrutt) { clearInterval(kalPuls); return; }
      maalinger.push(lydstyrke(analyser, buffer));
      if (Date.now() - kalStart < KALIBRERING_MS) return;
      clearInterval(kalPuls);

      var snitt = maalinger.reduce(function (a, b) { return a + b; }, 0) / maalinger.length;
      var terskel = Math.max(MIN_TERSKEL, snitt * 2.5 + 0.004);
      hooks.status("");

      var tilstand = "stille";
      var sisteLyd = 0;
      var startTid = 0;

      var puls = setInterval(function () {
        if (oekt.avbrutt) return;
        var v = lydstyrke(analyser, buffer);
        var naa = Date.now();
        if (v > terskel) {
          sisteLyd = naa;
          if (tilstand === "stille") {
            tilstand = "snakker";
            startTid = naa;
            try { recorder.start(); } catch (e) { /* alt i gang */ }
          } else if (naa - startTid > MAKS_OPPTAK_MS) {
            recorder.stop();
            startTid = naa;
            try { recorder.start(); } catch (e) { /* alt i gang */ }
          }
        } else if (tilstand === "snakker" && naa - sisteLyd > PAUSE_MS) {
          tilstand = "stille";
          recorder.stop();
        }
      }, 150);

      oekt.puls = puls;
    }, 50);

    oekt.kalPuls = kalPuls;
  }

  function transkriberBit(blob, transkriber, hooks) {
    var url = URL.createObjectURL(blob);
    return transkriber(url, { language: "norwegian", task: "transcribe" })
      .then(function (resultat) {
        var tekst = resultat && resultat.text && resultat.text.trim();
        if (tekst) hooks.resultat([tekst], true);
      })
      .catch(function () {
        // Én mislykket bit skal ikke stoppe resten -- bare hopp over den,
        // akkurat som "no-speech" gjoer for nettlesermotoren.
      })
      .then(function () { URL.revokeObjectURL(url); });
  }

  function stopp() {
    if (!aktivOekt) return;
    var oekt = aktivOekt;
    aktivOekt = null;
    oekt.avbrutt = true;
    if (oekt.kalPuls) clearInterval(oekt.kalPuls);
    if (oekt.puls) clearInterval(oekt.puls);
    if (oekt.recorder) {
      oekt.recorder.ondataavailable = null;
      oekt.recorder.onstop = null;
      try { if (oekt.recorder.state !== "inactive") oekt.recorder.stop(); } catch (e) { /* alt stoppet */ }
    }
    if (oekt.ctx) { try { oekt.ctx.close(); } catch (e) { /* alt lukket */ } }
    // Slipper mikrofon-lampa i nettleseren -- uten denne ville den lyse
    // videre selv etter at vi har sluttet aa lytte.
    if (oekt.stream) oekt.stream.getTracks().forEach(function (t) { t.stop(); });
  }

  global.Stemme.lyttemotorer.registrer({
    id: "whisper",
    navn: "Lokal, på enheten (eksperimentell)",
    stoettes: stoettes,
    start: start,
    stopp: stopp
  });
})(window);
