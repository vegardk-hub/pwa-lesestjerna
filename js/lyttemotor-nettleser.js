/* Lyttemotor: nettleserens egen (Web Speech API).
 *
 * Standardmotoren, og i dag den eneste -- flyttet ut av stemme.js til sin
 * egen fil slik at den folger nøyaktig samme "motor"-kontrakt som andre
 * lyttemotorer kan følge senere (se Stemme.lyttemotorer.registrer nederst
 * her, og gjeldendeMotor() i stemme.js). Kontrakten er enkel: et objekt med
 * id, navn, stoettes, start(hooks) og stopp(), der hooks er
 * { resultat(kandidater, endelig), feil(kode, forklaring), tilstand(paa) }.
 *
 * Selve gjenkjenningen skjer IKKE på enheten -- lyden sendes til en
 * skytjeneste (Googles servere i Chrome) for tolkning, og det er akkurat
 * den rundturen som gir forsinkelsen fra "han sier ordet" til "det lyser
 * grønt". Det er ikke noe denne fila kan gjøre noe med -- bare noe en helt
 * annen motor (kjørt på selve enheten) kan unngå.
 */
(function (global) {
  "use strict";

  var Gjenkjenner = global.SpeechRecognition || global.webkitSpeechRecognition;

  var FORKLARING = {
    "not-allowed": "Mikrofonen er sperret. Trykk på hengelåsen i adresselinjen og slipp den inn.",
    "audio-capture": "Finner ingen mikrofon.",
    "network": "Lyttingen trenger nett, og nettet svarte ikke.",
    "language-not-supported": "Denne nettleseren kan ikke norsk. Prøv Edge.",
    "service-not-allowed": "Nettleseren ville ikke bruke taletjenesten."
  };

  var gj = null; // den aktive gjenkjenneren -- null naar vi ikke lytter
  var friskPuls = null; // proaktiv friskmelding, se start()

  function start(hooks) {
    var g = new Gjenkjenner();
    g.lang = "nb-NO";
    g.continuous = true;
    g.interimResults = true;
    // Gjenkjenneren kan foreslaa flere tolkninger av det samme lydklippet,
    // rangert etter hvor sikker den er. Foer spurte vi bare om den beste,
    // men paa en barnestemme er den riktige teksten titt og ofte nummer to
    // eller tre paa lista i stedet for nummer en. Aa spoerre om flere
    // koster ingenting og gir matchingen flere sjanser aa treffe med.
    g.maxAlternatives = 5;

    var sistHoert = Date.now();

    g.onresult = function (e) {
      sistHoert = Date.now();
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var r = e.results[i];
        var kandidater = [];
        for (var k = 0; k < r.length; k++) {
          var t = r[k].transcript.trim();
          // Gjenkjenneren sender av og til et tomt endelig resultat naar den
          // runder av. Slippes det gjennom, nulles framgangen paa slutten av
          // hver eneste setning.
          if (t) kandidater.push(t);
        }
        if (kandidater.length) hooks.resultat(kandidater, r.isFinal);
      }
    };

    g.onerror = function (e) {
      // "no-speech" og "aborted" er hverdagslige: den ga seg fordi det var
      // stille, eller fordi vi stoppet den selv. Ingen grunn til aa uroe.
      if (e.error === "no-speech" || e.error === "aborted") return;
      hooks.feil(e.error, FORKLARING[e.error] || e.error);
      // Disse to gir den seg aldri selv fra -- vi maa si ifra at vi har
      // sluttet aa proeve, ellers ville stemme.js sin "vil" staa fast paa
      // true for alltid.
      if (e.error === "not-allowed" || e.error === "language-not-supported") {
        hooks.tilstand(false);
      }
    };

    g.onend = function () {
      // Kommer stadig vekk av seg selv -- nettleseren stopper den med jevne
      // mellomrom paa egen haand. Start den paa nytt saa lenge det fortsatt
      // er DENNE gjenkjenneren som er den aktive (stopp() nuller gj foerst,
      // saa en sen onend fra en gjenkjenner vi selv har forlatt gjoer da
      // ingenting), og Finn ikke er i ferd med aa lese noe hoeyt.
      if (gj === g && !global.Stemme.snakker()) {
        try { g.start(); } catch (err) { /* allerede i gang */ }
      }
    };

    gj = g;
    try { g.start(); } catch (err) { /* allerede i gang */ }

    // Nettleseren (saerlig Safari/iPad) stopper gjenkjenneren av seg selv
    // etter bare noen faa sekunders stillhet ("no-speech"). Staar han og
    // tenker paa et vanskelig ord og sier det akkurat idet den timer ut, faller
    // selve forsoket midt i overgangen mellom den gamle og den nye oekten --
    // og blir aldri hoert, uansett hvor tydelig han sier det. Ved aa friske
    // den opp selv, litt foer den naturlige grensa, staar den alltid klar og
    // fullt vaaken naar han endelig sier ordet.
    friskPuls = setInterval(function () {
      if (gj !== g) { clearInterval(friskPuls); return; }
      if (!global.Stemme.snakker() && Date.now() - sistHoert > 3000) {
        sistHoert = Date.now();
        try { g.abort(); } catch (err) { /* alt stoppet */ }
      }
    }, 500);
  }

  function stopp() {
    var g = gj;
    gj = null;
    if (friskPuls) { clearInterval(friskPuls); friskPuls = null; }
    if (g) {
      g.onend = null;
      g.onresult = null;
      try { g.abort(); } catch (err) { /* alt stoppet */ }
    }
  }

  global.Stemme.lyttemotorer.registrer({
    id: "nettleser",
    navn: "Nettleserens egen",
    stoettes: !!Gjenkjenner,
    start: start,
    stopp: stopp
  });
})(window);
