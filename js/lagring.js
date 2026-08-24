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
    mynterTjent: 0,     // alt han noensinne har tjent -- gaar aldri ned, se
                        // Spill.betal/tjenMynter. "mynter" alene kan ikke
                        // vise dette, siden den ogsaa trekkes ned av kjoep.
    ord: 0,             // ord lest foerste gang — det er disse som gir boeker
    setninger: 0,
    hoppetOver: 0,
    okter: 0,
    gjenlesinger: 0,    // tekster han har tatt om igjen for aa bli bedre
    boker: 0,
    tekster: [],        // id-ene han har faatt betalt for
    eide: [],           // { ting, pris } -- roboter kjøpt fra butikken
    dager: {},          // "2026-08-21": 34 — ord per dag, til boka paa bordet
    opptak: {},         // { robotId: dataURL } -- egne opptak til mytiske roboter
    valgtRobot: null,   // figur-id -- roboten han har valgt som sitt eget ikon
    // Ord HAN personlig har hengt seg opp i mens han leser -- ikke en
    // ferdig, felles liste (den fantes foer, se js/bank.js), men bygd opp
    // fra bunnen av egen lesing. Se leggTilVanskeligeOrd() under og
    // js/lesing.js sin fangVanskeligeOrd().
    vanskeligeOrd: []
  };

  var data = null;

  function ferskt() {
    return {
      versjon: 1, aktiv: null, spillere: [], papirkurv: [], foreldre: TOM_FORELDRE(),
      // Naar en sikkerhetskopi sist ble lastet ned (se eksport() under) --
      // ikke knyttet til noen bestemt spiller, det gjelder hele fila.
      sistSikkerhetskopi: null
    };
  }

  function TOM_FORELDRE() {
    // pin: en firesifret kode Vegard setter selv, ikke noe ekte sikkerhet --
    // bare nok til at et barn ikke skrur paa hjelpeknappen ved et uhell.
    // lyttemotor: id-en til motoren som skal hoere paa lesingen (se
    // Stemme.lyttemotorer i stemme.js) -- null betyr "standardmotoren".
    // lesestil: "presis" (hvert ord maa gjenkjennes) eller "leseflyt" (hele
    // teksten telles ferdig og betales naar han har lest seg gjennom den,
    // uansett hvor mange ord som ikke ble fanget opp) -- null betyr
    // "presis", se js/lesing.js.
    return { pin: null, lesForMeg: false, godkjennVoksen: false, lyttemotor: null, lesestil: null };
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
    // Lagring fra foer foreldrekontrollen fantes mangler denne noekkelen.
    if (!data.foreldre) data.foreldre = TOM_FORELDRE();
    // Lagring fra foer lyttemotor-valget fantes mangler dette feltet.
    if (data.foreldre.lyttemotor === undefined) data.foreldre.lyttemotor = null;
    // Lagring fra foer lesestil-valget fantes mangler dette feltet.
    if (data.foreldre.lesestil === undefined) data.foreldre.lesestil = null;
    // Lagring fra foer sikkerhetskopi-datoen ble husket mangler dette feltet.
    if (data.sistSikkerhetskopi === undefined) data.sistSikkerhetskopi = null;
    // Azure-motoren (og noekkelen/regionen den trengte) er fjernet igjen --
    // kostet penger aa bruke. Rydder bort eventuelle rester av den fra
    // lagringen, saa ingen noekkel blir liggende uten grunn.
    if (data.foreldre.azureNokkel !== undefined) delete data.foreldre.azureNokkel;
    if (data.foreldre.azureRegion !== undefined) delete data.foreldre.azureRegion;
    if (data.foreldre.lyttemotor === "azure") data.foreldre.lyttemotor = null;
    // Lagring fra foer opptaksfunksjonen fantes mangler denne paa spillerne.
    data.spillere.forEach(function (s) {
      if (!s.opptak) s.opptak = {};
      if (s.valgtRobot === undefined) s.valgtRobot = null;
      // Lagring fra foer den personlige vanskelig-ord-boka fantes.
      if (!s.vanskeligeOrd) s.vanskeligeOrd = [];
      // Lagring fra foer denne telleren fantes: vi kan ikke vite hvor mye
      // som er brukt i butikken tidligere, saa det han har staaende naa er
      // det beste gulvet vi har -- bedre enn aa starte paa null og late som
      // mynter han alt har tjent aldri fantes.
      if (s.mynterTjent === undefined) s.mynterTjent = s.mynter;
    });
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
      tekster: [], eide: [], dager: {}, opptak: {}, vanskeligeOrd: []
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

    /* ---------- Foreldrekontroll ---------- */

    harForeldrePin: function () { return !!les().foreldre.pin; },
    settForeldrePin: function (pin) { les().foreldre.pin = pin; lagre(); },
    sjekkForeldrePin: function (pin) { return les().foreldre.pin === pin; },
    lesForMegPaa: function () { return !!les().foreldre.lesForMeg; },
    settLesForMeg: function (paa) { les().foreldre.lesForMeg = !!paa; lagre(); },
    godkjennVoksenPaa: function () { return !!les().foreldre.godkjennVoksen; },
    settGodkjennVoksen: function (paa) { les().foreldre.godkjennVoksen = !!paa; lagre(); },
    lyttemotor: function () { return les().foreldre.lyttemotor; },
    settLyttemotor: function (id) { les().foreldre.lyttemotor = id || null; lagre(); },
    lesestil: function () { return les().foreldre.lesestil; },
    settLesestil: function (id) { les().foreldre.lesestil = id || null; lagre(); },

    /* ---------- Personlig vanskelig-ord-bok ---------- */

    vanskeligeOrd: function () {
      var s = aktiv();
      return (s && s.vanskeligeOrd) || [];
    },
    // Tar imot en liste (kan vaere flere paa én gang, fra én leseokt) --
    // lagrer bare én gang, ikke ett kall per ord. Dobbeltord filtreres bort.
    // Fjernes ikke av seg selv -- se fjernVanskeligeOrd() under, kalt naar
    // han faktisk oever seg opp igjennom dem i js/vanskord.js.
    leggTilVanskeligeOrd: function (nyeOrd) {
      var s = aktiv();
      if (!s || !nyeOrd || !nyeOrd.length) return;
      if (!s.vanskeligeOrd) s.vanskeligeOrd = [];
      var lagt = false;
      nyeOrd.forEach(function (o) {
        if (o && s.vanskeligeOrd.indexOf(o) === -1) { s.vanskeligeOrd.push(o); lagt = true; }
      });
      if (lagt) lagre();
    },
    // Kalt naar han har lest et ord riktig nok ganger til at js/vanskord.js
    // regner det som oevd ferdig -- da har det ikke lenger noe i boka aa
    // gjoere. Snubler han i det samme ordet igjen i en tekst senere, havner
    // det bare tilbake der av seg selv (fangVanskeligeOrd() i js/lesing.js).
    fjernVanskeligeOrd: function (ordListe) {
      var s = aktiv();
      if (!s || !s.vanskeligeOrd || !ordListe || !ordListe.length) return;
      var foer = s.vanskeligeOrd.length;
      s.vanskeligeOrd = s.vanskeligeOrd.filter(function (o) { return ordListe.indexOf(o) === -1; });
      if (s.vanskeligeOrd.length !== foer) lagre();
    },

    /* ---------- Opptak til mytiske roboter ---------- */

    // Ett opptak per robot per spiller. Tar han opp paa nytt, erstattes det
    // gamle -- ikke noe arkiv med flere forsoek aa holde styr paa.
    lagreOpptak: function (figurId, dataUrl) {
      var s = aktiv();
      if (!s) return;
      s.opptak[figurId] = dataUrl;
      lagre();
    },
    hentOpptak: function (figurId) {
      var s = aktiv();
      return (s && s.opptak[figurId]) || null;
    },

    /* ---------- Roboten han har valgt som sitt eget ikon ---------- */

    // Hvem som helst kan sette denne -- det er hus.js sin jobb aa bare
    // tilby roboter han faktisk eier. Null betyr "ingen valgt", og da vises
    // forbokstaven i stedet, som foer roboter fantes.
    settValgtRobot: function (figurId) {
      var s = aktiv();
      if (!s) return;
      s.valgtRobot = figurId || null;
      lagre();
    },
    valgtRobot: function () {
      var s = aktiv();
      return (s && s.valgtRobot) || null;
    },

    /* ---------- Sikkerhetskopi ---------- */

    eksport: function () {
      // Datoen skrives foer selve kopien lages, saa den ogsaa staar riktig
      // i akkurat den fila som lastes ned -- ikke bare i det som blir
      // liggende igjen i nettleseren.
      les().sistSikkerhetskopi = new Date().toISOString();
      lagre();
      var blob = new Blob([JSON.stringify(les(), null, 2)],
                          { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "lesestjerna-" + idag() + ".json";
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    },

    sistSikkerhetskopi: function () { return les().sistSikkerhetskopi; },

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
