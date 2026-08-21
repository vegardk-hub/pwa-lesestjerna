/* Robotlydene: en liten, morsom lyd som passer navnet, når han trykker på en
 * robot i samlingen sin.
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
    }
  };
})(window);
