/* Skjermen der man velger hvem som leser, og sikkerhetskopiene.
 *
 * Tre plasser: én til hvert av barna, og én til Vegard, saa han kan proeve
 * appen uten aa roere det de har bygd opp.
 *
 * Figurene er runde felter med forbokstaven i inntil de ekte figurene kommer.
 */
(function (global) {
  "use strict";

  var $ = function (v) { return document.querySelector(v); };

  var FARGER = ["#2f7d4f", "#2563a8", "#a8447a", "#b3651e", "#5a4bb3", "#0f8a8a"];

  var paaValgt = null;   // settes av app.js

  function tegn() {
    var boks = $("#spillerkort");
    boks.textContent = "";
    var alle = Lagring.spillere();
    var aktiv = Lagring.aktiv();

    alle.forEach(function (s) {
      boks.append(kort(s, aktiv && aktiv.id === s.id));
    });

    if (alle.length < Lagring.MAKS) boks.append(nyttKort());

    $("#plassbeskjed").textContent = alle.length >= Lagring.MAKS
      ? "Alle tre plassene er i bruk."
      : (Lagring.MAKS - alle.length) + " plass" +
        (Lagring.MAKS - alle.length > 1 ? "er" : "") + " ledig.";
  }

  function kort(s, erAktiv) {
    var d = document.createElement("div");
    d.className = "spiller" + (erAktiv ? " valgt" : "");

    var rund = document.createElement("div");
    rund.className = "figur";
    rund.style.background = FARGER[s.figur % FARGER.length];
    rund.textContent = (s.navn[0] || "?").toUpperCase();

    var navn = document.createElement("div");
    navn.className = "navn";
    navn.textContent = s.navn;

    var tall = document.createElement("div");
    tall.className = "tall";
    tall.textContent = "Level " + Spill.level(s) + " \u00b7 " + s.ord + " ord \u00b7 " +
                       s.boker + (s.boker === 1 ? " bok" : " bøker");

    d.append(rund, navn, tall);
    d.onclick = function () {
      Lagring.velg(s.id);
      if (paaValgt) paaValgt(Lagring.aktiv());
    };

    var meny = document.createElement("div");
    meny.className = "smaaknapper";

    var dop = document.createElement("button");
    dop.textContent = "Bytt navn";
    dop.onclick = function (e) {
      e.stopPropagation();
      var nytt = prompt("Hva skal han eller hun hete?", s.navn);
      if (nytt !== null) { Lagring.dopOm(s.id, nytt); tegn(); }
    };

    var vekk = document.createElement("button");
    vekk.textContent = "Fjern";
    vekk.onclick = function (e) {
      e.stopPropagation();
      // Det eneste virkelig oedeleggende trykket i appen. Derfor bade et
      // spoersmaal foerst og en papirkurv bak.
      if (!confirm("Fjerne " + s.navn + "? " + s.ord + " leste ord og " +
                   s.boker + " bøker legges bort. Lag gjerne en " +
                   "sikkerhetskopi først.")) return;
      Lagring.slett(s.id);
      tegn();
    };

    meny.append(dop, vekk);
    d.append(meny);
    return d;
  }

  function nyttKort() {
    var d = document.createElement("div");
    d.className = "spiller ny";
    var rund = document.createElement("div");
    rund.className = "figur";
    rund.textContent = "+";
    var navn = document.createElement("div");
    navn.className = "navn";
    navn.textContent = "Ny leser";
    d.append(rund, navn);
    d.onclick = function () {
      var navnet = prompt("Hva heter du?");
      if (navnet === null) return;
      var s = Lagring.lagNy(navnet, Lagring.spillere().length);
      if (s && paaValgt) paaValgt(s);
    };
    return d;
  }

  /* ---------- Sikkerhetskopi ---------- */

  function kopibeskjed(t, feil) {
    var el = $("#kopibeskjed");
    el.textContent = t || "";
    el.classList.toggle("feil", !!feil);
  }

  $("#sikkerhetskopi").onclick = function () {
    if (!Lagring.spillere().length) { kopibeskjed("Det er ingenting å kopiere ennå."); return; }
    Lagring.eksport();
    kopibeskjed("Kopien er lastet ned. Legg den et sted den ikke forsvinner.");
  };

  $("#hentInn").onclick = function () { $("#filvelger").click(); };

  $("#filvelger").onchange = function () {
    var fil = this.files[0];
    if (!fil) return;
    var leser = new FileReader();
    leser.onload = function () {
      var r = Lagring.importer(String(leser.result));
      if (!r.ok) { kopibeskjed(r.grunn, true); return; }
      tegn();
      kopibeskjed(r.lagt + " hentet inn, " + r.oppdatert + " oppdatert. " +
                  "Ingenting ble slettet.");
    };
    leser.readAsText(fil);
    this.value = "";
  };

  global.Spillere = { tegn: tegn, farge: function (n) { return FARGER[n % FARGER.length]; },
                      naarValgt: function (fn) { paaValgt = fn; } };
})(window);
