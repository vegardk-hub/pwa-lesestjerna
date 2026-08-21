/* Tekstbanken: leser data/tekster.json og svarer paa hvilken tekst som skal
 * leses naa.
 *
 * Hele poenget med denne fila er at banken skal kunne vokse uten at noe annet
 * roeres. Legger man et nytt objekt i JSON-fila, dukker det opp av seg selv —
 * ordtellingen regnes ut her, ikke i fila, saa det finnes ingenting aa holde i
 * takt for haand. Et nytt emne i 'emner' gir en ny knapp i emnevelgeren.
 *
 * Feil i fila stopper ikke appen. En tekst som mangler noe blir lagt bort og
 * meldt i Bank.feil(), saa resten kan leses videre. En leseapp som gaar i
 * staa fordi noen glemte et komma, er en leseapp som ikke blir brukt.
 */
(function (global) {
  "use strict";

  var STI = "data/tekster.json";

  var emner = [];
  var tekster = [];
  var etterId = {};
  var problemer = [];
  var lasting = null;

  function tell(t) {
    var setn = Tekst.setninger(t.tekst.replace(/\s+/g, " ").trim());
    var ord = 0;
    setn.forEach(function (s) {
      s.split(/\s+/).forEach(function (o) { if (Tekst.reint(o)) ord++; });
    });
    t.setninger = setn.length;
    t.ord = ord;
  }

  function godta(t, kjenteEmner) {
    if (!t || typeof t.id !== "string" || !t.id) {
      problemer.push("En tekst mangler id og er lagt bort.");
      return false;
    }
    if (etterId[t.id]) {
      problemer.push("To tekster har id \u00ab" + t.id + "\u00bb. Den andre er lagt bort.");
      return false;
    }
    if (kjenteEmner.indexOf(t.emne) === -1) {
      problemer.push(t.id + " h\u00f8rer til emnet \u00ab" + t.emne + "\u00bb, som ikke finnes.");
      return false;
    }
    if (typeof t.tekst !== "string" || !t.tekst.trim()) {
      problemer.push(t.id + " har ingen tekst.");
      return false;
    }
    return true;
  }

  function ordne(data) {
    emner = Array.isArray(data.emner) ? data.emner.slice() : [];
    tekster = [];
    etterId = {};
    var kjente = emner.map(function (e) { return e.id; });

    (Array.isArray(data.tekster) ? data.tekster : []).forEach(function (t) {
      if (!godta(t, kjente)) return;
      t.niva = t.niva || 1;
      t.vanskeligeOrd = t.vanskeligeOrd || [];
      tell(t);
      tekster.push(t);
      etterId[t.id] = t;
    });

    emner.forEach(function (e) {
      e.antall = tekster.filter(function (t) { return t.emne === e.id; }).length;
      if (!e.antall) problemer.push("Emnet \u00ab" + e.id + "\u00bb har ingen tekster enn\u00e5.");
    });
  }

  /* Hva den som leser naa har lest fra foer. Tom liste om ingen er valgt. */
  function lest() {
    var s = Lagring.aktiv();
    return (s && s.tekster) || [];
  }

  function iEmne(emneId) {
    return tekster.filter(function (t) { return t.emne === emneId; });
  }

  /* Neste tekst i et emne: den letteste han ikke har lest. Er alle lest, kommer
   * de om igjen — det skal ikke gaa an aa toemme et emne og staa fast, selv om
   * gjenlesing ikke betaler. */
  function neste(emneId) {
    var alle = iEmne(emneId);
    if (!alle.length) return null;
    var f = lest();
    var uleste = alle.filter(function (t) { return f.indexOf(t.id) === -1; });
    var pott = uleste.length ? uleste : alle;
    var lavest = Math.min.apply(null, pott.map(function (t) { return t.niva; }));
    var laveste = pott.filter(function (t) { return t.niva === lavest; });
    return laveste[Math.floor(Math.random() * laveste.length)];
  }

  global.Bank = {
    /* Kalles én gang ved oppstart. Kaller man den igjen, faar man samme
     * lofte tilbake — fila hentes ikke to ganger. */
    last: function () {
      if (lasting) return lasting;
      lasting = fetch(STI)
        .then(function (r) {
          if (!r.ok) throw new Error(r.status + " " + r.statusText);
          return r.json();
        })
        .then(function (data) {
          problemer = [];
          ordne(data);
          return { emner: emner, tekster: tekster, feil: problemer };
        })
        .catch(function (e) {
          problemer = ["Fikk ikke lest " + STI + ": " + e.message];
          emner = [];
          tekster = [];
          return { emner: [], tekster: [], feil: problemer };
        });
      return lasting;
    },

    emner: function () {
      var f = lest();
      return emner.map(function (e) {
        var mine = iEmne(e.id);
        return {
          id: e.id,
          navn: e.navn,
          under: e.under,
          antall: mine.length,
          lest: mine.filter(function (t) { return f.indexOf(t.id) !== -1; }).length
        };
      });
    },

    tekster: iEmne,
    neste: neste,
    finn: function (id) { return etterId[id] || null; },
    erLest: function (id) { return lest().indexOf(id) !== -1; },
    feil: function () { return problemer.slice(); }
  };
})(window);
