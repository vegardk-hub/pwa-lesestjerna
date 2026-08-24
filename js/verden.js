/* Verden: skjermen der han velger hva han vil lese om.
 *
 * Kartet er img/verden-kart.jpg, ett ferdig bilde av en flytende by. Denne
 * fila legger bare de klikkbare punktene oppaa bildet -- se SONER under.
 * Punktene er IKKE valgt for aa treffe noe bestemt i bildet (et taarn, en
 * bro...) -- de er bare spredt fint utover flaten, saa de ikke klumper seg
 * sammen. Skal en sone flyttes, er det tallene der det skjer.
 *
 * Emnene er skolefag-bredde, ikke steder: ting og krefter, alt som lever,
 * mennesker og tanker, oppfinnelser -- vitser, som ikke er et skolefag, men
 * et sted han kan ta en pause og le litt mellom de andre -- og verdens-
 * rekorder, som er litt av begge deler: ekte fakta, men valgt for aa vaere
 * spektakulaere, ikke laereboklige. Bildet passer likevel fint -- det er
 * stort nok til aa romme alle seks uten aa se ut som en meny.
 *
 * Hjemme-punktet er ikke et emne fra tekstbanken -- det foerer alltid rett
 * tilbake til huset (Hus.tegn).
 *
 * At det er ett kart og ikke fire kort er et bevisst valg: det skal se ut som
 * han drar til et sted, ikke velger fra en meny.
 */
(function (global) {
  "use strict";

  var $ = function (v) { return document.querySelector(v); };

  // Brøkdel av kartets bredde/hoeyde (0..1), ikke piksler -- da flytter
  // punktene seg riktig med kortet uansett hvor bredt det vises. Sju
  // punkter: fire i en symmetrisk diamant, hjem midt i, vitser som en topp-
  // prikk over de to oeverste, og rekorder som motstykket rett under de to
  // nederste. To paa samme rad staar alltid paa hver sin halvdel av bildet
  // (0.56 fra hverandre), saa selv paa det smaleste kortet er det god
  // avstand -- ellers klumper lappene seg fort sammen naar kortet vises
  // smalt (mobil).
  var SONER = {
    vitser:       { x: 0.50, y: 0.13 },
    oppfinnelser: { x: 0.22, y: 0.26 },
    folk:         { x: 0.78, y: 0.26 },
    hjem:         { x: 0.50, y: 0.54 },
    liv:          { x: 0.22, y: 0.78 },
    krefter:      { x: 0.78, y: 0.78 },
    rekorder:     { x: 0.50, y: 0.91 }
  };

  var FARGER = {
    krefter: "#4b3f8f",
    folk: "#a8447a",
    oppfinnelser: "#b3651e",
    liv: "#2f7d4f",
    vitser: "#d99a00",
    rekorder: "#1d6fa8",
    hjem: "#c46a2f"
  };
  var RESERVE = "#6b727a";

  // De fulle emnenavnene (fra tekster.json) er for lange til aa staa paa én
  // eller to linjer uten aa krasje inn i naboene paa en smal skjerm. Lappen
  // paa kartet faar derfor et kortere navn -- det fulle navnet lever videre i
  // e.navn (aria-label), det er bare paa selve kartet det er forkortet.
  var KORTNAVN = {
    krefter: "Verdensrommet",
    folk: "Mennesker",
    oppfinnelser: "Oppfinnelser",
    liv: "Alt som lever",
    vitser: "Vitser",
    rekorder: "Rekorder"
  };

  /* Ett lite ikon per emne i prikken paa kartet. */
  var MERKER = {
    // Ting, krefter og verdensrommet: et atom i bane.
    krefter: '<circle cx="12" cy="12" r="2.3"/>' +
             '<ellipse cx="12" cy="12" rx="9" ry="3.6" fill="none" stroke="currentColor" ' +
             'stroke-width="1.8" transform="rotate(30 12 12)"/>' +
             '<ellipse cx="12" cy="12" rx="9" ry="3.6" fill="none" stroke="currentColor" ' +
             'stroke-width="1.8" transform="rotate(-30 12 12)"/>',
    // Mennesker, tanker og følelser: et menneske.
    folk: '<circle cx="12" cy="7.2" r="3.4"/><path d="M5 21c0-4.4 3.2-7 7-7s7 2.6 7 7Z"/>',
    // Oppfinnelser og maskiner: en lyspære.
    oppfinnelser: '<path d="M12 2a7 7 0 0 0-4 12.7c.8.6 1.3 1.5 1.4 2.5h5.2c.1-1 .6-1.9 ' +
                  '1.4-2.5A7 7 0 0 0 12 2Z"/>' +
                  '<rect x="9.3" y="18.2" width="5.4" height="1.8" rx=".9" fill="#fff"/>' +
                  '<rect x="9.8" y="20.6" width="4.4" height="1.6" rx=".8" fill="#fff"/>',
    // Alt som lever: et blad.
    liv: '<path d="M12 3c-5 2-8 6-8 11a8 8 0 0 0 16 0c0-5-3-9-8-11Z"/>' +
         '<path d="M12 6v13" fill="none" stroke="#fff" stroke-width="1.4" opacity=".7"/>',
    // Vitser og humor: et smilende, leende ansikt -- bare oeyne og munn,
    // ikke noe hode-omriss, akkurat som "krefter" sitt atom klarer seg uten.
    vitser: '<circle cx="8" cy="10" r="1.6"/><circle cx="16" cy="10" r="1.6"/>' +
            '<path d="M6.5 13.5c1.6 3.4 4 5 5.5 5s3.9-1.6 5.5-5" fill="none" ' +
            'stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    // Verdensrekorder: en pokal.
    rekorder: '<path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/>' +
              '<path d="M7 5H4v1.5A3.5 3.5 0 0 0 7.3 10" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
              '<path d="M17 5h3v1.5A3.5 3.5 0 0 1 16.7 10" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
              '<rect x="10.5" y="13.5" width="3" height="4" fill="currentColor"/>' +
              '<rect x="7.5" y="18" width="9" height="2.2" rx="1.1" fill="currentColor"/>',
    hjem: '<path d="M3 12 12 4l9 8"/><path d="M5 10.5V21h14V10.5"/><path d="M9.5 21v-7h5v7"/>'
  };

  var paaValgt = null;   // settes av app.js: en tekst er valgt
  var paaHjem = null;    // settes av app.js: tilbake til huset

  function pin(e) {
    var farge = FARGER[e.id] || RESERVE;
    var punkt = SONER[e.id];

    var k = document.createElement("button");
    k.className = "sone";
    k.type = "button";
    k.dataset.emne = e.id;
    // Ukjente/nye emner uten et fast punkt i kenney/verden-soner.json havner
    // midt paa kartet i stedet for aa forsvinne -- de skal fortsatt kunne
    // trykkes, selv foer noen har tegnet dem inn et sted.
    k.style.left = (100 * (punkt ? punkt.x : 0.5)) + "%";
    k.style.top = (100 * (punkt ? punkt.y : 0.5)) + "%";

    var prikk = document.createElement("span");
    prikk.className = "prikk";
    prikk.style.background = farge;
    prikk.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
                      (MERKER[e.id] || '<circle cx="12" cy="12" r="7"/>') + "</svg>";

    var lapp = document.createElement("span");
    lapp.className = "lapp";

    var navn = document.createElement("span");
    navn.className = "navn";
    navn.textContent = KORTNAVN[e.id] || e.navn;

    lapp.append(navn);
    k.append(prikk, lapp);

    // Ingen tallinformasjon her med vilje -- han skal ikke kunne se hvor
    // mange tekster som finnes eller hvor mange som er lest, bare velge
    // et emne. Antall vokser stadig etter hvert som flere legges til, saa
    // et tall her ville uansett vaere foreldet med det samme.
    k.disabled = e.antall === 0;
    k.setAttribute("aria-label", e.navn);
    // Har han en personlig robot (se hus.js), reiser den bort til prikken
    // foerst -- se reiseTilSone(). Ingen robot valgt, ingen reise: da
    // skjer overgangen til lesingen med en gang, som foer.
    k.onclick = function () {
      var valgtId = Lagring.valgtRobot();
      var valgt = valgtId && Figurer.finn(valgtId);
      if (valgt) reiseTilSone(valgt, e.id);
      else if (paaValgt) paaValgt(e.id);
    };
    return k;
  }

  /* Roboten glir fra hjemmepunktet og bort til prikken han valgte, hopper
   * inn i den, og sier ifra med en pling -- foerst da byttes bildet til
   * selve teksten. Hele reisen er lagt opp til aa vare rundt tre sekunder:
   * 2,2 sekund glidning (css/#reiseRobot sin transition) + et halvt
   * sekunds hopp (css/.hopper) + en liten pause saa han faktisk faar sett
   * at den landet.
   *
   * Elementet er ett og samme, gjenbrukt hver gang -- ikke en ny kopi per
   * reise -- og ligger fast i markeringen (index.html), ikke bygget her i
   * tegn(), siden det skal overleve akkurat denne ene reisen uten aa bli
   * tømt og gjenoppbygd midt i.
   */
  function reiseTilSone(valgt, emneId) {
    var robot = $("#reiseRobot");
    if (!robot) { if (paaValgt) paaValgt(emneId); return; }

    var start = SONER.hjem;
    var maal = SONER[emneId] || { x: 0.5, y: 0.5 };

    // Ingen kan starte en ny reise oppaa denne -- laases opp igjen naar
    // roboten er framme (eller om noe gikk galt underveis, se nederst).
    var alleSoner = Array.prototype.slice.call(document.querySelectorAll(".sone"));
    var varDisabled = alleSoner.map(function (s) { return s.disabled; });
    alleSoner.forEach(function (s) { s.disabled = true; });

    // Den faste badgen ved hjem (se hjemPin()) forsvinner mens kopien er
    // underveis -- ellers ser det ut som to roboter paa én gang.
    var badge = document.querySelector(".sone.hjem .robotmerke");
    if (badge) badge.style.visibility = "hidden";

    robot.innerHTML = Figurer.svg(valgt.id);
    robot.classList.remove("hopper");
    robot.style.transition = "none";
    robot.style.left = (100 * start.x) + "%";
    robot.style.top = (100 * start.y) + "%";
    robot.hidden = false;
    void robot.offsetWidth; // tving reflow, saa transition under faktisk glir
    robot.style.transition = "";
    robot.style.left = (100 * maal.x) + "%";
    robot.style.top = (100 * maal.y) + "%";

    setTimeout(function () {
      robot.classList.add("hopper");
      Robotlyd.pling();
    }, 2200);

    setTimeout(function () {
      robot.hidden = true;
      robot.classList.remove("hopper");
      alleSoner.forEach(function (s, i) { s.disabled = varDisabled[i]; });
      if (badge) badge.style.visibility = "";
      if (paaValgt) paaValgt(emneId);
    }, 3000);
  }

  /* Hjemme er ikke et emne fra tekstbanken -- det er huset spilleren eier, og
     knappen foerer alltid tilbake dit, uansett hvor mye som er lest. Derfor
     egen bygg-funksjon i stedet for pin(): ingen stolpe aa fylle, ingen
     "laast" tilstand. */
  function hjemPin() {
    var punkt = SONER.hjem;
    var k = document.createElement("button");
    k.className = "sone hjem";
    k.type = "button";
    k.style.left = (100 * punkt.x) + "%";
    k.style.top = (100 * punkt.y) + "%";

    var prikk = document.createElement("span");
    prikk.className = "prikk";
    prikk.style.background = FARGER.hjem;
    prikk.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      MERKER.hjem + "</svg>";

    var lapp = document.createElement("span");
    lapp.className = "lapp";
    var navn = document.createElement("span");
    navn.className = "navn";
    navn.textContent = "Hjem";
    lapp.append(navn);

    k.append(prikk, lapp);

    // Har han valgt en robot til aa vaere ikonet sitt (se hus.js), sitter
    // den og venter ved hjemmepunktet -- som om den fulgte med ut i verden.
    var valgtId = Lagring.valgtRobot();
    var valgt = valgtId && Figurer.finn(valgtId);
    if (valgt) {
      var merke = document.createElement("span");
      merke.className = "robotmerke";
      merke.innerHTML = Figurer.svg(valgt.id);
      k.append(merke);
    }

    k.setAttribute("aria-label", "Gå hjem");
    k.onclick = function () { if (paaHjem) paaHjem(); };
    return k;
  }

  function tegn() {
    var boks = $("#soner");
    boks.textContent = "";
    Bank.emner().forEach(function (e) { boks.append(pin(e)); });
    boks.append(hjemPin());

    // Feil i tekstbanken skjules ikke. Vegard er den eneste som kan rette dem,
    // og han ser dem bare om de staar paa skjermen.
    var feil = Bank.feil();
    $("#bankfeil").textContent = feil.length
      ? "Noe er galt i tekstbanken: " + feil.join(" ")
      : "";
  }

  global.Verden = {
    tegn: tegn,
    naarValgt: function (fn) { paaValgt = fn; },
    naarHjem: function (fn) { paaHjem = fn; }
  };
})(window);
