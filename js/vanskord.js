/* Vanskelige ord: et sted å øve seg på enkeltord gjenkjenneren ofte sliter
 * med -- de samme ordene som står merket "vanskeligeOrd" på tekstene i
 * data/tekster.json, plukket ut av Bank.vanskeligeOrd() (tallord er filtrert
 * bort der, se den fila -- de er bare vanskelige i en lang rekke, ikke alene).
 *
 * Tjue ord om gangen, valgt tilfeldig. Trykk på et for å øve på det -- selve
 * lesingen lånes fra lesing.js (app.js kobler det sammen, se
 * naarOrdValgt/merkFerdig), akkurat som vanlig lesing, bare med teksten satt
 * til det ene ordet. Godkjent, og ordet får et hakk og du er tilbake her for
 * å velge et nytt. "Nye 20 ord" bytter ut hele settet, uten å røre det han
 * alt har samlet opp -- se poengSamlet under.
 *
 * Hvert godkjent ord er verdt én mynt, men betales ikke ut med en gang --
 * det bygger seg opp i poengSamlet til han trykker "Ferdig", som henter ut
 * hele summen på én gang (se app.js, som kobler det mot Spill.tjenMynter).
 * Ikke koblet til "ord lest" eller bøkene: dette er en øvelse for seg selv,
 * ikke en ny, raskere vei til bok-økonomien.
 */
(function (global) {
  "use strict";

  var $ = function (v) { return document.querySelector(v); };
  var MAKS = 20;

  var settOrd = [];      // [{ ord, ferdig }]
  var poengSamlet = 0;   // godkjente ord siden forrige uthenting
  var paaValgt = null;   // settes av app.js: et ord er valgt for øvelse

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
    $("#vanskordMelding").textContent = "";
    tegn();
  }

  function tegn() {
    var ferdige = settOrd.filter(function (o) { return o.ferdig; }).length;
    var poengtekst = poengSamlet
      ? " · " + poengSamlet + (poengSamlet === 1 ? " mynt klar til henting" : " mynter klare til henting")
      : "";
    $("#vanskordFremgang").textContent = settOrd.length
      ? ferdige + " av " + settOrd.length + " ord øvd" + poengtekst
      : "Fant ingen vanskelige ord å øve på ennå.";
    $("#vanskordFerdig").disabled = poengSamlet === 0;

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
  // Bare foerste gang et ord godkjennes gir mynt -- uten "!o.ferdig"-sjekken
  // kunne et ord som av en eller annen grunn ble meldt ferdig to ganger gitt
  // dobbel betaling.
  function merkFerdig(ord) {
    var funnet = settOrd.find(function (o) { return o.ord === ord; });
    if (funnet && !funnet.ferdig) {
      funnet.ferdig = true;
      poengSamlet++;
    }
    tegn();
  }

  // Kalt fra app.js naar han trykker "Ferdig". Gir fra seg summen og
  // nullstiller selv -- ingen sjanse for aa hente den samme summen to ganger.
  function hentUtMynter() {
    var n = poengSamlet;
    poengSamlet = 0;
    return n;
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
    hentUtMynter: hentUtMynter,
    naarOrdValgt: function (fn) { paaValgt = fn; }
  };
})(window);
