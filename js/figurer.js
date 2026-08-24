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
  var KATEGORINAVN = { vanlig: "Vanlig", sjelden: "Sjelden", legendarisk: "Legendarisk", mytisk: "Mytisk", episk: "Episk", sekssju: "67", utenomjordisk: "Utenomjordisk", utrolig: "Utrolig", uknuselig: "Uknuselig", transformer: "Transformer" };

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

  // De tre punktene en kraft-aura tegnes ut fra: over hodet, og ved hver
  // skulder -- samme tre steder for alle fire kreftene, saa de ser ut som
  // varianter av samme idé, ikke fire helt urelaterte pyntedetaljer.
  var KRAFTPUNKT = [
    { x: 20, y: 3, s: 1 },
    { x: 3, y: 27, s: .72 },
    { x: 37, y: 27, s: .72 }
  ];

  // Bittesmaa flammer -- tre sirkler oppaa hverandre (moerk-lys-lysest) gir
  // en glo uten aa maatte tegne en presis flammesilhuett.
  function flammeDel(cx, cy, r, klasse) {
    return '<g class="kraft-del ' + klasse + '">' +
      '<circle cx="' + cx + '" cy="' + (cy + r * .4) + '" r="' + r + '" fill="#ff7a1a"/>' +
      '<circle cx="' + cx + '" cy="' + (cy - r * .15) + '" r="' + (r * .62) + '" fill="#ffab3d"/>' +
      '<circle cx="' + cx + '" cy="' + (cy - r * .65) + '" r="' + (r * .33) + '" fill="#ffe17a"/>' +
      '</g>';
  }

  // En dråpeform (spiss opp, rund ned), til dryppende vanndraaper.
  function dropeDel(cx, cy, r, klasse) {
    var d = "M" + cx + "," + (cy - r * 1.4) +
      "C" + (cx + r * .9) + "," + (cy - r * .5) + " " + (cx + r * .9) + "," + (cy + r * .5) + " " + cx + "," + (cy + r) +
      "C" + (cx - r * .9) + "," + (cy + r * .5) + " " + (cx - r * .9) + "," + (cy - r * .5) + " " + cx + "," + (cy - r * 1.4) + "Z";
    return '<path class="kraft-del ' + klasse + '" d="' + d + '" fill="#3ec6e0"/>';
  }

  // Et lite lyn -- en sikksakk-silhuett regnet ut fra faste punkter, saa
  // formen alltid blir riktig uansett hvor stor eller hvor den plasseres.
  function lynDel(cx, cy, s, klasse) {
    var p = [[2, -7], [-2, 1], [1, 1], [-3, 9], [4, -1], [1, -1]];
    var d = "M" + p.map(function (pt) {
      return (cx + pt[0] * s) + "," + (cy + pt[1] * s);
    }).join(" L") + "Z";
    return '<path class="kraft-del ' + klasse + '" d="' + d + '" fill="#fff275"/>';
  }

  // En buet vindstrek, som glir forbi roboten.
  function vindDel(cx, cy, lengde, klasse) {
    var d = "M" + (cx - lengde / 2) + "," + cy +
      "Q" + cx + "," + (cy - lengde * .45) + " " + (cx + lengde / 2) + "," + cy;
    return '<path class="kraft-del ' + klasse + '" d="' + d + '" fill="none" ' +
      'stroke="#e8f4ff" stroke-width="1.8" stroke-linecap="round" opacity=".85"/>';
  }

  // Uknuselige roboter har hver sin kraft -- ild, vann, lyn eller vind --
  // tegnet som en liten aura av tre deler rundt roboten (KRAFTPUNKT over).
  // css/.kraft-ild/-vann/-lyn/-vind gjoer selve bevegelsen: flammene flakker
  // i storrelse, draapene faller og forsvinner, lynet blinker ujevnt av og
  // paa, vindstrekene glir forbi. Alle tre delene bruker samme animasjon,
  // bare med litt ulik animation-delay, saa de ikke beveger seg i takt.
  var KRAFTBYGGERE = {
    ild: function (p, klasse) { return flammeDel(p.x, p.y, 4 * p.s, klasse); },
    vann: function (p, klasse) { return dropeDel(p.x, p.y, 3.2 * p.s, klasse); },
    lyn: function (p, klasse) { return lynDel(p.x, p.y, 1.3 * p.s, klasse); },
    vind: function (p, klasse) { return vindDel(p.x, p.y, 11 * p.s, klasse); }
  };

  function kraftSvg(kraft) {
    var bygg = KRAFTBYGGERE[kraft];
    if (!bygg) return "";
    var bokstav = ["a", "b", "c"];
    return '<g class="kraft kraft-' + kraft + '">' +
      KRAFTPUNKT.map(function (p, i) { return bygg(p, "kraft-del-" + bokstav[i]); }).join("") +
      "</g>";
  }

  // De fire kjoeretoeyene transformerne blir til. Samme 40x48-flate som
  // roboten selv, saa de to formene kan ligge oppaa hverandre og bytteplass
  // uten aa hoppe i storrelse. Farget etter roboten sin: karosseriet er
  // kroppsfargen, vinduene er oeyefargen -- samme figur, to skikkelser.
  var KJORETOY = {
    bil: function (f) {
      return '<rect x="4" y="26" width="32" height="10" rx="3" fill="' + f.kropp + '"/>' +
        '<path d="M10 26 L14 18 L26 18 L30 26 Z" fill="' + f.kropp + '"/>' +
        '<path d="M15.5 19.5 L24.5 19.5 L27 26 L13 26 Z" fill="' + f.oyne + '"/>' +
        '<circle cx="12" cy="37" r="4.2" fill="#20242a"/>' +
        '<circle cx="28" cy="37" r="4.2" fill="#20242a"/>' +
        '<circle cx="12" cy="37" r="1.6" fill="#8a919c"/>' +
        '<circle cx="28" cy="37" r="1.6" fill="#8a919c"/>';
    },
    fly: function (f) {
      return '<ellipse cx="19" cy="26" rx="18" ry="4.2" fill="' + f.kropp + '"/>' +
        '<path d="M17 22.5 L8 10 L19 21.5 Z" fill="' + f.kropp + '"/>' +
        '<path d="M12 28 L2 34 L13 29.5 Z" fill="' + f.kropp + '"/>' +
        '<path d="M33 22.5 L40 15 L35.5 25.5 Z" fill="' + f.kropp + '"/>' +
        '<circle cx="9" cy="26" r="2.3" fill="' + f.oyne + '"/>';
    },
    baat: function (f) {
      return '<path d="M3 33 Q19.5 43 36 33 L31 26 L8 26 Z" fill="' + f.kropp + '"/>' +
        '<rect x="14" y="16" width="13" height="10" rx="2.5" fill="' + f.kropp + '"/>' +
        '<rect x="17" y="19" width="7" height="4.5" rx="1" fill="' + f.oyne + '"/>' +
        '<line x1="20" y1="16" x2="20" y2="7" stroke="' + f.kropp + '" stroke-width="2.2" stroke-linecap="round"/>';
    },
    tog: function (f) {
      return '<rect x="4" y="19" width="30" height="18" rx="4" fill="' + f.kropp + '"/>' +
        '<rect x="6" y="10" width="11" height="10" rx="2.5" fill="' + f.kropp + '"/>' +
        '<rect x="8.3" y="12.6" width="6.4" height="5" rx=".8" fill="' + f.oyne + '"/>' +
        '<rect x="25" y="6" width="4.4" height="9" rx="1.2" fill="' + f.kropp + '"/>' +
        '<circle cx="11" cy="39" r="3.6" fill="#20242a"/>' +
        '<circle cx="20" cy="39" r="3.6" fill="#20242a"/>' +
        '<circle cx="29" cy="39" r="3.6" fill="#20242a"/>';
    }
  };

  function kjoretoySvg(f) {
    var bygg = KJORETOY[f.kjoretoy];
    return bygg ? bygg(f) : "";
  }

  // Sjeldne, legendariske og sekssju-roboter har et blinkende lys paa hodet
  // eller kroppen -- css/.blink-lys gjoer selve blinkingen (en enkel opacity-
  // animasjon), her legges bare klassen paa riktig sted. Kroppslyset er det
  // samme brystlyset alle robotene alt har -- det faar bare klassen i
  // tillegg. Hodelyset er nytt, en liten lampe oppe i hjoernet av hodet.
  //
  // Sekssju-roboten dytter i tillegg armene sine opp og ned hele tiden --
  // css/.arm-vipp gjoer selve bevegelsen, med en liten faseforskyvning
  // mellom venstre og hoeyre arm (css/.arm-vipp-b) saa de ikke gaar i takt.
  // Utenomjordiske roboter dreier hodet fram og tilbake, og skyter en
  // laserstraale ut av begge oeynene naar hodet er dreid heilt til den ene
  // siden -- css/.utenom-hode dreier gruppa, css/.utenom-laser blinker
  // straalene, begge paa samme tidslinje saa de treffer naar hodet faktisk
  // staar dreid. Straalene ligger inni samme gruppe som hodet, saa de
  // "sitter fast" ved oeynene og dreier med i stedet for aa peke rett fram
  // uansett. Fargen paa straalen er oeynefargen deres, akkurat som
  // brystlyset bruker aksentfargen.
  //
  // Utrolige roboter gjoer et helt lite triksnummer: hopper og snurrer
  // rundt (css/.utrolig-hele), og bytter saa om paa hodet og kroppen sin
  // mens de star stille paa bakken igjen (css/.utrolig-hode/.utrolig-kropp
  // -- to separate grupper som beveger seg motsatt vei av hverandre). De to
  // triksene overlapper med vilje ikke i tid: aa bytte plass midt i en
  // snurr ville bare sett ut som rot, ikke et triks.
  //
  // Bil-transformere (i dag bare Vroom) morfer i sanntid i stedet for aa
  // bytte mellom to skjulte kopier -- hver kroppsdel ER bildelen, rett foran
  // oeynene: armene glir ned og runder seg til dekk, beina blir navene inni
  // dekkene, kroppen klemmes flatere til bilkroppen, hodet flater ut til
  // taket mens ansiktet vokser til vinduet inni det, og de to antenne-
  // piggene paa hodet glir ned og smelter sammen til én sort eksospotte
  // bak paa bilen -- de animerer begge til NOEYAKTIG samme posisjon og
  // storrelse, saa de to blir ett og samme synlige objekt naar de moetes.
  // Formen paa hver del (posisjon, storrelse, avrunding, og for hode/oeyne
  // ogsaa en clip-path som skjaerer til trapesform) animeres direkte -- se
  // @keyframes morph* i styles.css. Krever at nettleseren stoetter
  // x/y/width/height/rx som CSS-animerbare egenskaper paa SVG-figurer
  // (Chrome/Safari stoetter dette, men eldre nettlesere viser bare
  // robotformen stille -- se grunnverdiene i .morph-bil sine CSS-regler).
  //
  // Antennen tegnes her som to tynne, rette pigger (ikke de vinklede
  // linjene antenneSvg() lager for "pigger"-stilen andre steder) -- rette
  // rektangler er det som faktisk kan CSS-animeres til en annen posisjon
  // og storrelse, en vinklet linje kan ikke det paa samme vis.
  //
  // Bare "visir"-ansikt er stoettet her (Vroom sitt) -- et rundt eller
  // firkantet ansikt ville trengt sin egen vindu-morf. Andre bil-
  // transformere faller tilbake til den vanlige bytte-fade-oppfoerselen til
  // det evt. bygges.
  function bilMorphSvg(f) {
    var armFarge = f.armer || f.kropp;
    var beinFarge = f.bein || f.hode;
    var kroppslysKlasse = "morph-fade" + (f.blink === "kropp" ? " blink-lys" : "");
    var hodelys = f.blink === "hode"
      ? '<circle class="morph-fade blink-lys" cx="28" cy="11" r="2" fill="' + f.aksent + '"/>'
      : "";
    return '<svg viewBox="0 0 40 48" aria-hidden="true" class="morph-bil">' +
      hodelys +
      '<rect class="morph-hode" fill="' + f.hode + '"/>' +
      '<rect class="morph-oyne" fill="' + f.oyne + '"/>' +
      '<rect class="morph-kropp" fill="' + f.kropp + '"/>' +
      '<circle class="' + kroppslysKlasse + '" cx="20" cy="35" r="3.6" fill="' + f.aksent + '"/>' +
      '<rect class="morph-arm-v" fill="' + armFarge + '"/>' +
      '<rect class="morph-arm-h" fill="' + armFarge + '"/>' +
      '<rect class="morph-bein-v" fill="' + beinFarge + '"/>' +
      '<rect class="morph-bein-h" fill="' + beinFarge + '"/>' +
      '<rect class="morph-antenne-v" fill="' + f.hode + '"/>' +
      '<rect class="morph-antenne-h" fill="' + f.hode + '"/>' +
      '</svg>';
  }

  // Andre transformere (fly/baat/tog) krymper seg fortsatt bort og vokser
  // fram som kjoeretoeyet sitt, og saa tilbake igjen -- css/.transformer-robot
  // og .transformer-kjoretoy ligger paa noeyaktig samme sted, med motsatt
  // fase, saa naar den ene forsvinner dukker den andre opp. Selve
  // flikkingen (css/.glitch) er den samme som de episke robotene bruker,
  // satt paa fra samling.js siden den ligger paa selve ikon-elementet, ikke
  // inni SVG-en -- se der.
  function robotSvg(f) {
    if (f.kategori === "transformer" && f.kjoretoy === "bil" && f.ansikt === "visir") {
      return bilMorphSvg(f);
    }

    var hodelys = f.blink === "hode"
      ? '<circle cx="28" cy="11" r="2" class="blink-lys" fill="' + f.aksent + '"/>'
      : "";
    var kroppslysKlasse = f.blink === "kropp" ? ' class="blink-lys"' : "";
    var vipper = f.kategori === "sekssju";
    var armVKlasse = vipper ? ' class="arm-vipp"' : "";
    var armHKlasse = vipper ? ' class="arm-vipp arm-vipp-b"' : "";

    var hodeInnhold = antenneSvg(f) +
      '<rect x="9" y="8" width="22" height="16" rx="6" fill="' + f.hode + '"/>' +
      ansiktSvg(f) +
      hodelys;

    // armer/bein: valgfrie -- de fleste roboter setter dem aldri, og arver da
    // den gamle oppfoerselen (armer i kroppsfargen, bein i hodefargen)
    // akkurat som foer disse feltene fantes. Vroom er foerste robot som
    // skiller dem ut, se bilMorphSvg() under.
    var armFarge = f.armer || f.kropp;
    var beinFarge = f.bein || f.hode;
    var kroppInnhold =
      '<rect x="1" y="29" width="6" height="10" rx="3" fill="' + armFarge + '"' + armVKlasse + '/>' +
      '<rect x="33" y="29" width="6" height="10" rx="3" fill="' + armFarge + '"' + armHKlasse + '/>' +
      '<rect x="6" y="26" width="28" height="18" rx="7" fill="' + f.kropp + '"/>' +
      '<circle cx="20" cy="35" r="3.6" fill="' + f.aksent + '"' + kroppslysKlasse + '/>' +
      '<rect x="12" y="44" width="6" height="4" rx="2" fill="' + beinFarge + '"/>' +
      '<rect x="22" y="44" width="6" height="4" rx="2" fill="' + beinFarge + '"/>';

    if (f.kategori === "utrolig") {
      return '<svg viewBox="0 0 40 48" aria-hidden="true"><g class="utrolig-hele">' +
        '<g class="utrolig-hode">' + hodeInnhold + '</g>' +
        '<g class="utrolig-kropp">' + kroppInnhold + '</g>' +
        '</g></svg>';
    }

    if (f.kategori === "transformer") {
      return '<svg viewBox="0 0 40 48" aria-hidden="true">' +
        '<g class="transformer-robot">' + hodeInnhold + kroppInnhold + '</g>' +
        '<g class="transformer-kjoretoy">' + kjoretoySvg(f) + '</g>' +
        '</svg>';
    }

    var hode = f.kategori === "utenomjordisk"
      ? '<g class="utenom-hode">' + hodeInnhold +
        '<line x1="15" y1="17.5" x2="3" y2="2" stroke="' + f.oyne + '" stroke-width="2.4" ' +
        'stroke-linecap="round" class="utenom-laser"/>' +
        '<line x1="25" y1="17.5" x2="37" y2="2" stroke="' + f.oyne + '" stroke-width="2.4" ' +
        'stroke-linecap="round" class="utenom-laser"/></g>'
      : hodeInnhold;

    return '<svg viewBox="0 0 40 48" aria-hidden="true">' +
      hode +
      kroppInnhold +
      kraftSvg(f.kraft) +
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
