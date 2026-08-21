/* Stemme og oere for Lesestjerna.
 *
 * Samler de to Web Speech-delene paa ett sted, fordi de ikke kan brukes
 * uavhengig av hverandre: staar mikrofonen paa mens Finn leser, hoerer
 * gjenkjenneren paa Finn og tror gutten leste ordene.
 */
(function (global) {
  "use strict";

  var Gjenkjenner = global.SpeechRecognition || global.webkitSpeechRecognition;

  /* ---------- Stemmen ---------- */

  // "Finnish" inneholder bokstavene i "Finn". Spraaket maa sjekkes foerst,
  // ellers plukkes en finsk stemme paa navnet alene.
  function norske() {
    return speechSynthesis.getVoices().filter(function (v) {
      return /^n[bno]/i.test(v.lang);
    });
  }

  function valgtStemme() {
    var n = norske();
    return n.find(function (v) { return /\bfinn\b/i.test(v.name); }) ||
           n.find(function (v) { return !v.localService; }) ||
           n[0] || null;
  }

  var snakker = false;

  /* Leser teksten hoegt. Doever mikrofonen saa lenge det varer, og skrur den
   * paa igjen etterpaa hvis den var paa. */
  function si(tekst, fart) {
    var stemme = valgtStemme();
    if (!stemme) return Promise.reject(new Error("ingen norsk stemme"));

    var lyttetFoer = lytter.vil;
    if (lyttetFoer) lytter.stopp();
    speechSynthesis.cancel();
    snakker = true;

    return new Promise(function (ferdig) {
      var y = new SpeechSynthesisUtterance(tekst);
      y.voice = stemme;
      y.lang = stemme.lang;
      y.rate = fart || 0.92;

      var avsluttet = false;
      function slutt() {
        if (avsluttet) return;
        avsluttet = true;
        snakker = false;
        // Litt luft foer mikrofonen paa igjen, saa halen av Finn ikke fanges.
        setTimeout(function () {
          if (lyttetFoer) lytter.start();
          ferdig();
        }, 250);
      }
      y.onend = slutt;
      y.onerror = slutt;
      speechSynthesis.speak(y);
    });
  }

  function stille() {
    speechSynthesis.cancel();
    snakker = false;
  }

  /* ---------- Oeret ---------- */

  var lytter = {
    vil: false,          // vil vi lytte? gjenkjenneren stopper av seg selv titt og ofte
    gj: null,
    paaResultat: null,   // (tekst, endelig)
    paaFeil: null,       // (kode, forklaring)
    paaTilstand: null,   // (lytter?)

    stoettes: !!Gjenkjenner,

    start: function () {
      if (!Gjenkjenner || this.vil || snakker) return;
      var meg = this;
      var gj = new Gjenkjenner();
      gj.lang = "nb-NO";
      gj.continuous = true;
      gj.interimResults = true;

      gj.onresult = function (e) {
        for (var i = e.resultIndex; i < e.results.length; i++) {
          var r = e.results[i];
          var t = r[0].transcript.trim();
          // Gjenkjenneren sender av og til et tomt endelig resultat naar den
          // runder av. Slippes det gjennom, nulles framgangen paa slutten av
          // hver eneste setning.
          if (!t) continue;
          if (meg.paaResultat) meg.paaResultat(t, r.isFinal);
        }
      };

      gj.onerror = function (e) {
        // "no-speech" og "aborted" er hverdagslige: den ga seg fordi det var
        // stille, eller fordi vi stoppet den selv. Ingen grunn til aa uroe.
        if (e.error === "no-speech" || e.error === "aborted") return;
        if (meg.paaFeil) meg.paaFeil(e.error, FORKLARING[e.error] || e.error);
        if (e.error === "not-allowed" || e.error === "language-not-supported") {
          meg.vil = false;
          meg.melde();
        }
      };

      gj.onend = function () {
        // Kommer stadig vekk av seg selv. Start paa nytt saa lenge vi vil lytte.
        if (meg.vil && !snakker) {
          try { gj.start(); } catch (e) { /* allerede i gang */ }
        } else {
          meg.melde();
        }
      };

      this.gj = gj;
      this.vil = true;
      try { gj.start(); } catch (e) { /* allerede i gang */ }
      this.melde();
    },

    stopp: function () {
      this.vil = false;
      if (this.gj) {
        var gj = this.gj;
        this.gj = null;
        gj.onend = null;
        gj.onresult = null;
        try { gj.abort(); } catch (e) { /* alt stoppet */ }
      }
      this.melde();
    },

    melde: function () {
      if (this.paaTilstand) this.paaTilstand(this.vil);
    }
  };

  var FORKLARING = {
    "not-allowed": "Mikrofonen er sperret. Trykk på hengelåsen i adresselinjen og slipp den inn.",
    "audio-capture": "Finner ingen mikrofon.",
    "network": "Lyttingen trenger nett, og nettet svarte ikke.",
    "language-not-supported": "Denne nettleseren kan ikke norsk. Prøv Edge.",
    "service-not-allowed": "Nettleseren ville ikke bruke taletjenesten."
  };

  global.Stemme = {
    norske: norske,
    valgtStemme: valgtStemme,
    si: si,
    stille: stille,
    snakker: function () { return snakker; },
    lytter: lytter,
    erEdge: /\bEdg\//.test(navigator.userAgent)
  };
})(window);
