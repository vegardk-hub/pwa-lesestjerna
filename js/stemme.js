/* Stemme og oere for Lesestjerna.
 *
 * Samler talen og lyttingen paa ett sted, fordi de ikke kan brukes
 * uavhengig av hverandre: staar mikrofonen paa mens Finn leser, hoerer
 * gjenkjenneren paa Finn og tror gutten leste ordene.
 *
 * Lyttingen (Oeret, nederst) er ikke lenger bare Web Speech API -- den er et
 * tynt lag ("lytter" under) oppaa hvilken som helst registrert lyttemotor
 * (js/lyttemotor-*.js), valgt i Foreldrekontroll og lagret i Lagring. Resten
 * av appen (lesing.js) kjenner bare "lytter" sitt grensesnitt
 * (start/stopp/paaResultat/paaFeil/paaTilstand/stoettes/vil) og bryr seg
 * aldri om hvilken motor som faktisk hoerer etter.
 */
(function (global) {
  "use strict";

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

  // Registeret over lyttemotorer. Hver motor (js/lyttemotor-*.js) melder seg
  // paa her ved oppstart -- "nettleser" (Web Speech API) er standard og i
  // dag den eneste, men flere kan komme senere. Rekkefoelgen de melder seg
  // paa i (motorRekkefolge) er ogsaa rekkefoelgen de vises i, i
  // Foreldrekontroll.
  var motorer = {};
  var motorRekkefolge = [];

  function registrerMotor(m) {
    motorer[m.id] = m;
    motorRekkefolge.push(m.id);
  }

  // Den lagrede id-en (se Lagring.lyttemotor) hvis den peker paa en motor
  // som faktisk finnes, ellers den foerste registrerte -- aldri en id som
  // ikke finnes, selv om lagringen skulle peke paa en motor som ble fjernet.
  function gjeldendeMotorId() {
    var valgt = global.Lagring && Lagring.lyttemotor();
    return (valgt && motorer[valgt]) ? valgt : motorRekkefolge[0];
  }

  function gjeldendeMotor() {
    return motorer[gjeldendeMotorId()] || { stoettes: false, start: function () {}, stopp: function () {} };
  }

  // "lytter" er selve grensesnittet resten av appen (lesing.js) snakker med
  // -- akkurat de samme feltene som foer motorene fantes. Den vet ingenting
  // om HVORDAN en motor hoerer etter, bare at den kan start()es, stopp()es,
  // og at den melder fra via de tre hookene under.
  var lytter = {
    vil: false,          // vil vi lytte? motoren stopper ofte av seg selv
    paaResultat: null,   // (kandidater, endelig) -- kandidater er en liste med tolkninger
    paaFeil: null,       // (kode, forklaring)
    paaTilstand: null,   // (lytter?)
    // Valgfri, korte framdriftsmeldinger som ikke er feil -- i dag bare
    // brukt av motorer som maa laste ned noe foer de kan starte (t.d.
    // js/lyttemotor-whisper.js sin "Laster ned lyttemotoren ..."). Motorer
    // som ikke trenger det (som nettleseren) kaller den aldri.
    paaStatus: null,     // (tekst)

    // "tekst" er valgfri -- den faktiske teksten han skal lese, raa (ikke
    // delt i ord). De fleste motorer bryr seg ikke om den (de gjenkjenner
    // hva som helst), men en motor som vurderer opp mot en fasit (t.d.
    // js/lyttemotor-azure.js) trenger aa vite den paa forhaand.
    start: function (tekst) {
      if (!gjeldendeMotor().stoettes || this.vil || snakker) return;
      var meg = this;
      this.vil = true;
      gjeldendeMotor().start({
        resultat: function (kandidater, endelig) { if (meg.paaResultat) meg.paaResultat(kandidater, endelig); },
        feil: function (kode, forklaring) { if (meg.paaFeil) meg.paaFeil(kode, forklaring); },
        status: function (melding) { if (meg.paaStatus) meg.paaStatus(melding); },
        // Motoren sier ifra her naar den har gitt opp for godt paa egen
        // haand (t.d. mikrofonen ble sperret) -- da maa "vil" ned med den,
        // ellers ville knappen staatt fast paa "lytter" for alltid.
        tilstand: function (paa) { if (!paa) { meg.vil = false; meg.melde(); } }
      }, tekst);
      this.melde();
    },

    stopp: function () {
      this.vil = false;
      gjeldendeMotor().stopp();
      this.melde();
    },

    melde: function () {
      if (this.paaTilstand) this.paaTilstand(this.vil);
    }
  };
  // Egen getter, ikke et vanlig felt -- "stoettes" maa alltid svare for den
  // motoren som er valgt NAA, ikke den som var valgt da lytter ble bygget.
  Object.defineProperty(lytter, "stoettes", { get: function () { return gjeldendeMotor().stoettes; } });

  global.Stemme = {
    norske: norske,
    valgtStemme: valgtStemme,
    si: si,
    stille: stille,
    snakker: function () { return snakker; },
    lytter: lytter,
    erEdge: /\bEdg\//.test(navigator.userAgent),

    // Til js/lyttemotor-*.js (registrer) og Foreldrekontroll (resten) --
    // se forklaringen paa "motorer" over.
    lyttemotorer: {
      registrer: registrerMotor,
      alle: function () { return motorRekkefolge.map(function (id) { return motorer[id]; }); },
      gjeldende: gjeldendeMotorId,
      // Bytter motor. Lytter han akkurat naa, stoppes den gamle motoren
      // foerst -- appen starter ikke den nye automatisk, det er opp til den
      // som ba om byttet (Foreldrekontroll er uansett ikke tilgjengelig fra
      // lesevisningen, saa dette treffer i praksis aldri en pagaaende oekt).
      velg: function (id) {
        if (!motorer[id]) return false;
        if (lytter.vil) lytter.stopp();
        Lagring.settLyttemotor(id);
        return true;
      }
    }
  };
})(window);
