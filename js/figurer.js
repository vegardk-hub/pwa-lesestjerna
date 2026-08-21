/* Robotsamlingen: katalogen over kjøpbare figurer, og tegningen av dem.
 *
 * Ingen av robotene er bilder -- de er tegnet som SVG her, ut fra fargene og
 * formvalgene i data/figurer.json. Det gjør at en ny robot er noen linjer i
 * en json-fil, ikke et bilde som må lages og klippes til.
 *
 * Butikken (butikk.js) og samlingen (samling.js) bruker begge Figurer.svg()
 * til å tegne akkurat samme robot -- den han ser i butikken er den han får.
 */
(function (global) {
  "use strict";

  var STI = "data/figurer.json";

  var alle = [];
  var etterId = {};
  var lasting = null;

  // Teksten paa kortet i butikken og samlingen -- se BAKGRUNNSFARGE i
  // styles.css (.vare/.figurkort + kategorinavnet som klasse) for selve
  // fargen. Ukjent/manglende kategori telles som vanlig.
  var KATEGORINAVN = { vanlig: "Vanlig", sjelden: "Sjelden", legendarisk: "Legendarisk", mytisk: "Mytisk" };

  function antenneSvg(f) {
    if (f.antenne === "kule") {
      return '<line x1="20" y1="4" x2="20" y2="10" stroke="' + f.hode + '" stroke-width="2"/>' +
             '<circle cx="20" cy="3" r="3" fill="' + f.aksent + '"/>';
    }
    if (f.antenne === "skaal") {
      return '<line x1="20" y1="4" x2="20" y2="10" stroke="' + f.hode + '" stroke-width="2"/>' +
             '<path d="M14 4a6 3 0 0 1 12 0" fill="none" stroke="' + f.aksent + '" stroke-width="2"/>';
    }
    // "pigger"
    return '<line x1="14" y1="6" x2="11" y2="0.5" stroke="' + f.hode + '" stroke-width="2" stroke-linecap="round"/>' +
           '<line x1="26" y1="6" x2="29" y2="0.5" stroke="' + f.hode + '" stroke-width="2" stroke-linecap="round"/>';
  }

  function ansiktSvg(f) {
    if (f.ansikt === "rund") {
      return '<circle cx="16" cy="18" r="2.4" fill="' + f.oyne + '"/>' +
             '<circle cx="24" cy="18" r="2.4" fill="' + f.oyne + '"/>';
    }
    if (f.ansikt === "visir") {
      return '<rect x="12.5" y="15.5" width="15" height="5" rx="2.5" fill="' + f.oyne + '"/>';
    }
    // "firkant"
    return '<rect x="13.5" y="15.5" width="4.5" height="4.5" rx=".8" fill="' + f.oyne + '"/>' +
           '<rect x="22" y="15.5" width="4.5" height="4.5" rx=".8" fill="' + f.oyne + '"/>';
  }

  // Sjeldne og legendariske roboter har et blinkende lys paa hodet eller
  // kroppen -- css/.blink-lys gjoer selve blinkingen (en enkel opacity-
  // animasjon), her legges bare klassen paa riktig sted. Kroppslyset er det
  // samme brystlyset alle robotene alt har -- det faar bare klassen i
  // tillegg. Hodelyset er nytt, en liten lampe oppe i hjoernet av hodet.
  function robotSvg(f) {
    var hodelys = f.blink === "hode"
      ? '<circle cx="28" cy="11" r="2" class="blink-lys" fill="' + f.aksent + '"/>'
      : "";
    var kroppslysKlasse = f.blink === "kropp" ? ' class="blink-lys"' : "";

    return '<svg viewBox="0 0 40 48" aria-hidden="true">' +
      antenneSvg(f) +
      '<rect x="9" y="8" width="22" height="16" rx="6" fill="' + f.hode + '"/>' +
      ansiktSvg(f) +
      hodelys +
      '<rect x="1" y="29" width="6" height="10" rx="3" fill="' + f.kropp + '"/>' +
      '<rect x="33" y="29" width="6" height="10" rx="3" fill="' + f.kropp + '"/>' +
      '<rect x="6" y="26" width="28" height="18" rx="7" fill="' + f.kropp + '"/>' +
      '<circle cx="20" cy="35" r="3.6" fill="' + f.aksent + '"' + kroppslysKlasse + '/>' +
      '<rect x="12" y="44" width="6" height="4" rx="2" fill="' + f.hode + '"/>' +
      '<rect x="22" y="44" width="6" height="4" rx="2" fill="' + f.hode + '"/>' +
      "</svg>";
  }

  global.Figurer = {
    last: function () {
      if (lasting) return lasting;
      lasting = fetch(STI)
        .then(function (r) {
          if (!r.ok) throw new Error(r.status + " " + r.statusText);
          return r.json();
        })
        .then(function (data) {
          alle = Array.isArray(data.figurer) ? data.figurer : [];
          etterId = {};
          alle.forEach(function (f) { etterId[f.id] = f; });
          return alle;
        })
        .catch(function () {
          alle = [];
          etterId = {};
          return alle;
        });
      return lasting;
    },
    alle: function () { return alle; },
    finn: function (id) { return etterId[id] || null; },
    svg: function (id) {
      var f = etterId[id];
      return f ? robotSvg(f) : "";
    },
    kategorinavn: function (kategori) { return KATEGORINAVN[kategori] || KATEGORINAVN.vanlig; }
  };
})(window);
