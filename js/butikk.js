/* Butikken: her bruker han myntene han har lest seg til på roboter til
 * samlingen sin. Katalogen kommer fra data/figurer.json, og hver robot
 * tegnes av Figurer.svg() -- se figurer.js.
 *
 * Robotene er samleobjekter, ikke ting han flytter rundt i rommet: han
 * kjøper én av hver, og ser dem igjen i samlingen (samling.js). Ett regel
 * fra husreglene gjelder likevel fortsatt: kjøp trekker mynter, men aldri
 * under det han har -- knappen er rett og slett avslått når han ikke har
 * råd, eller når han alt eier den. Et kjøp er endelig -- det finnes ingen
 * vei tilbake til myntene igjen.
 */
(function (global) {
  "use strict";

  var $ = function (v) { return document.querySelector(v); };

  function lag(klasse, tag) {
    var d = document.createElement(tag || "div");
    if (klasse) d.className = klasse;
    return d;
  }

  function tegn() {
    var s = Lagring.aktiv();
    if (!s) return;

    var eid = {};
    (s.eide || []).forEach(function (e) { eid[e.ting] = true; });

    var liste = $("#butikkListe");
    liste.textContent = "";
    Figurer.alle().forEach(function (v) {
      var kort = lag("vare " + v.kategori);
      var merke = lag("merke-kategori");
      merke.textContent = Figurer.kategorinavn(v.kategori);
      var ikon = lag("figur-ikon");
      ikon.innerHTML = Figurer.svg(v.id);
      var navn = lag("navn"); navn.textContent = v.navn;
      var pris = lag("pris"); pris.innerHTML = v.pris + " ◉";
      var knapp = document.createElement("button");
      knapp.type = "button";
      if (eid[v.id]) {
        knapp.textContent = "Eid";
        knapp.disabled = true;
      } else {
        knapp.textContent = "Kjøp";
        knapp.disabled = s.mynter < v.pris;
        knapp.onclick = function () {
          if (Spill.kjop(v.id, v.pris)) tegn();
        };
      }
      kort.append(merke, ikon, navn, pris, knapp);
      liste.append(kort);
    });

    $("#butikkMynter").textContent = s.mynter + " ◉";
    tegnEide(s);
  }

  // Naavn og mynter staar i den globale topplinja mens butikken er aapen,
  // paa samme rad som "Lesestjerna" -- ikke paa en egen rad under, som maa
  // rulles forbi. "Bytt spiller" viser ellers de samme myntene der, saa den
  // skjules i mellomtiden for aa ikke vise tallet to ganger paa rad.
  function visHeader(paa) {
    $("#butikkHeader").hidden = !paa;
    $("#lukkButikk").hidden = !paa;
    if (paa) $("#byttSpiller").hidden = true;
    else if (Lagring.aktiv()) $("#byttSpiller").hidden = false;
  }

  function tegnEide(s) {
    var liste = $("#butikkEide");
    liste.textContent = "";
    (s.eide || []).forEach(function (e) {
      var v = Figurer.finn(e.ting);
      if (!v) return;
      var rad = lag("eidRad " + v.kategori);
      var ikon = lag("figur-ikon liten");
      ikon.innerHTML = Figurer.svg(v.id);
      var navn = lag("", "span");
      navn.textContent = v.navn;
      rad.append(ikon, navn);
      liste.append(rad);
    });
    $("#butikkEideTom").hidden = (s.eide || []).length > 0;
  }

  /* ---------- Åpne / lukke ---------- */

  function apne() {
    tegn();
    $("#hus").hidden = true;
    $("#butikk").hidden = false;
    visHeader(true);
  }

  $("#lukkButikk").onclick = function () {
    $("#butikk").hidden = true;
    $("#hus").hidden = false;
    visHeader(false);
  };

  global.Butikk = {
    apne: apne,
    tegn: tegn
  };
})(window);
