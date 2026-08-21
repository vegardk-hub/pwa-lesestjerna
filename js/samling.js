/* Samlingen: der han ser igjen robotene han har kjøpt.
 *
 * Butikken selger, denne fila viser fram. Et rutenett av de han eier, og
 * trykker han på en, blir den stor -- det er poenget med å samle på dem:
 * han skal kunne se på den ene han er mest glad i, ikke bare telle antall.
 */
(function (global) {
  "use strict";

  var $ = function (v) { return document.querySelector(v); };

  function lag(klasse, tag) {
    var d = document.createElement(tag || "div");
    if (klasse) d.className = klasse;
    return d;
  }

  function tegnListe() {
    var s = Lagring.aktiv();
    if (!s) return;

    var liste = $("#samlingListe");
    liste.hidden = false;
    liste.textContent = "";
    (s.eide || []).forEach(function (e) {
      var v = Figurer.finn(e.ting);
      if (!v) return;
      var kort = lag("figurkort", "button");
      kort.type = "button";
      var ikon = lag("figur-ikon");
      ikon.innerHTML = Figurer.svg(v.id);
      var navn = lag("navn");
      navn.textContent = v.navn;
      kort.append(ikon, navn);
      kort.onclick = function () { visDetalj(v); };
      liste.append(kort);
    });
    $("#samlingTom").hidden = (s.eide || []).length > 0;
  }

  function visDetalj(v) {
    var ikon = $("#samlingDetaljIkon");
    ikon.innerHTML = Figurer.svg(v.id);
    $("#samlingDetaljNavn").textContent = v.navn;
    $("#samlingListe").hidden = true;
    $("#samlingTom").hidden = true;
    $("#samlingDetalj").hidden = false;
  }

  function lukkDetalj() {
    $("#samlingDetalj").hidden = true;
    tegnListe();
  }

  function apne() {
    tegnListe();
    $("#samlingDetalj").hidden = true;
    $("#hus").hidden = true;
    $("#samling").hidden = false;
  }

  $("#lukkSamlingDetalj").onclick = lukkDetalj;

  $("#lukkSamling").onclick = function () {
    $("#samling").hidden = true;
    $("#hus").hidden = false;
  };

  global.Samling = {
    apne: apne
  };
})(window);
