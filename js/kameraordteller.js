/* Kameraordteller: ta bilde av en lest side med kameraet, tell ordene paa
 * bildet med tekstgjenkjenning (OCR), og betal mynter for dem -- akkurat
 * som "Lese fritt" (js/frilesing.js) gjoer for tale, bare med et kamera i
 * stedet for mikrofonen. Flere bilder etter hverandre (flere sider) legges
 * sammen foer han trykker "Ferdig".
 *
 * Noen bevisste valg, ut over det som ble bedt om:
 *
 * - BILDETAKINGEN laanes fra selve enheten (<input type="file" capture=
 *   "environment">) i stedet for aa bygge en egen kamera-visning med
 *   getUserMedia. Det aapner nettbrettets/telefonens EGET, ferdig
 *   optimaliserte kamera-grensesnitt (fokus, lys, ramme er alt loest
 *   bedre der enn noe vi kunne bygge selv), og vi trenger ikke holde en
 *   kamera-strom aapen eller be om en egen tilgang -- bildet kommer
 *   ferdig tatt tilbake til oss.
 *
 * - "Hold den stille" er loest ved aa MAALE SKARPHETEN PAA SELVE BILDET
 *   etterpaa (maalSkarphet under), ikke ved aa lese av bevegelsessensoren
 *   mens han holder den. En bevegelsessensor kan si "helt stille" akkurat
 *   idet han trykker, men bildet kan uansett bli ufokusert av andre
 *   grunner (for naert, daarlig lys) -- og motsatt, en liten bevegelse
 *   trenger ikke gi et merkbart uskarpt bilde. Aa maale selve resultatet
 *   er et mer direkte og paalitelig maal paa akkurat det som faktisk
 *   spiller noen rolle: ble bildet klart nok til aa lese. Det krever
 *   heller ingen egen tillatelse (DeviceMotion paa iOS maa spoerres om
 *   hver for seg, kameraet er sin egen tillatelse).
 *
 * - Selve tekstgjenkjenningen er Tesseract.js -- gratis, kjoerer helt i
 *   nettleseren (ingen sky-tjeneste, ingen kostnad per bilde), samme
 *   prinsipp som Whisper-motoren i js/lyttemotor-whisper.js. Lastes ikke
 *   inn foer han faktisk aapner denne skjermen foerste gang.
 *
 * OCR paa et bilde av en bok er grunnleggende mer usikkert enn tale-
 * gjenkjenning: skrift, lys, vinkel og sideform (en bok er ikke flat)
 * spiller alle inn. Dette er derfor eksperimentelt paa samme maate som
 * Whisper-motoren var det -- ordtallet blir en fornuftig, men ikke
 * perfekt, telling. Skarphetsgrensa under er en fornuftig startgjetning,
 * ikke kalibrert mot ekte bilder (ingen ekte kamera i verktoeyet dette ble
 * bygget med), og trenger trolig justering etter aa ha proevd den paa
 * ekte enhet.
 */
(function (global) {
  "use strict";

  var $ = function (v) { return document.querySelector(v); };

  var CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
  var SPRAK = "nor";

  // Bildet skaleres ned foer det sendes til gjenkjenneren -- et moderne
  // kamera tar bilder langt stoerre enn OCR trenger for aa lese tydelig
  // tekst, og ekstra piksler bare gjoer det tregere aa behandle.
  var MAKS_BREDDE = 1600;

  // Sjaneterskel -- se maalSkarphet() under for hva tallet faktisk maaler.
  var SKARPHET_GRENSE = 18;

  var lastingBibliotek = null;
  var totalOrd = 0;
  var behandler = false; // sant mens et bilde analyseres, hindrer dobbel-trykk

  function lastTesseract() {
    if (lastingBibliotek) return lastingBibliotek;
    lastingBibliotek = new Promise(function (ok, feil) {
      if (global.Tesseract) { ok(global.Tesseract); return; }
      var s = document.createElement("script");
      s.src = CDN;
      s.onload = function () { ok(global.Tesseract); };
      s.onerror = function () { feil(new Error("Fikk ikke lastet tekstgjenkjenningen.")); };
      document.head.appendChild(s);
    });
    return lastingBibliotek;
  }

  function beskjed(t, feil) {
    $("#kameraBeskjed").textContent = t || "";
    $("#kameraBeskjed").classList.toggle("feil", !!feil);
  }

  // Skalerer bildet ned til MAKS_BREDDE og tegner det paa en (usynlig)
  // canvas -- brukes baade til skarphetssjekken og selve gjenkjenningen,
  // saa vi bare gjoer denne jobben én gang per bilde.
  function tilCanvas(bilde) {
    var skala = Math.min(1, MAKS_BREDDE / bilde.width);
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bilde.width * skala));
    c.height = Math.max(1, Math.round(bilde.height * skala));
    c.getContext("2d").drawImage(bilde, 0, 0, c.width, c.height);
    return c;
  }

  // Hvor "skarpt" bildet er: gjennomsnittlig kant-styrke mellom hver piksel
  // og naboene sine (et enkelt Laplace-lignende filter, regnet ut for
  // haand i stedet for via et helt bildebehandlingsbibliotek). Et uskarpt
  // bilde har jevne overganger over alt (lav verdi); ekte, fokusert tekst
  // har mange bratte, tydelige kanter (hoey verdi).
  function maalSkarphet(canvas) {
    var ctx = canvas.getContext("2d");
    var bredde = canvas.width, hoyde = canvas.height;
    var data = ctx.getImageData(0, 0, bredde, hoyde).data;

    var graatoner = new Float32Array(bredde * hoyde);
    for (var i = 0; i < bredde * hoyde; i++) {
      var p = i * 4;
      graatoner[i] = data[p] * .299 + data[p + 1] * .587 + data[p + 2] * .114;
    }

    var sum = 0, sumKvadrat = 0, n = 0;
    for (var y = 1; y < hoyde - 1; y++) {
      for (var x = 1; x < bredde - 1; x++) {
        var idx = y * bredde + x;
        var lap = graatoner[idx] * 4 -
          graatoner[idx - 1] - graatoner[idx + 1] -
          graatoner[idx - bredde] - graatoner[idx + bredde];
        sum += lap;
        sumKvadrat += lap * lap;
        n++;
      }
    }
    var snitt = sum / n;
    return Math.sqrt(Math.max(0, sumKvadrat / n - snitt * snitt));
  }

  function behandleBilde(file) {
    if (behandler) return;
    behandler = true;
    beskjed("Sjekker bildet …");

    var url = URL.createObjectURL(file);
    var bilde = new Image();

    bilde.onload = function () {
      URL.revokeObjectURL(url);
      var canvas = tilCanvas(bilde);
      var skarphet = maalSkarphet(canvas);

      if (skarphet < SKARPHET_GRENSE) {
        behandler = false;
        beskjed("Bildet ble litt uskarpt. Hold nettbrettet stille et lite " +
                "øyeblikk, og ta det på nytt.", true);
        return;
      }

      beskjed("Laster ned lesemotoren for bilder … (skjer bare første gang)");
      lastTesseract().then(function (Tesseract) {
        beskjed("Leser ordene i bildet …");
        return Tesseract.recognize(canvas, SPRAK);
      }).then(function (resultat) {
        var tekst = (resultat && resultat.data && resultat.data.text) || "";
        var ord = tekst.trim().split(/\s+/).filter(Boolean).length;
        totalOrd += ord;
        behandler = false;
        beskjed(ord
          ? "Fant " + ord + " ord i dette bildet. " + totalOrd + " ord totalt så langt."
          : "Fant ingen ord i dette bildet -- prøv å ta det litt nærmere, eller med bedre lys.");
      }).catch(function (e) {
        behandler = false;
        beskjed("Klarte ikke å lese bildet: " + ((e && e.message) || e), true);
      });
    };

    bilde.onerror = function () {
      URL.revokeObjectURL(url);
      behandler = false;
      beskjed("Klarte ikke å åpne bildet.", true);
    };

    bilde.src = url;
  }

  function start() {
    totalOrd = 0;
    behandler = false;
    beskjed("");
    $("#kameraFoer").hidden = false;
    $("#kameraEtter").hidden = true;
    $("#kameraInput").value = "";
  }

  // Ingen kamera-strom eller mikrofon holdes aapen her (se toppkommentaren
  // -- selve bildetakingen laanes av enhetens eget kamera-grensesnitt), saa
  // det er ingenting maskinvare-messig aa stenge. Nullstiller bare sperren
  // mot dobbel-behandling, i tilfelle han navigerer bort midt i en analyse.
  function stopp() {
    behandler = false;
  }

  $("#kameraTaBilde").onclick = function () { $("#kameraInput").click(); };

  $("#kameraInput").onchange = function () {
    var file = this.files[0];
    this.value = ""; // saa samme bilde kan velges paa nytt om han vil
    if (file) behandleBilde(file);
  };

  $("#kameraFerdig").onclick = function () {
    var r = Spill.betalFriLesing(totalOrd);

    $("#kameraFoer").hidden = true;
    $("#kameraEtter").hidden = false;
    $("#kameraTall").textContent =
      totalOrd + (totalOrd === 1 ? " ord lest" : " ord lest") + " · +" + r.mynter + " mynter";
    $("#kameraEkstra").textContent = r.nyeBoker
      ? "Du fylte en hel bok — du er level " + r.level + " nå!"
      : (r.tilNesteBok && r.tilNesteBok.mangler
          ? r.tilNesteBok.mangler + " ord igjen til bok nummer " + r.tilNesteBok.nr + "."
          : "");
  };

  global.KameraOrdteller = {
    start: start,
    stopp: stopp,
    // Til proeving i konsollen, uten et ekte kamera -- se maalSkarphet()
    // over, som ellers ikke kan testes uten et ekte, tatt bilde.
    _maalSkarphet: maalSkarphet
  };
})(window);
