/* Huset: det foerste han ser naar han logger seg paa.
 *
 * Huset er grunnen til at han leser. Derfor er dette startskjermen, ikke en
 * premie paa slutten -- han skal se hjemmet sitt foerst, og gaa ut derfra for
 * aa tjene til det.
 *
 * Fire kort, ett trykk hver: gaa ut og les, boka, butikken, samlingen. Det
 * gamle rommet med figur og doer i et bilde saa daarlig ut og fungerte
 * daarlig -- dette er rett og slett enklere aa forstaa og finere aa se paa.
 */
(function (global) {
  "use strict";

  var $ = function (v) { return document.querySelector(v); };

  // Fire ikoner, tegnet i samme flate stil som resten av appen -- ett per
  // kort, satt inn én gang siden de aldri forandrer seg.
  var IKONER = {
    ut: '<path fill="currentColor" d="M13 5h16a2 2 0 0 1 2 2v34a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><circle cx="26.5" cy="24" r="2.1" fill="#fff"/>',
    bok: '<rect fill="currentColor" x="10" y="6" width="28" height="36" rx="3"/><rect fill="currentColor" opacity=".55" x="10" y="6" width="7.5" height="36" rx="3"/><rect fill="#fff" opacity=".85" x="21" y="15" width="12" height="3" rx="1.5"/><rect fill="#fff" opacity=".85" x="21" y="22" width="12" height="3" rx="1.5"/><rect fill="#fff" opacity=".85" x="21" y="29" width="8.5" height="3" rx="1.5"/>',
    butikk: '<path fill="currentColor" d="M14 16 17 8h14l3 8h6a1 1 0 0 1 1 1l-2.4 21a3 3 0 0 1-3 2.7H12.4a3 3 0 0 1-3-2.7L7 17a1 1 0 0 1 1-1h6Z"/><path fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" d="M18 20v2a6 6 0 0 0 12 0v-2"/>',
    samling: '<line x1="24" y1="6" x2="24" y2="14" stroke="currentColor" stroke-width="2.6"/><circle cx="24" cy="5" r="3.6" fill="currentColor"/><rect fill="currentColor" x="10" y="14" width="28" height="21" rx="8"/><circle cx="18" cy="24.5" r="3.1" fill="#fff"/><circle cx="30" cy="24.5" r="3.1" fill="#fff"/><rect fill="currentColor" x="15.5" y="35" width="7" height="5.5" rx="2.2"/><rect fill="currentColor" x="25.5" y="35" width="7" height="5.5" rx="2.2"/>'
  };

  function settIkon(kort, ikon) {
    var el = document.querySelector("#" + kort + " .huskort-ikon");
    el.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true">' + IKONER[ikon] + "</svg>";
  }
  settIkon("utOgLes", "ut");
  settIkon("apneBoka", "bok");
  settIkon("apneButikk", "butikk");
  settIkon("apneSamling", "samling");

  /* ---------- Huset ---------- */

  function tegn() {
    var s = Lagring.aktiv();
    if (!s) return;

    $("#husnavn").textContent = "Hjemme hos " + s.navn;
    $("#bokKortNavn").textContent = s.navn + " sin bok";

    var neste = Spill.tilNesteBok(s);
    $("#hushint").textContent = neste
      ? (neste.mangler
          ? neste.mangler + " ord igjen til bok nummer " + neste.nr + "."
          : "Bok nummer " + neste.nr + " er klar!")
      : "";
  }

  /* ---------- Boka paa bordet ----------
   * Ingen dag-for-dag-graf her -- en rekke som kan brytes er en maate aa
   * tape paa, og det skal ikke finnes i denne boka. Hvert tall har i stedet
   * et lite ikon som viser hva slags ting det er, saa siden blir noe han
   * har lyst til aa se paa, ikke bare en tabell.
   */

  var BOKA_IKONER = {
    ord: '<path fill="currentColor" d="M12 3.5C6.98 3.5 3 6.9 3 11c0 2.36 1.34 4.46 3.44 5.82-.1.98-.46 2.2-1.28 3.3a.5.5 0 0 0 .58.77c1.7-.53 3.02-1.34 3.9-1.98.76.14 1.55.21 2.36.21 5.02 0 9-3.4 9-7.5s-3.98-7.5-9-7.5Z"/>',
    stjerner: '<path fill="currentColor" d="M12 2.9l2.7 5.6 6.15.87-4.45 4.34 1.05 6.13L12 16.85l-5.45 2.99 1.05-6.13-4.45-4.34 6.15-.87L12 2.9Z"/>',
    tekster: '<path fill="currentColor" opacity=".55" d="M9 3h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-1V7a2 2 0 0 0-2-2H9V3Z"/><rect fill="currentColor" x="4" y="6" width="12" height="15" rx="2"/>',
    boker: '<rect fill="currentColor" x="6" y="3" width="12" height="18" rx="1.5"/><rect fill="currentColor" opacity=".55" x="6" y="3" width="3.4" height="18" rx="1.5"/><rect fill="#fff" opacity=".85" x="11.3" y="6.6" width="5" height="1.4" rx=".7"/><rect fill="#fff" opacity=".85" x="11.3" y="10.1" width="5" height="1.4" rx=".7"/><rect fill="#fff" opacity=".85" x="11.3" y="13.6" width="3.6" height="1.4" rx=".7"/>',
    level: '<path fill="currentColor" d="M12 2.2 4.5 5v5.8c0 5.1 3.2 8.9 7.5 11 4.3-2.1 7.5-5.9 7.5-11V5L12 2.2Z"/>',
    mynter: '<circle cx="12" cy="12" r="9" fill="currentColor"/><circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.5"/><path fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="1.6" stroke-linecap="round" d="M9.6 15c0 1 1.07 1.6 2.4 1.6s2.4-.6 2.4-1.6-1.07-1.4-2.4-1.6-2.4-.6-2.4-1.6 1.07-1.6 2.4-1.6 2.4.6 2.4 1.6"/><line x1="12" y1="6.8" x2="12" y2="17.2" stroke="#fff" stroke-opacity=".9" stroke-width="1.6" stroke-linecap="round"/>'
  };

  function lag(klasse, tag) {
    var d = document.createElement(tag || "div");
    if (klasse) d.className = klasse;
    return d;
  }

  function tall(ikon, merke, verdi) {
    var d = lag("tall");
    d.innerHTML =
      '<span class="ikon ' + ikon + '"><svg viewBox="0 0 24 24">' + BOKA_IKONER[ikon] + "</svg></span>" +
      "<b>" + verdi + "</b><span class=\"merke\">" + merke + "</span>";
    return d;
  }

  function apneBoka() {
    var st = Spill.statistikk();
    if (!st) return;

    $("#bokaTittel").textContent = st.navn + " sin lesebok";

    var boks = $("#bokaTall");
    boks.textContent = "";
    boks.append(
      tall("ord", "ord lest", st.ord),
      tall("stjerner", st.setninger === 1 ? "stjerne" : "stjerner", st.setninger),
      tall("tekster", st.tekster === 1 ? "tekst" : "tekster", st.tekster),
      tall("boker", st.boker === 1 ? "bok" : "bøker", st.boker),
      tall("level", "level", st.level),
      tall("mynter", "mynter", st.mynter)
    );

    var linjer = [st.dager + (st.dager === 1 ? " dag" : " dager") + " med lesing"];
    if (st.tilNesteBok && st.tilNesteBok.mangler) {
      linjer.push(st.tilNesteBok.mangler + " ord igjen til bok nummer " + st.tilNesteBok.nr);
    }
    if (st.gjenlesinger) {
      linjer.push(st.gjenlesinger +
                  (st.gjenlesinger === 1 ? " tekst" : " tekster") + " lest om igjen");
    }
    $("#bokaBunn").textContent = linjer.join(" · ");

    // Boka legges over huskortene, ikke under dem. Han aapner den bare
    // herfra, saa veien tilbake er alltid den samme.
    $("#hus").hidden = true;
    $("#boka").hidden = false;
  }

  $("#lukkBoka").onclick = function () {
    $("#boka").hidden = true;
    $("#hus").hidden = false;
  };

  global.Hus = {
    tegn: tegn,
    apneBoka: apneBoka
  };
})(window);
