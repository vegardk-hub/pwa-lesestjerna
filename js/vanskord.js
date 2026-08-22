/* Vanskelige ord: et sted å øve seg på enkeltord gjenkjenneren ofte sliter
 * med -- de samme ordene som står merket "vanskeligeOrd" på tekstene i
 * data/tekster.json, plukket ut av Bank.vanskeligeOrd() (tallord er filtrert
 * bort der, se den fila -- de er bare vanskelige i en lang rekke, ikke alene).
 *
 * Tjue ord om gangen, valgt tilfeldig. Trykk på et for å øve på det -- selve
 * lesingen lånes fra lesing.js (app.js kobler det sammen, se
 * naarOrdValgt/merkFerdig), akkurat som vanlig lesing, bare med teksten satt
 * til det ene ordet. Godkjent, og ordet får et hakk og du er tilbake her for
 * å velge et nytt. "Nye 20 ord" bytter ut hele settet og nullstiller.
 *
 * Ingen mynter eller "ord lest" her -- det er en øvelse for seg selv, ikke en
 * ny, raskere vei til bøkene. Fremgangen er bare "X av 20", og den forsvinner
 * når et nytt sett hentes.
 */
(function (global) {
  "use strict";

  var $ = function (v) { return document.querySelector(v); };
  var MAKS = 20;

  var settOrd = [];    // [{ ord, ferdig }]
  var paaValgt = null;  // settes av app.js: et ord er valgt for øvelse

  function stokk(liste) {
    var kopi = liste.slice();
    for (var i = kopi.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = kopi[i]; kopi[i] = kopi[j]; kopi[j] = t;
    }
    return kopi;
  }

  function nyttSett() {
    var alle = Bank.vanskeligeOrd();
    settOrd = stokk(alle).slice(0, Math.min(MAKS, alle.length))
      .map(function (o) { return { ord: o, ferdig: false }; });
    tegn();
  }

  function tegn() {
    var ferdige = settOrd.filter(function (o) { return o.ferdig; }).length;
    $("#vanskordFremgang").textContent = settOrd.length
      ? ferdige + " av " + settOrd.length + " ord øvd"
      : "Fant ingen vanskelige ord å øve på ennå.";

    var liste = $("#vanskordListe");
    liste.textContent = "";
    settOrd.forEach(function (o) {
      var knapp = document.createElement("button");
      knapp.type = "button";
      knapp.className = "ordknapp" + (o.ferdig ? " ferdig" : "");
      knapp.textContent = o.ord;
      knapp.disabled = o.ferdig;
      knapp.onclick = function () { if (paaValgt) paaValgt(o.ord); };
      liste.append(knapp);
    });
  }

  // Kalt fra app.js naar et ord er lest ferdig. Matcher paa selve ordteksten,
  // ikke indeks -- settet endrer seg ikke mens han oever, saa det er trygt.
  function merkFerdig(ord) {
    var funnet = settOrd.find(function (o) { return o.ord === ord; });
    if (funnet) funnet.ferdig = true;
    tegn();
  }

  // Foerste gang: lager et sett. Senere kall (tilbake fra et ord) tegner
  // bare det som alt finnes, saa fremgangen ikke nullstilles ved et uhell.
  function apne() {
    if (!settOrd.length) nyttSett();
    else tegn();
  }

  $("#nyttOrdsett").onclick = nyttSett;

  global.Vanskord = {
    apne: apne,
    merkFerdig: merkFerdig,
    naarOrdValgt: function (fn) { paaValgt = fn; }
  };
})(window);
