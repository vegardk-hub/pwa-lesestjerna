/* Les fritt: teller ord i hva han enn leser hoeyt -- en bok fra hylla, en
 * avis, eller bare noe han finner paa aa fortelle. Ingen bestemt tekst aa
 * matche mot, saa ingen ord lyser groent og ingen stjerner deles ut. Han
 * trykker "Ferdig" naar han er ferdig, og faar da vite hvor mange ord han
 * leste og hvor mange mynter det ble til.
 *
 * Laaner Stemme.lytter -- den samme motoren (nettleseren eller Whisper,
 * uansett hva som er valgt i Foreldrekontroll) som resten av appen bruker,
 * i stedet for aa bygge en egen taleoppdagelse. Det er rett og slett den
 * beste motoren tilgjengelig for aa oppdage ord: den er allerede bygget
 * for norsk barnetale, allerede herdet mot Safari sine restart-luner (se
 * js/lyttemotor-nettleser.js), og betyr at "les fritt" arver enhver
 * framtidig forbedring i selve gjenkjenningen gratis.
 *
 * Kobler seg til de samme fire hookene (paaResultat/paaFeil/paaStatus/
 * paaTilstand) som js/lesing.js bruker -- de to skjermene deler ett sett
 * med hooks paa Stemme.lytter, og den som starter sist "eier" dem. Se
 * kobleTilStemme() i lesing.js for den andre halvparten av dette.
 *
 * Telling: bare ENDELIGE resultater telles (midlertidige gjetninger blir
 * ofte omgjort naar gjenkjenneren hoerer mer, og ville dobbelttalt ord).
 * Nettlesermotoren kan foreslaa flere ALTERNATIVE tolkninger av samme
 * lydklipp -- bare den beste (kandidat nummer én) telles, ikke alle
 * sammen, ellers ville samme setning blitt talt flere ganger.
 */
(function (global) {
  "use strict";

  var $ = function (v) { return document.querySelector(v); };

  var totalOrd = 0;

  function tellOrd(tekst) {
    if (!tekst) return;
    var ord = tekst.trim().split(/\s+/).filter(Boolean);
    totalOrd += ord.length;
  }

  function beskjed(t, feil) {
    $("#friLesingBeskjed").textContent = t || "";
    $("#friLesingBeskjed").classList.toggle("feil", !!feil);
  }

  function kobleTilStemme() {
    Stemme.lytter.paaResultat = function (kandidater, endelig) {
      if (!endelig) return;
      tellOrd(kandidater[0]);
    };
    Stemme.lytter.paaFeil = function (kode, forklaring) { beskjed(forklaring, true); };
    Stemme.lytter.paaStatus = function (tekst) { beskjed(tekst, false); };
    Stemme.lytter.paaTilstand = function (paa) {
      if (paa) beskjed("Les høyt, du!");
    };
  }

  function start() {
    totalOrd = 0;
    beskjed("");
    $("#friLesingFoer").hidden = false;
    $("#friLesingEtter").hidden = true;

    kobleTilStemme();
    if (Stemme.lytter.stoettes) {
      Stemme.lytter.start();
    } else {
      beskjed("Denne nettleseren kan ikke lytte. Prøv en annen nettleser.", true);
    }
  }

  function stopp() {
    Stemme.lytter.stopp();
    Stemme.stille();
  }

  $("#friLesingFerdig").onclick = function () {
    stopp();

    var r = Spill.betalFriLesing(totalOrd);

    $("#friLesingFoer").hidden = true;
    $("#friLesingEtter").hidden = false;
    $("#friLesingTall").textContent =
      totalOrd + (totalOrd === 1 ? " ord lest" : " ord lest") + " · +" + r.mynter + " mynter";
    $("#friLesingEkstra").textContent = r.nyeBoker
      ? "Du fylte en hel bok — du er level " + r.level + " nå!"
      : (r.tilNesteBok && r.tilNesteBok.mangler
          ? r.tilNesteBok.mangler + " ord igjen til bok nummer " + r.tilNesteBok.nr + "."
          : "");
  };

  global.FriLesing = {
    start: start,
    stopp: stopp
  };
})(window);
