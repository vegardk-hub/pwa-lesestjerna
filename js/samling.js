/* Samlingen: der han ser igjen robotene han har kjøpt.
 *
 * Butikken selger, denne fila viser fram. Et rutenett av de han eier, og
 * trykker han på en, blir den stor -- det er poenget med å samle på dem:
 * han skal kunne se på den ene han er mest glad i, ikke bare telle antall.
 *
 * Kategorien styrer hva som skjer i den store visningen:
 *   vanlig       -- trykk gir lyd (Robotlyd.spill)
 *   sjelden      -- samme lyd, pluss blinkende lys (tegnet i figurer.js)
 *   legendarisk  -- blinkende lys, og trykk gir en frase med robotstemme
 *   mytisk       -- ingen lyd/frase -- to knapper for eget opptak i stedet
 *   episk        -- glitcher hele tiden (css/.glitch), og trykk gir en
 *                   skummel robotlyd
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
      var kort = lag("figurkort " + v.kategori, "button");
      kort.type = "button";
      var merke = lag("merke-kategori");
      merke.textContent = Figurer.kategorinavn(v.kategori);
      var ikon = lag("figur-ikon");
      ikon.innerHTML = Figurer.svg(v.id);
      var navn = lag("navn");
      navn.textContent = v.navn;
      kort.append(merke, ikon, navn);
      kort.onclick = function () { visDetalj(v); };
      liste.append(kort);
    });
    $("#samlingTom").hidden = (s.eide || []).length > 0;
  }

  // Det roboten gjoer naar han trykker paa den -- forskjellig etter
  // kategori. Mytiske roboter har ingen reaksjon her, de styres av
  // opptaksknappene i settOppOpptak() i stedet.
  function reager(v) {
    if (v.kategori === "mytisk") return;
    Robotlyd.spill(v.id);
    if (v.kategori === "legendarisk" && v.frase) {
      setTimeout(function () { Robotlyd.si(v.frase); }, 450);
    }
  }

  function visDetalj(v) {
    var ikon = $("#samlingDetaljIkon");
    ikon.innerHTML = Figurer.svg(v.id);
    ikon.classList.toggle("glitch", v.kategori === "episk");
    ikon.onclick = function () { reager(v); };
    $("#samlingDetaljNavn").textContent = v.navn;
    $("#samlingListe").hidden = true;
    $("#samlingTom").hidden = true;
    $("#samlingDetalj").hidden = false;

    var hint = $("#samlingDetaljHint");
    var opptakBoks = $("#samlingOpptak");
    if (v.kategori === "mytisk") {
      hint.hidden = true;
      opptakBoks.hidden = false;
      settOppOpptak(v);
    } else {
      opptakBoks.hidden = true;
      hint.hidden = false;
      hint.textContent = v.kategori === "legendarisk"
        ? "Trykk på roboten for å høre den snakke igjen."
        : "Trykk på roboten for å høre lyden igjen.";
    }

    reager(v);
  }

  /* ---------- Opptak (mytiske roboter) ---------- */

  function settOppOpptak(v) {
    var taOpp = $("#taOpp");
    var spillAv = $("#spillOpptak");
    var status = $("#opptakStatus");

    Opptak.stopp();
    taOpp.classList.remove("tar-opp");
    taOpp.disabled = !Opptak.stoettes;
    taOpp.textContent = "🔴 Ta opp (10 sek)";

    var lagret = Lagring.hentOpptak(v.id);
    spillAv.disabled = !lagret;
    status.textContent = !Opptak.stoettes
      ? "Denne nettleseren støtter ikke opptak."
      : lagret ? "Du har et opptak liggende." : "Ingen opptak ennå.";

    taOpp.onclick = function () {
      taOpp.disabled = true;
      taOpp.classList.add("tar-opp");
      taOpp.textContent = "● Tar opp …";
      status.textContent = "Snakk nå!";
      Opptak.start(function (blob) {
        taOpp.classList.remove("tar-opp");
        taOpp.textContent = "🔴 Ta opp (10 sek)";
        taOpp.disabled = false;
        Opptak.blobTilURL(blob).then(function (url) {
          Lagring.lagreOpptak(v.id, url);
          spillAv.disabled = false;
          status.textContent = "Opptak lagret!";
        });
      }, function (feilmelding) {
        taOpp.classList.remove("tar-opp");
        taOpp.textContent = "🔴 Ta opp (10 sek)";
        taOpp.disabled = false;
        status.textContent = feilmelding;
      });
    };

    spillAv.onclick = function () {
      var url = Lagring.hentOpptak(v.id);
      if (url) new Audio(url).play();
    };
  }

  function lukkDetalj() {
    Opptak.stopp();
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
    Opptak.stopp();
    $("#samling").hidden = true;
    $("#hus").hidden = false;
  };

  global.Samling = {
    apne: apne
  };
})(window);
