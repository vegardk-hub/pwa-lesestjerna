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

  // Nettleseren (saerlig Safari/iPad) stopper gjenkjenneren av seg selv etter
  // faa sekunders stillhet ("no-speech"). Staar han og tenker paa et
  // vanskelig ord og sier det akkurat idet den timer ut, havner selve
  // forsoket midt i overgangen mellom den gamle og den nye oekten -- og blir
  // aldri hoert, uansett hvor tydelig han sier det.
  //
  // Foerste forsoek paa aa fikse dette (v52) proevde aa gjenbruke SAMME
  // gjenkjenner-objekt: kalle abort() paa den, og la dens egen onend starte
  // den paa nytt. Det var ikke til aa stole paa -- iOS Safari fyrer ikke
  // alltid av "end" etter abort(), saa restarten kunne utebli helt. Naa
  // lages det i stedet et HELT NYTT gjenkjenner-objekt hver gang, uavhengig
  // av om den gamle faktisk rekker aa avslutte seg selv foerst -- vi venter
  // ikke paa noe fra den gamle, bare bytter den ut.
  //
  // v53 hadde en alvorlig feil her: den proaktive friskningen (under) fornyet
  // "sistHoert" hver gang den friska opp, saa er han stille lenge -- ser paa
  // et bilde, tenker, har appen liggende aapen -- ble en HELT NY gjenkjenner
  // laget hvert 2,5 sekund, i det uendelige, saa lenge stillheten varte. Over
  // tid tapper det etter alt aa dømme en eller annen ressurs (lyd-oekten?)
  // paa iOS, og gjenkjenningen sluttet aa virke helt. Na skjer den proaktive
  // friskningen bare ÉN gang per stillhetsperiode -- se "frisknet" paa
  // oekten under, som bare nullstilles naar han faktisk blir hoert igjen.
  var STILLE_GRENSE = 2500;

  var oekt = null;      // { g, sistHoert, puls } -- null naar vi ikke lytter
  var aktivHooks = null;

  function lagGjenkjenner() {
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

    g.onresult = function (e) {
      if (oekt && oekt.g === g) {
        oekt.sistHoert = Date.now();
        // Han er hoert igjen -- naeste gang det blir stille en stund
        // fortjener en ny sjanse til én proaktiv friskning, se STILLE_GRENSE.
        oekt.frisknet = false;
      }
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
        if (kandidater.length) aktivHooks.resultat(kandidater, r.isFinal);
      }
    };

    g.onerror = function (e) {
      // "no-speech" og "aborted" er hverdagslige: den ga seg fordi det var
      // stille, eller fordi vi stoppet den selv (eller byttet den ut, se
      // friskn() under). Ingen grunn til aa uroe.
      if (e.error === "no-speech" || e.error === "aborted") return;
      aktivHooks.feil(e.error, FORKLARING[e.error] || e.error);
      // Disse to gir den seg aldri selv fra -- vi maa si ifra at vi har
      // sluttet aa proeve, ellers ville stemme.js sin "vil" staa fast paa
      // true for alltid.
      if (e.error === "not-allowed" || e.error === "language-not-supported") {
        stopp();
        aktivHooks.tilstand(false);
      }
    };

    g.onend = function () {
      // Kommer stadig vekk av seg selv -- nettleseren stopper den med jevne
      // mellomrom paa egen haand. Friskn opp saa lenge det fortsatt er DENNE
      // gjenkjenneren som er den aktive (en sen onend fra en vi selv alt har
      // byttet ut skal ikke gjenopplive noe), og Finn ikke er i ferd med aa
      // lese noe hoeyt.
      if (oekt && oekt.g === g && !global.Stemme.snakker()) friskn();
    };

    return g;
  }

  // Bytter ut den aktive gjenkjenneren med en helt ny. Brukes baade naar
  // nettleseren selv gir den opp (onend over) og proaktivt naar det har
  // vaert stille en liten stund (pulsen i start() under) -- se forklaringen
  // paa STILLE_GRENSE over for hvorfor.
  function friskn() {
    if (!oekt) return;
    var gammel = oekt.g;
    gammel.onend = null;
    gammel.onresult = null;
    gammel.onerror = null;
    try { gammel.abort(); } catch (e) { /* alt stoppet */ }

    var g = lagGjenkjenner();
    oekt.g = g;
    oekt.sistHoert = Date.now();
    try { g.start(); } catch (e) { /* alt i gang */ }
  }

  function start(hooks) {
    stopp();
    aktivHooks = hooks;
    var g = lagGjenkjenner();
    // frisknet: har den proaktive friskningen alt brukt sjansen sin for
    // DENNE stillhetsperioden? Uten denne ville en lang pause (han ser paa
    // et bilde, tenker, har bare appen liggende aapen) faatt en helt ny
    // gjenkjenner hvert 2,5 sekund i det uendelige -- se forklaringen over.
    oekt = { g: g, sistHoert: Date.now(), puls: null, frisknet: false };
    try { g.start(); } catch (e) { /* alt i gang */ }

    oekt.puls = setInterval(function () {
      if (!oekt || oekt.frisknet || global.Stemme.snakker()) return;
      if (Date.now() - oekt.sistHoert > STILLE_GRENSE) {
        oekt.frisknet = true;
        friskn();
      }
    }, 400);
  }

  function stopp() {
    if (!oekt) return;
    var o = oekt;
    oekt = null;
    clearInterval(o.puls);
    o.g.onend = null;
    o.g.onresult = null;
    o.g.onerror = null;
    try { o.g.abort(); } catch (e) { /* alt stoppet */ }
  }

  global.Stemme.lyttemotorer.registrer({
    id: "nettleser",
    navn: "Nettleserens egen",
    stoettes: !!Gjenkjenner,
    start: start,
    stopp: stopp
  });
})(window);
