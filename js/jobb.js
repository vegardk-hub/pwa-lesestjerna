/* Robotfabrikken: der robotene han eier staar og jobber mens appen er
 * lukket, og legger opp mynter han henter ved aa trykke paa dem.
 *
 * Selve regnestykket eier js/spill.js (Spill.jobbStatus/hentJobb) -- denne
 * fila vet bare hvordan en fabrikk ser ut. Det er samme arbeidsdeling som
 * ellers i appen: oekonomien kan proeves uten grafikk, og fabrikken kan
 * bygges om uten aa roere oekonomien.
 *
 * Hver robot faar en jobb valgt fast ut fra id-en sin (se velgJobb under),
 * ikke tilfeldig per besoek -- Blikkis skal staa og hamre hver gang han
 * kommer innom, ellers er det ikke Blikkis sin arbeidsplass. Robotene
 * beholder samtidig sine egne kategori-animasjoner (glitch, forvandling,
 * laserblikk): det er HANS roboter som jobber, ikke anonyme arbeidere.
 *
 * Fasen paa jobbe-animasjonen settes per robot (ogsaa fra id-en), slik at
 * de ikke hamrer i takt som et maskineri -- en hall der alle beveger seg
 * synkront ser ut som en feil, ikke som liv.
 */
(function (global) {
  "use strict";

  var $ = function (v) { return document.querySelector(v); };

  /* ---------- Verktoeyene ----------
   * Tegnet i samme flate stil som resten av appen, i en 24x24-rute.
   * Bevegelsen ligger i styles.css (.jobb-verktoy.<jobb>), ikke her. */

  var VERKTOY = {
    // Hammer: slaar ned mot benken.
    hammer:
      '<rect x="10.6" y="6" width="2.8" height="16" rx="1.2" fill="#8a6640"/>' +
      '<rect x="4.5" y="2.5" width="15" height="6" rx="1.6" fill="#6b727a"/>' +
      '<rect x="4.5" y="2.5" width="15" height="2.4" rx="1.2" fill="#9aa3ad"/>',
    // Skrutrekker: snurrer rundt sin egen akse.
    skrue:
      '<rect x="8.4" y="2" width="7.2" height="11" rx="2.6" fill="#b3261e"/>' +
      '<rect x="9.8" y="3.4" width="1.6" height="8" rx=".8" fill="#d4584f"/>' +
      '<rect x="10.6" y="12" width="2.8" height="7" fill="#9aa3ad"/>' +
      '<path d="M10.2 18.5h3.6L12 22.5Z" fill="#6b727a"/>',
    // Sveisebrenner med en gnist som spruter.
    sveis:
      '<rect x="9" y="9" width="6" height="13" rx="1.6" fill="#3d6fb4"/>' +
      '<path d="M10.5 9 12 4l1.5 5Z" fill="#9aa3ad"/>' +
      '<circle class="jobb-gnist" cx="12" cy="3" r="2.6" fill="#f2b705"/>',
    // En kasse som loeftes opp og ned.
    kasse:
      '<rect x="4" y="9" width="16" height="12" rx="1.6" fill="#c2873f"/>' +
      '<rect x="4" y="13.4" width="16" height="2" fill="#a06e2e"/>' +
      '<rect x="10.8" y="9" width="2.4" height="12" fill="#a06e2e"/>',
    // Et tannhjul som gaar rundt.
    tannhjul:
      '<g fill="#6b727a">' +
      [0, 45, 90, 135].map(function (v) {
        return '<rect x="10.6" y="1.6" width="2.8" height="20.8" rx="1" ' +
               'transform="rotate(' + v + ' 12 12)"/>';
      }).join("") +
      '<circle cx="12" cy="12" r="7"/></g>' +
      '<circle cx="12" cy="12" r="2.8" fill="#fff"/>'
  };

  var JOBBER = ["hammer", "skrue", "sveis", "kasse", "tannhjul"];

  // Et lite, stabilt tall ut fra id-en. Samme robot gir alltid samme tall,
  // ogsaa etter at appen er lukket og aapnet igjen -- derfor id og ikke
  // Math.random().
  function tallFraId(id) {
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    // Blander bitene godt foer de brukes. Uten dette blir fordelingen paa
    // fem jobber merkbart skjev (hammeren havnet paa bare 6 av 52 roboter),
    // fordi navnene ligner hverandre for mye i lengde og bokstaver.
    h ^= h >>> 15; h = (h * 2246822507) | 0;
    h ^= h >>> 13; h = (h * 3266489909) | 0;
    return Math.abs(h ^ (h >>> 16));
  }

  function velgJobb(id) { return JOBBER[tallFraId(id) % JOBBER.length]; }

  function lag(klasse, tag) {
    var d = document.createElement(tag || "span");
    if (klasse) d.className = klasse;
    return d;
  }

  var paaEndret = null;  // settes av app.js: myntsummen er endret

  /* ---------- Én arbeidsplass ---------- */

  function plass(figur, pris) {
    var st = Spill.jobbStatus(figur.id, pris);
    if (!st) return null;

    var jobb = velgJobb(figur.id);
    var knapp = lag("jobb-plass " + figur.kategori +
                    (st.mynter > 0 ? " har-mynt" : "") +
                    (st.full ? " full" : ""), "button");
    knapp.type = "button";

    // Myntboblen henger over roboten, og finnes bare naar det faktisk er
    // noe aa hente -- en boble som sier "0" ville bare vaert stoey.
    if (st.mynter > 0) {
      var boble = lag("jobb-boble");
      boble.textContent = "+" + st.mynter + " ◉";
      knapp.append(boble);
    }

    var scene = lag("jobb-scene");
    var robot = lag("jobb-robot");
    robot.innerHTML = Figurer.svg(figur.id);
    var verktoy = lag("jobb-verktoy " + jobb);
    verktoy.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                        VERKTOY[jobb] + "</svg>";

    // Egen fase per robot, saa hallen ikke beveger seg i takt. Negativ
    // forsinkelse starter animasjonen et stykke uti i stedet for aa vente.
    var fase = "-" + (tallFraId(figur.id) % 1400) / 1000 + "s";
    robot.style.animationDelay = fase;
    verktoy.style.animationDelay = fase;

    scene.append(robot, verktoy);

    var benk = lag("jobb-benk");
    var navn = lag("jobb-navn");
    navn.textContent = figur.navn;

    // Stolpa viser hvor langt roboten er mot taket sitt -- det er den som
    // forklarer hvorfor en full robot slutter aa tjene, uten at det staar
    // en regel noe sted han maa lese.
    var stolpe = lag("jobb-stolpe");
    var fyll = lag("jobb-fyll");
    fyll.style.width = Math.round(st.andel * 100) + "%";
    stolpe.append(fyll);

    var under = lag("jobb-under");
    under.textContent = st.full
      ? "Ferdig — venter på deg"
      : (st.mynter > 0 ? "Trykk for å hente" : "Jobber …");

    knapp.append(scene, benk, navn, stolpe, under);
    knapp.setAttribute("aria-label", figur.navn + ", " +
      (st.mynter > 0 ? st.mynter + " mynter klare til henting" : "jobber"));

    knapp.onclick = function () { hent(figur, pris, knapp); };
    return knapp;
  }

  /* ---------- Henting ---------- */

  function hent(figur, pris, knapp) {
    var fikk = Spill.hentJobb(figur.id, pris);

    // Ingenting aa hente ennaa: roboten svarer likevel med lyden sin, saa
    // et trykk aldri foeles som at ingenting skjedde.
    Robotlyd.spill(figur.id);
    if (!fikk) { tegn(); return; }

    // Myntene flyr opp fra roboten og forsvinner. Elementet ligger i selve
    // arbeidsplassen og fjerner seg selv naar animasjonen er ferdig.
    var fly = lag("jobb-fly");
    fly.textContent = "+" + fikk + " ◉";
    knapp.append(fly);
    setTimeout(function () { if (fly.parentNode) fly.remove(); }, 900);

    // Tegner resten av hallen paa nytt med det samme (summen oeverst, og
    // denne plassen som tom), men lar den flyvende myntteksten leve ferdig
    // -- derfor tegnes nettopp denne plassen paa nytt foerst etterpaa.
    tegnToppen();
    setTimeout(tegn, 900);
    if (paaEndret) paaEndret();
  }

  /* ---------- Hele hallen ---------- */

  function eide() {
    var s = Lagring.aktiv();
    if (!s) return [];
    return (s.eide || []).map(function (e) {
      var f = Figurer.finn(e.ting);
      return f ? { figur: f, pris: e.pris } : null;
    }).filter(Boolean);
  }

  function tegnToppen() {
    var s = Lagring.aktiv();
    if (!s) return;
    var liste = eide();
    var klar = 0, fulle = 0, skala = 1;
    liste.forEach(function (r) {
      var st = Spill.jobbStatus(r.figur.id, r.pris);
      if (!st) return;
      skala = st.skala;
      klar += st.mynter;
      if (st.full) fulle++;
    });

    $("#jobbMynter").innerHTML = klar
      ? "<b>" + klar + " ◉</b> klare til henting"
      : "<b>Ingenting klart ennå</b>";

    var linjer = [];
    if (liste.length) {
      linjer.push(liste.length + (liste.length === 1 ? " robot" : " roboter") + " på jobb");
    }
    if (fulle) {
      linjer.push(fulle === 1
        ? "1 er ferdig og venter"
        : fulle + " er ferdige og venter");
    }
    // Er samlingen så stor at totaltaket slår inn, er det dét som styrer, og
    // da stemmer ikke lenger "20 % av prisen" -- si det som det er.
    linjer.push(skala < 1
      ? "Fabrikken gir til sammen maks " + Spill.JOBB_TAK_TOTAL +
        " mynter på " + Spill.JOBB_TIMER + " timer, delt mellom robotene"
      : "Hver robot tjener opp til " +
        Math.round(Spill.JOBB_ANDEL * 100) + " % av det den kostet, på " +
        Spill.JOBB_TIMER + " timer");
    $("#jobbHint").textContent = linjer.join(" · ");
  }

  function tegn() {
    var liste = eide();
    var hall = $("#jobbHall");
    hall.textContent = "";
    liste.forEach(function (r) {
      var p = plass(r.figur, r.pris);
      if (p) hall.append(p);
    });
    $("#jobbTom").hidden = liste.length > 0;
    tegnToppen();
  }

  /* ---------- Åpne / lukke ---------- */

  function apne() {
    tegn();
    $("#hus").hidden = true;
    $("#jobb").hidden = false;
    // "Lukk" ligger fast i topplinja, samme knep som butikken og samlingen
    // -- saa han slipper aa rulle forbi hele hallen for aa komme ut igjen.
    // "Bytt spiller" skjules imens, av samme grunn som der.
    $("#lukkJobb").hidden = false;
    $("#byttSpiller").hidden = true;
  }

  $("#lukkJobb").onclick = function () {
    $("#jobb").hidden = true;
    $("#lukkJobb").hidden = true;
    $("#hus").hidden = false;
    if (Lagring.aktiv()) $("#byttSpiller").hidden = false;
  };

  global.Jobb = {
    apne: apne,
    tegn: tegn,
    naarEndret: function (fn) { paaEndret = fn; }
  };
})(window);
