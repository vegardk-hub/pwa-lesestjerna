/* Lagringen i Lesestjerna.
 *
 * Alt ligger under én noekkel i localStorage, med plass til tre spillere. Det
 * er med vilje: Vegard skal kunne proeve appen og forbedre den paa sin egen
 * profil uten aa roere det barna har bygd opp.
 *
 * localStorage alene er skjoert — tommer nettleseren seg, er maaneder med
 * lesing borte. Derfor finnes eksport() og importer(), og derfor havner en
 * slettet spiller i papirkurven i stedet for aa forsvinne. Husregelen om at
 * alt skal kunne gjoeres om igjen gjelder ogsaa her.
 */
(function (global) {
  "use strict";

  var NOEKKEL = "lesestjerna.v1";
  var MAKS = 3;

  var TOM_SPILLER = {
    mynter: 0,
    ord: 0,             // ord lest foerste gang — det er disse som gir boeker
    setninger: 0,
    hoppetOver: 0,
    okter: 0,
    gjenlesinger: 0,    // tekster han har tatt om igjen for aa bli bedre
    boker: 0,
    tekster: [],        // id-ene han har faatt betalt for
    eide: [],           // { ting, x, y }
    dager: {}           // "2026-08-21": 34 — ord per dag, til boka paa bordet
  };

  var data = null;

  function ferskt() {
    return { versjon: 1, aktiv: null, spillere: [], papirkurv: [] };
  }

  function les() {
    if (data) return data;
    try {
      var raa = localStorage.getItem(NOEKKEL);
      data = raa ? JSON.parse(raa) : ferskt();
    } catch (e) {
      // Skadet lagring skal ikke sperre appen. Vi begynner paa nytt, men rorer
      // ikke det som staar i localStorage — det kan hentes ut for haand.
      data = ferskt();
    }
    if (!data.spillere) data = ferskt();
    return data;
  }

  function lagre() {
    try {
      localStorage.setItem(NOEKKEL, JSON.stringify(les()));
      return true;
    } catch (e) {
      return false;
    }
  }

  function nyId() {
    return "s" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  }

  function idag() {
    var d = new Date();
    return d.getFullYear() + "-" +
           String(d.getMonth() + 1).padStart(2, "0") + "-" +
           String(d.getDate()).padStart(2, "0");
  }

  function finn(id) {
    return les().spillere.find(function (s) { return s.id === id; }) || null;
  }

  function aktiv() {
    var d = les();
    return d.aktiv ? finn(d.aktiv) : null;
  }

  function lagNy(navn, figur) {
    var d = les();
    if (d.spillere.length >= MAKS) return null;
    var s = Object.assign({}, TOM_SPILLER, {
      id: nyId(),
      navn: (navn || "").trim().slice(0, 20) || "Leseren",
      figur: figur || 0,
      laget: idag(),
      sistBrukt: idag(),
      // Objektene i TOM_SPILLER er delte referanser om vi ikke lager nye.
      tekster: [], eide: [], dager: {}
    });
    d.spillere.push(s);
    d.aktiv = s.id;
    lagre();
    return s;
  }

  global.Lagring = {
    MAKS: MAKS,

    spillere: function () { return les().spillere; },
    aktiv: aktiv,
    lagNy: lagNy,
    lagre: lagre,

    velg: function (id) {
      var s = finn(id);
      if (!s) return null;
      les().aktiv = id;
      s.sistBrukt = idag();
      lagre();
      return s;
    },

    dopOm: function (id, navn) {
      var s = finn(id);
      if (!s) return null;
      s.navn = (navn || "").trim().slice(0, 20) || s.navn;
      lagre();
      return s;
    },

    /* Til papirkurven, ikke ut av verden. En feiltrykk skal ikke kunne slette
     * et barns arbeid gjennom maaneder. */
    slett: function (id) {
      var d = les();
      var i = d.spillere.findIndex(function (s) { return s.id === id; });
      if (i < 0) return false;
      d.papirkurv.push(d.spillere.splice(i, 1)[0]);
      if (d.aktiv === id) d.aktiv = d.spillere.length ? d.spillere[0].id : null;
      lagre();
      return true;
    },

    hentTilbake: function (id) {
      var d = les();
      var i = d.papirkurv.findIndex(function (s) { return s.id === id; });
      if (i < 0 || d.spillere.length >= MAKS) return false;
      d.spillere.push(d.papirkurv.splice(i, 1)[0]);
      lagre();
      return true;
    },

    papirkurv: function () { return les().papirkurv; },

    idag: idag,

    /* ---------- Sikkerhetskopi ---------- */

    eksport: function () {
      var blob = new Blob([JSON.stringify(les(), null, 2)],
                          { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "lesestjerna-" + idag() + ".json";
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    },

    /* Legger spillerne fra fila til dem som alt finnes. Samme id blir
     * overskrevet, saa den samme kopien kan hentes inn to ganger uten aa lage
     * dubletter. Ingenting slettes. */
    importer: function (tekst) {
      var inn;
      try { inn = JSON.parse(tekst); } catch (e) { return { ok: false, grunn: "Fila kunne ikke leses." }; }
      if (!inn || !Array.isArray(inn.spillere)) {
        return { ok: false, grunn: "Dette ser ikke ut som en sikkerhetskopi fra Lesestjerna." };
      }
      var d = les();
      var lagt = 0, oppdatert = 0;
      inn.spillere.forEach(function (s) {
        if (!s || !s.id) return;
        var i = d.spillere.findIndex(function (e) { return e.id === s.id; });
        if (i >= 0) { d.spillere[i] = s; oppdatert++; }
        else if (d.spillere.length < MAKS) { d.spillere.push(s); lagt++; }
      });
      if (!d.aktiv && d.spillere.length) d.aktiv = d.spillere[0].id;
      lagre();
      return { ok: true, lagt: lagt, oppdatert: oppdatert };
    },

    // Bare for proeving: glemmer alt uten aa roere localStorage.
    glem: function () { data = null; }
  };
})(window);
