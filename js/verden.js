/* Verden: skjermen der han velger hva han vil lese om.
 *
 * Kartet er tegnet av kenney/lag_kart.py -- ett sammenhengende bilde
 * (img/verden-kart.png) i Kenney-grafikk med fem leseemner (skog, fjell, hav,
 * by, stjernetaarnet) pluss huset spilleren selv eier, midt paa kartet. Denne
 * fila legger bare de klikkbare punktene oppaa bildet, paa noeyaktig samme
 * sted som skriptet tegnet hver sone -- se SONER under, som er kopiert fra
 * kenney/verden-soner.json. Skal en sone flyttes, er det der det skjer, ikke
 * her.
 *
 * Hjemme-punktet er ikke et emne fra tekstbanken -- det foerer alltid rett
 * tilbake til huset (Hus.tegn), samme dør han gikk ut av.
 *
 * At det er ett kart og ikke fem kort er et bevisst valg: det skal se ut som
 * han drar til et sted, ikke velger fra en meny. Aa la figuren gaa rundt paa
 * kartet er planlagt, men kommer senere -- inntil da er sonene faste punkter
 * man trykker rett paa.
 */
(function (global) {
  "use strict";

  var $ = function (v) { return document.querySelector(v); };

  // Brøkdel av kartets bredde/hoeyde (0..1), ikke piksler -- da flytter
  // punktene seg riktig med kortet uansett hvor bredt det vises.
  var SONER = {
    skog:    { x: 0.1953, y: 0.2639 },
    fjell:   { x: 0.8203, y: 0.2500 },
    hav:     { x: 0.1250, y: 0.6944 },
    by:      { x: 0.7891, y: 0.7917 },
    stjerne: { x: 0.5078, y: 0.1806 },
    hjem:    { x: 0.4609, y: 0.5417 }
  };

  var FARGER = {
    skog: "#2f7d4f",
    fjell: "#5b7a99",
    hav: "#1f6f8b",
    by: "#a8652f",
    stjerne: "#4b3f8f",
    hjem: "#c46a2f"
  };
  var RESERVE = "#6b727a";

  /* Samme strekmerker som foer kartet fantes -- nå bare som liten ikon i
     prikken i stedet for et helt kort. */
  var MERKER = {
    skog: '<path d="M12 2 L19 12 H15 L21 21 H3 L9 12 H5 Z"/>',
    fjell: '<path d="M2 20 L9 6 L13 13 L16 9 L22 20 Z"/>',
    hav: '<path d="M2 9c3-3 5 3 8 0s5 3 8 0 4 0 4 0M2 15c3-3 5 3 8 0s5 3 8 0 4 0 4 0" ' +
         'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    by: '<path d="M4 21V9l5-4 5 4v12z"/><path d="M16 21V12h4v9z"/>',
    stjerne: '<circle cx="12" cy="12" r="4.6"/>' +
             '<path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1' +
             'M17.3 17.3l2.1 2.1M19.4 4.6l-2.1 2.1M6.7 17.3l-2.1 2.1" ' +
             'fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>',
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
