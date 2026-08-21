/* Butikken: her bruker han myntene han har lest seg til. Katalogen kommer fra
 * data/mobler.json (samme fetch-og-cache-mønster som bank.js), bildene er
 * ferdig klippet av kenney/lag_mobler.py til img/mobler/<id>.png.
 *
 * To regler fra husreglene gjelder her også:
 *   - Kjøp trekker mynter, men aldri under det han har -- knappen er rett og
 *     slett avslått når han ikke har råd.
 *   - Selg gir full pris tilbake (se Spill.selg). Han skal kunne ombestemme
 *     seg uten å tape på det.
 *
 * Skjermen ligger oppå #hus akkurat som #boka -- se hus.js sitt apneBoka()
 * for samme mønster. Forskjellen er at butikken *endrer* rommet, så lukkes
 * den, må Hus.tegn() kjøres på nytt for at møblene skal dukke opp.
 */
(function (global) {
  "use strict";

  var $ = function (v) { return document.querySelector(v); };
  var STI = "data/mobler.json";

  var varer = [];
  var etterId = {};
  var lasting = null;

  // Samme rutenett som kenney/lag_rom.py tegnet rommet i (16 bredt, 9 høyt).
  // Gulvet begynner på rad 4 -- radene over er vegg, og der skal ingenting
  // stå. Dørflaten og bordet er hentet fra styles.css/lag_rom.py sine egne
  // plasseringer, så nye ting ikke havner oppå dem.
  var ROM_BREDDE = 16, ROM_HOYDE = 9, GULV_Y0 = 4;
  var DOER = { x: 13.6, y: 1.3, w: 2.4, h: 5.3 };
  var BORD = { x: 11, y: 5, w: 1, h: 2 };

  function lag(klasse, tag) {
    var d = document.createElement(tag || "div");
    if (klasse) d.className = klasse;
    return d;
  }

  /* ---------- Plassering av nye kjøp ---------- */

  function overlapper(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function nesteLedigPlass(v) {
    var s = Lagring.aktiv();
    var opptatt = [DOER, BORD];
    (s.eide || []).forEach(function (e) {
      var eV = etterId[e.ting];
      if (eV) opptatt.push({ x: e.x, y: e.y, w: eV.bredde, h: eV.hoyde });
    });
    for (var y = GULV_Y0; y <= ROM_HOYDE - v.hoyde; y += 0.5) {
      for (var x = 0; x <= ROM_BREDDE - v.bredde; x += 0.5) {
        var rute = { x: x, y: y, w: v.bredde, h: v.hoyde };
        if (!opptatt.some(function (o) { return overlapper(rute, o); })) {
          return { x: x, y: y };
        }
      }
    }
    // Rommet er fullt -- heller stable i hjørnet enn å nekte kjøpet.
    return { x: 0, y: GULV_Y0 };
  }

  /* ---------- Tegning ---------- */

  function tegn() {
    var s = Lagring.aktiv();
    if (!s) return;

    var eid = {};
    (s.eide || []).forEach(function (e) { eid[e.ting] = (eid[e.ting] || 0) + 1; });

    var liste = $("#butikkListe");
    liste.textContent = "";
    varer.forEach(function (v) {
      var kort = lag("vare");
      var bilde = document.createElement("img");
      bilde.src = "img/mobler/" + v.id + ".png";
      bilde.alt = "";
      var navn = lag("navn"); navn.textContent = v.navn;
      var pris = lag("pris"); pris.innerHTML = v.pris + " ◉";
      var knapp = document.createElement("button");
      knapp.type = "button";
      knapp.textContent = "Kjøp";
      knapp.disabled = s.mynter < v.pris;
      knapp.onclick = function () {
        var sted = nesteLedigPlass(v);
        if (Spill.kjop(v.id, v.pris, sted.x, sted.y)) tegn();
      };
      kort.append(bilde, navn, pris, knapp);
      if (eid[v.id]) {
        var antall = lag("antall");
        antall.textContent = "Du har " + eid[v.id];
        kort.append(antall);
      }
      liste.append(kort);
    });

    $("#butikkMynter").textContent = s.mynter + " ◉";
    tegnEide(s);
  }

  function tegnEide(s) {
    var liste = $("#butikkEide");
    liste.textContent = "";
    (s.eide || []).forEach(function (e, nr) {
      var v = etterId[e.ting];
      if (!v) return;
      var rad = lag("eidRad");
      var bilde = document.createElement("img");
      bilde.src = "img/mobler/" + v.id + ".png";
      bilde.alt = "";
      var navn = lag("", "span");
      navn.textContent = v.navn;
      var selg = document.createElement("button");
      selg.type = "button";
      selg.textContent = "Selg for " + e.pris + " ◉";
      selg.onclick = function () { if (Spill.selg(nr)) tegn(); };
      rad.append(bilde, navn, selg);
      liste.append(rad);
    });
    $("#butikkEideTom").hidden = (s.eide || []).length > 0;
  }

  /* ---------- Åpne / lukke ---------- */

  function apne() {
    tegn();
    $("#hus").hidden = true;
    $("#butikk").hidden = false;
  }

  $("#lukkButikk").onclick = function () {
    $("#butikk").hidden = true;
    $("#hus").hidden = false;
    // Møbler kan ha kommet til eller gått -- rommet må tegnes på nytt.
    Hus.tegn();
  };

  global.Butikk = {
    last: function () {
      if (lasting) return lasting;
      lasting = fetch(STI)
        .then(function (r) {
          if (!r.ok) throw new Error(r.status + " " + r.statusText);
          return r.json();
        })
        .then(function (data) {
          varer = Array.isArray(data.varer) ? data.varer : [];
          etterId = {};
          varer.forEach(function (v) { etterId[v.id] = v; });
          return varer;
        })
        .catch(function () {
          varer = [];
          etterId = {};
          return varer;
        });
      return lasting;
    },
    finn: function (id) { return etterId[id] || null; },
    apne: apne,
    tegn: tegn
  };
})(window);
