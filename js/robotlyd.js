/* Robotlydene: en liten, morsom lyd som passer navnet, når han trykker på en
 * robot i samlingen sin -- pluss én lyd til (pling, under) som ikke hører
 * til noen bestemt robot.
 *
 * Ingen lydfiler her -- alt er syntetisert med Web Audio API, bygget av noen
 * få byggeklosser (tone, sveip, støy, knirk). Det gjør at en ny robot bare
 * trenger en oppskrift på noen linjer, og det finnes ingen fil å laste ned
 * eller rettigheter å bry seg om.
 */
(function (global) {
  "use strict";

  var ctx = null;

  function faaKontekst() {
    if (!ctx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /* ---------- Byggeklosser ---------- */

  // En enkel tone med rask oppgang og myk utklinging.
  function tone(c, t, frekvens, varighet, type, volum) {
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(frekvens, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volum || .25, t + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, t + varighet);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + varighet + .03);
  }

  // Frekvensen glir fra ett tonehøyde til en annen.
  function sveip(c, t, fra, til, varighet, type, volum) {
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(fra, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(til, 1), t + varighet);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volum || .25, t + .01);
    gain.gain.exponentialRampToValueAtTime(.0001, t + varighet);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + varighet + .03);
  }

  // Hvit støy gjennom et filter -- til gnist, klikk og krasing.
  function stoy(c, t, varighet, filterHz, volum) {
    var lengde = Math.max(1, Math.round(c.sampleRate * varighet));
    var buffer = c.createBuffer(1, lengde, c.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < lengde; i++) data[i] = Math.random() * 2 - 1;
    var kilde = c.createBufferSource();
    kilde.buffer = buffer;
    var filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = filterHz || 2000;
    var gain = c.createGain();
    gain.gain.setValueAtTime(volum || .2, t);
    gain.gain.exponentialRampToValueAtTime(.0001, t + varighet);
    kilde.connect(filter).connect(gain).connect(c.destination);
    kilde.start(t);
    kilde.stop(t + varighet + .03);
  }

  /* Stoey som svulmer opp og av igjen, med et filter som samtidig glir fra én
   * frekvens til en annen.
   *
   * stoy() over smeller med det samme og doer ut -- riktig for en gnist eller
   * et klikk, men ild, vann og vind har ikke noe anslag i det hele tatt. De
   * vokser fram, staar en stund, og trekker seg tilbake. Derfor gaar volumet
   * her opp foerst (rundt en tredel inn) i stedet for aa starte paa topp.
   *
   * Filtersveipet er det som skiller elementene fra hverandre: en boelge er
   * et lavpassfilter som aapner seg, mens vind er et smalt baandpass (hoey Q)
   * som glir oppover og dermed uler. */
  function sus(c, t, varighet, fraHz, tilHz, volum, filterType, Q) {
    var lengde = Math.max(1, Math.round(c.sampleRate * varighet));
    var buffer = c.createBuffer(1, lengde, c.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < lengde; i++) data[i] = Math.random() * 2 - 1;
    var kilde = c.createBufferSource();
    kilde.buffer = buffer;
    var filter = c.createBiquadFilter();
    filter.type = filterType || "bandpass";
    filter.frequency.setValueAtTime(Math.max(fraHz, 1), t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(tilHz, 1), t + varighet);
    if (Q) filter.Q.value = Q;
    var gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volum || .18, t + varighet * .35);
    gain.gain.exponentialRampToValueAtTime(.0001, t + varighet);
    kilde.connect(filter).connect(gain).connect(c.destination);
    kilde.start(t);
    kilde.stop(t + varighet + .03);
  }

  // En tone med vibrato og synkende tonehøyde -- knirk i en gammel dør.
  function knirkelyd(c, t, varighet, frekvens, volum) {
    var osc = c.createOscillator();
    osc.type = "sawtooth";
    var lfo = c.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 16;
    var lfoGain = c.createGain();
    lfoGain.gain.value = frekvens * .18;
    lfo.connect(lfoGain).connect(osc.frequency);
    osc.frequency.setValueAtTime(frekvens, t);
    osc.frequency.exponentialRampToValueAtTime(frekvens * .55, t + varighet);
    var gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volum || .16, t + .05);
    gain.gain.exponentialRampToValueAtTime(.0001, t + varighet);
    osc.connect(gain).connect(c.destination);
    lfo.start(t); osc.start(t);
    lfo.stop(t + varighet + .03); osc.stop(t + varighet + .03);
  }

  /* ---------- Én oppskrift per robot ---------- */

  var OPPSKRIFTER = {
    blikkis: function (c, t) {
      tone(c, t, 260, .09, "square", .22);
      tone(c, t + .1, 180, .12, "square", .2);
    },
    skrue: function (c, t) {
      for (var i = 0; i < 4; i++) stoy(c, t + i * .07, .05, 3500, .16);
    },
    pipp: function (c, t) {
      tone(c, t, 880, .09, "sine", .22);
      tone(c, t + .13, 1046, .1, "sine", .22);
    },
    gnist: function (c, t) {
      stoy(c, t, .08, 4000, .28);
      sveip(c, t + .02, 1800, 300, .12, "sawtooth", .14);
    },
    voltar: function (c, t) {
      sveip(c, t, 150, 900, .18, "square", .2);
      sveip(c, t + .18, 900, 120, .12, "square", .16);
    },
    dundre: function (c, t) {
      tone(c, t, 90, .35, "sine", .32);
      tone(c, t + .05, 60, .3, "triangle", .22);
    },
    knirk: function (c, t) {
      knirkelyd(c, t, .5, 320, .2);
    },
    zippi: function (c, t) {
      sveip(c, t, 400, 2200, .15, "sawtooth", .2);
    },
    glimt: function (c, t) {
      tone(c, t, 1400, .12, "sine", .18);
      tone(c, t + .1, 1900, .18, "sine", .16);
    },
    rusty: function (c, t) {
      tone(c, t, 140, .1, "square", .2);
      knirkelyd(c, t + .1, .35, 220, .15);
    },
    beep: function (c, t) {
      tone(c, t, 1000, .18, "square", .2);
    },
    sprett: function (c, t) {
      sveip(c, t, 700, 180, .22, "sine", .24);
      tone(c, t + .22, 260, .07, "sine", .14);
      tone(c, t + .3, 200, .06, "sine", .11);
    },
    knotten: function (c, t) {
      sveip(c, t, 500, 900, .08, "sine", .2);
      sveip(c, t + .1, 500, 900, .08, "sine", .18);
    },
    magnetus: function (c, t) {
      tone(c, t, 110, .4, "sawtooth", .18);
      sveip(c, t + .05, 220, 110, .3, "sine", .13);
    },

    /* ---------- Sjeldne ---------- */
    glitra: function (c, t) {
      tone(c, t, 1800, .08, "sine", .16);
      tone(c, t + .08, 2200, .08, "sine", .15);
      tone(c, t + .16, 2600, .12, "sine", .14);
    },
    neon: function (c, t) {
      sveip(c, t, 600, 650, .15, "sawtooth", .16);
      stoy(c, t + .15, .04, 5000, .12);
      sveip(c, t + .2, 640, 600, .12, "sawtooth", .14);
    },
    pulsar: function (c, t) {
      tone(c, t, 500, .06, "square", .2);
      tone(c, t + .12, 500, .06, "square", .2);
      tone(c, t + .24, 500, .06, "square", .2);
    },
    flimmer: function (c, t) {
      for (var i = 0; i < 5; i++) tone(c, t + i * .06, 900 + (i % 2) * 300, .05, "triangle", .14);
    },
    strobo: function (c, t) {
      for (var i = 0; i < 3; i++) stoy(c, t + i * .1, .03, 6000, .22);
    },

    /* ---------- Legendariske ---------- */
    titan: function (c, t) {
      tone(c, t, 70, .3, "sawtooth", .3);
      tone(c, t + .1, 100, .35, "square", .22);
    },
    fenix: function (c, t) {
      sveip(c, t, 300, 1200, .3, "sawtooth", .22);
      stoy(c, t + .05, .15, 3000, .18);
    },
    orakel: function (c, t) {
      tone(c, t, 1200, .2, "sine", .16);
      tone(c, t + .15, 900, .25, "sine", .14);
      tone(c, t + .32, 700, .3, "sine", .12);
    },
    kosmo: function (c, t) {
      sveip(c, t, 200, 1600, .35, "sine", .2);
      sveip(c, t + .35, 1600, 200, .25, "sine", .14);
    },
    ultra: function (c, t) {
      sveip(c, t, 300, 3000, .1, "sawtooth", .22);
      tone(c, t + .1, 2000, .05, "square", .16);
    },

    /* ---------- Mytiske ---------- */
    ekko: function (c, t) {
      tone(c, t, 700, .12, "sine", .22);
      tone(c, t + .15, 700, .12, "sine", .15);
      tone(c, t + .3, 700, .12, "sine", .09);
    },
    gjenklang: function (c, t) {
      tone(c, t, 500, .15, "triangle", .22);
      tone(c, t + .18, 500, .15, "triangle", .14);
      tone(c, t + .36, 500, .15, "triangle", .08);
    },
    viska: function (c, t) {
      stoy(c, t, .3, 1500, .1);
    },
    spegel: function (c, t) {
      sveip(c, t, 400, 900, .15, "sine", .18);
      sveip(c, t + .15, 900, 400, .15, "sine", .18);
    },
    stemmefanger: function (c, t) {
      sveip(c, t, 1200, 300, .25, "sawtooth", .2);
      tone(c, t + .25, 300, .1, "sine", .16);
    },

    /* ---------- Episke (skyggeroboter) ---------- */
    skygge: function (c, t) {
      // To toner nesten likt i tonehoeyde slaar mot hverandre og lager en
      // ustoe, urovekkende summing -- ikke en ren tone.
      tone(c, t, 58, .8, "sawtooth", .22);
      tone(c, t, 61, .8, "sawtooth", .18);
      stoy(c, t + .3, .2, 800, .12);
    },
    gjenferd: function (c, t) {
      sveip(c, t, 1400, 350, .9, "sine", .16);
      knirkelyd(c, t + .1, .6, 500, .12);
    },
    morkling: function (c, t) {
      sveip(c, t, 260, 55, .5, "sawtooth", .25);
      stoy(c, t + .45, .15, 1200, .18);
      tone(c, t + .5, 45, .4, "square", .2);
    },

    /* ---------- Sekssju ----------
     * Disse sto lenge helt stille med vilje -- tanken var at frasen deres
     * ("Six seven!") skulle staa alene. I praksis ble de bare de eneste
     * robotene som ikke svarte naar han trykte paa dem. Na har de en kort
     * lyd foerst, som de legendariske: lyden kommer med det samme, frasen
     * 450 ms etter (se reager() i samling.js). Derfor er alle lydene her --
     * og i de tre kategoriene under, som ogsaa har frase -- holdt godt
     * under et halvt sekund, saa de er ferdige foer stemmen begynner. */
    doot: function (c, t) {
      // To korte trompetstoet.
      tone(c, t, 392, .11, "sawtooth", .18);
      tone(c, t + .14, 392, .17, "sawtooth", .18);
    },
    vippo: function (c, t) {
      // Armene som vipper: opp, og ned igjen.
      sveip(c, t, 300, 800, .1, "triangle", .2);
      sveip(c, t + .12, 800, 300, .12, "triangle", .2);
    },
    seksju: function (c, t) {
      // To trinn opp, ett for hvert tall i navnet.
      tone(c, t, 523, .1, "square", .2);
      tone(c, t + .13, 784, .17, "square", .2);
    },

    /* ---------- Utenomjordiske ----------
     * Hodet dreier og oeynene skyter laser (se samling.js) -- lydene er
     * valgt til aa hoere hjemme ute i rommet, ikke i et verksted. */
    zorbo: function (c, t) {
      // Theremin: én tone som vaker ustoett opp og ned.
      sveip(c, t, 600, 900, .12, "sine", .2);
      sveip(c, t + .12, 900, 550, .12, "sine", .2);
      sveip(c, t + .24, 550, 780, .15, "sine", .18);
    },
    nebulon: function (c, t) {
      // Dyp romtaake: to lave toner tett inntil hverandre, som svever.
      tone(c, t, 116, .4, "sine", .22);
      tone(c, t + .02, 123, .4, "sine", .16);
      sus(c, t, .4, 400, 1400, .07, "bandpass", 2);
    },
    kryptar: function (c, t) {
      // To laserskudd fra oeynene.
      sveip(c, t, 2400, 500, .09, "square", .2);
      sveip(c, t + .13, 2000, 420, .1, "square", .18);
    },
    vraak: function (c, t) {
      // Et skurrende romvesenskrik.
      sveip(c, t, 1500, 240, .3, "sawtooth", .22);
      sus(c, t, .3, 3000, 700, .14, "bandpass", 1.5);
    },
    xenon: function (c, t) {
      // Kald edelgass-glo: to hoeye toner saa tett inntil hverandre at de
      // slaar mot hverandre og skjelver, i stedet for aa staa som én ren
      // klokketone.
      tone(c, t, 2100, .34, "sine", .14);
      tone(c, t, 2160, .34, "sine", .12);
    },

    /* ---------- Utrolige ----------
     * Hopper, snurrer og bytter om paa kroppsdeler -- lydene foelger
     * bevegelsen: opp i lufta, rundt, og ned igjen. */
    salto: function (c, t) {
      // Et hopp med en liten dunk i landingen.
      sveip(c, t, 300, 1100, .18, "sine", .22);
      sveip(c, t + .18, 1100, 260, .12, "sine", .18);
      tone(c, t + .31, 150, .09, "triangle", .2);
    },
    piruett: function (c, t) {
      // Snurring: samme oppsveip om og om igjen, fortere og fortere.
      sveip(c, t, 500, 1400, .1, "triangle", .16);
      sveip(c, t + .1, 550, 1500, .08, "triangle", .17);
      sveip(c, t + .18, 600, 1600, .07, "triangle", .18);
      sveip(c, t + .25, 650, 1800, .08, "triangle", .19);
    },
    flikkflakk: function (c, t) {
      // To hopp paa rad, det andre litt hoeyere enn det foerste.
      sveip(c, t, 420, 900, .09, "square", .17);
      tone(c, t + .1, 300, .05, "sine", .14);
      sveip(c, t + .17, 520, 1100, .09, "square", .17);
      tone(c, t + .28, 340, .07, "sine", .14);
    },
    vrenger: function (c, t) {
      // Noe som vrenges innsida ut: en sveip som snur midtveis.
      sveip(c, t, 900, 180, .16, "sawtooth", .2);
      sveip(c, t + .16, 180, 900, .18, "sawtooth", .2);
    },

    /* ---------- Uknuselige ----------
     * Hver av disse har en kraft (ild/vann/lyn/vind, se "kraft"-feltet i
     * data/figurer.json og auraen i styles.css). Lyden er selve elementet,
     * ikke en robotlyd -- det er det som gjoer dem uknuselige. */
    flammo: function (c, t) {
      // Ild: en jevn susing med smaa, uregelmessige knitreknepp oppi.
      sus(c, t, .38, 1800, 900, .16, "bandpass", 1.2);
      stoy(c, t + .06, .03, 5000, .14);
      stoy(c, t + .17, .03, 4200, .12);
      stoy(c, t + .27, .03, 5500, .13);
    },
    bolgar: function (c, t) {
      // Vann: en boelge som skyller inn og trekker seg ut igjen.
      sus(c, t, .42, 200, 900, .2, "lowpass", 1);
    },
    tordar: function (c, t) {
      // Lyn: det skarpe smellet foerst, rumlingen etterpaa.
      stoy(c, t, .05, 6000, .3);
      tone(c, t + .03, 55, .38, "sawtooth", .26);
      sus(c, t + .05, .35, 400, 90, .18, "lowpass", 1);
    },
    vindar: function (c, t) {
      // Vind: smal stoey (hoey Q) som glir oppover og dermed uler.
      sus(c, t, .4, 600, 1500, .17, "bandpass", 6);
    },

    /* ---------- Transformere ----------
     * Motsatt av sekssju: disse har med vilje INGEN frase, bare lyden av
     * det de forvandler seg til -- en robotstemme som sier "bil" ville bare
     * forstyrre. */
    vroom: function (c, t) {
      // En bilmotor som gasses opp.
      sveip(c, t, 90, 220, .35, "sawtooth", .26);
      stoy(c, t, .12, 800, .12);
    },
    jetto: function (c, t) {
      // Jetmotor: en lang, susende oppsveip med stoey under.
      sveip(c, t, 300, 1500, .7, "sawtooth", .16);
      stoy(c, t, .9, 3200, .16);
    },
    skvalp: function (c, t) {
      // Baatmotor: en rytmisk, duttrende dieselputring.
      for (var i = 0; i < 5; i++) tone(c, t + i * .11, 70, .08, "square", .24);
    },
    skinnar: function (c, t) {
      // Togtut: to samklingende toner, som et ekte lokomotivfloeyte-signal.
      tone(c, t, 440, .55, "sawtooth", .2);
      tone(c, t, 554, .55, "sawtooth", .15);
      tone(c, t + .6, 440, .35, "sawtooth", .18);
      tone(c, t + .6, 554, .35, "sawtooth", .13);
    }
  };

  global.Robotlyd = {
    // Lyd er ekstra moro, ikke noe appen er avhengig av -- feiler den
    // (nettleser uten Web Audio, ingen oppskrift), skjer bare ingenting.
    spill: function (id) {
      var oppskrift = OPPSKRIFTER[id];
      if (!oppskrift) return;
      try {
        var c = faaKontekst();
        if (c) oppskrift(c, c.currentTime);
      } catch (e) { /* stille */ }
    },

    // Ikke knyttet til noen bestemt robot -- en liten, fornøyd "pling" naar
    // foelgesvennen lander i ikonet han valgte paa verdenskartet (se
    // verden.js sin reiseTilSone()).
    pling: function () {
      try {
        var c = faaKontekst();
        if (!c) return;
        var t = c.currentTime;
        tone(c, t, 1050, .12, "sine", .22);
        tone(c, t + .09, 1570, .18, "sine", .2);
      } catch (e) { /* stille */ }
    },

    // Robotstemmen til de legendariske: samme norske stemme som resten av
    // appen, bare med lavere tonehoeyde -- nok til aa hoeres ut som en robot
    // og ikke som Finn som leser en tekst.
    si: function (tekst) {
      try {
        var stemme = global.Stemme && Stemme.valgtStemme();
        if (!stemme || !window.speechSynthesis) return;
        speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(tekst);
        u.voice = stemme;
        u.lang = stemme.lang;
        u.pitch = 0.3;
        u.rate = 0.95;
        speechSynthesis.speak(u);
      } catch (e) { /* stille */ }
    }
  };
})(window);
