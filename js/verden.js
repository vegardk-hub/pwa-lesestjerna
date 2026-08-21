/* Verden: skjermen der han velger hva han vil lese om.
 *
 * Kartet er img/verden-kart.jpg, ett ferdig bilde av en flytende by. Denne
 * fila legger bare de klikkbare punktene oppaa bildet -- se SONER under, som
 * er valgt til aa treffe noe som faktisk staar der i bildet (et tarn, broen,
 * en gronn oy...). Skal en sone flyttes, er det tallene der det skjer.
 *
 * De fem emnene er skolefag-bredde, ikke steder: tall og gaater, ting og
 * krefter, alt som lever, mennesker og tanker, oppfinnelser. Bildet passer
 * likevel fint -- det er stort nok til aa romme alle fem uten aa se ut som en
 * meny.
 *
 * Hjemme-punktet er ikke et emne fra tekstbanken -- det foerer alltid rett
 * tilbake til huset (Hus.tegn).
 *
 * At det er ett kart og ikke fem kort er et bevisst valg: det skal se ut som
 * han drar til et sted, ikke velger fra en meny.
 */
(function (global) {
  "use strict";

  var $ = function (v) { return document.querySelector(v); };

  // Brøkdel av kartets bredde/hoeyde (0..1), ikke piksler -- da flytter
  // punktene seg riktig med kortet uansett hvor bredt det vises. Tallene er
  // satt for aa treffe konkrete ting i img/verden-kart.jpg (1280x853):
  // taarnet med rutemoenster, lysstraalene og stjernehimmelen midt i bildet,
  // broen over vannet, den store kula nede til venstre, den groenne oeya nede
  // til hoeyre.
  var SONER = {
    tall:         { x: 0.2852, y: 0.1641 },
    krefter:      { x: 0.5469, y: 0.2344 },
    folk:         { x: 0.4922, y: 0.5859 },
    oppfinnelser: { x: 0.1484, y: 0.6330 },
    liv:          { x: 0.9063, y: 0.7734 },
    hjem:         { x: 0.3400, y: 0.9000 }
  };

  var FARGER = {
    tall: "#2f6d9d",
    krefter: "#4b3f8f",
    folk: "#a8447a",
    oppfinnelser: "#b3651e",
    liv: "#2f7d4f",
    hjem: "#c46a2f"
  };
  var RESERVE = "#6b727a";

  /* Ett lite ikon per emne i prikken paa kartet. */
  var MERKER = {
    // Tall og gaater: et rutenett, som et lite regnestykke.
    tall: '<path d="M9 3v18M15 3v18M4 9h16M4 15h16" fill="none" stroke="currentColor" ' +
          'stroke-width="2.2" stroke-linecap="round"/>',
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
    hjem: '<path d="M3 12 12 4l9 8"/><path d="M5 10.5V21h14V10.5"/><path d="M9.5 21v-7h5v7"/>'
  };

  var paaValgt = null;   // settes av app.js: en tekst er valgt
  var paaHjem = null;    // settes av app.js: tilbake til huset

  function teksten(e) {
    // Naar alt er lest skal det ikke se ut som emnet er brukt opp. Han kan lese
    // om igjen sa mye han vil — det gir bare ikke mynter en gang til.
    return e.antall === 0
      ? "Ingen tekster ennå"
      : e.lest >= e.antall
        ? "Alt lest — les om igjen"
        : e.lest + " av " + e.antall + " lest";
  }

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
    navn.textContent = e.navn;

    var stolpe = document.createElement("span");
    stolpe.className = "stolpe";
    var fyll = document.createElement("i");
    fyll.style.width = (e.antall ? Math.round(100 * e.lest / e.antall) : 0) + "%";
    fyll.style.background = farge;
    stolpe.append(fyll);

    var teller = document.createElement("span");
    teller.className = "teller";
    teller.textContent = teksten(e);

    lapp.append(navn, stolpe, teller);
    k.append(prikk, lapp);

    k.disabled = e.antall === 0;
    k.setAttribute("aria-label", e.navn + ": " + teksten(e));
    k.onclick = function () { if (paaValgt) paaValgt(e.id); };
    return k;
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
