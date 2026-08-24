/* Vanskelige ord: et sted å øve seg på enkeltord han selv har hengt seg opp
 * i mens han leser -- ikke en ferdig, felles liste lenger, men hans egen,
 * personlige bok (Lagring.vanskeligeOrd()), bygd opp av js/lesing.js sin
 * fangVanskeligeOrd() hver gang et ord på fem bokstaver eller mer ikke ble
 * hørt riktig i en tekst. Boka starter blank for en ny spiller og fylles på
 * etter hvert som han leser.
 *
 * Tjue ord om gangen, valgt tilfeldig. Trykk på et for å øve på det -- selve
 * lesingen lånes fra lesing.js (app.js kobler det sammen, se
 * naarOrdValgt/merkFerdig), akkurat som vanlig lesing, bare med teksten satt
 * til det ene ordet. Godkjent, og ordet får et hakk og du er tilbake her for
 * å velge et nytt. Er hele settet øvd ferdig, hentes et nytt automatisk --
 * se apne() under -- uten å røre det han alt har samlet opp i poengSamlet.
 *
 * Hvert godkjent ord er verdt to mynter, men betales ikke ut med en gang --
 * det bygger seg opp i poengSamlet til han trykker "Ferdig", som henter ut
 * hele summen på én gang (se app.js, som kobler det mot Spill.tjenMynter).
 * Ikke koblet til "ord lest" eller bøkene: dette er en øvelse for seg selv,
 * ikke en ny, raskere vei til bok-økonomien.
 */
(function (global) {
  "use strict";

  var $ = function (v) { return document.querySelector(v); };
  var MAKS = 20;

  var settOrd = [];      // [{ ord, ferdig }]
  var settSpillerId = undefined; // hvilken spiller settOrd hoerer til, se apne()
  var poengSamlet = 0;   // mynter siden forrige uthenting -- to per godkjent ord
  var MYNT_PER_ORD = 2;
  var paaValgt = null;   // settes av app.js: et ord er valgt for øvelse

  function stokk(liste) {
    var kopi = liste.slice();
    for (var i = kopi.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = kopi[i]; kopi[i] = kopi[j]; kopi[j] = t;
    }
    return kopi;
  }

  function nyttSett() {
    var alle = Lagring.vanskeligeOrd();
    settOrd = stokk(alle).slice(0, Math.min(MAKS, alle.length))
      .map(function (o) { return { ord: o, ferdig: false }; });
    tegn();
  }

  function tegn() {
    var ferdige = settOrd.filter(function (o) { return o.ferdig; }).length;
    $("#vanskordFremgang").textContent = settOrd.length
      ? ferdige + " av " + settOrd.length + " ord øvd"
      : "Fant ingen vanskelige ord å øve på ennå.";

    // Egen, stor og gyllen linje for myntene -- den skal stikke seg ut, ikke
    // gjemme seg i den vanlige, dempede fremgangsteksten over.
    $("#vanskordMynter").innerHTML =
      "<b>" + poengSamlet + " ◉</b> " +
      (poengSamlet === 1 ? "mynt klar til henting" : "mynter klare til henting");
    $("#vanskordFerdig").disabled = poengSamlet === 0;

    var liste = $("#vanskordListe");
    liste.textContent = "";
    settOrd.forEach(function (o) {
      var knapp = document.createElement("button");
      knapp.type = "button";
      knapp.className = "ordknapp" + (o.ferdig ? " ferdig" : "");
      knapp.textContent = o.ord;
      knapp.disabled = o.ferdig;
      knapp.onclick = function () { if (paaValgt) paaValgt(o.ord); };
      liste.append(knapp);
    });
  }

  // Kalt fra app.js naar et ord er lest ferdig. Matcher paa selve ordteksten,
  // ikke indeks -- settet endrer seg ikke mens han oever, saa det er trygt.
  // Bare foerste gang et ord godkjennes gir mynt -- uten "!o.ferdig"-sjekken
  // kunne et ord som av en eller annen grunn ble meldt ferdig to ganger gitt
  // dobbel betaling.
  //
  // Ordet fjernes fra selve boka (Lagring.fjernVanskeligeOrd) med det samme
  // -- ikke foerst naar han trykker "Ferdig" nederst. Han kan jo like gjerne
  // gaa ut igjen med den vanlige "Tilbake" oeverst, og fjerningen skal skje
  // uansett hvordan han forlater skjermen. Snubler han i det samme ordet
  // igjen senere i en vanlig tekst, havner det bare tilbake i boka av seg
  // selv (fangVanskeligeOrd() i js/lesing.js).
  function merkFerdig(ord) {
    var funnet = settOrd.find(function (o) { return o.ord === ord; });
    if (funnet && !funnet.ferdig) {
      funnet.ferdig = true;
      poengSamlet += MYNT_PER_ORD;
      Lagring.fjernVanskeligeOrd([ord]);
    }
    tegn();
  }

  // Kalt fra app.js naar han trykker "Ferdig". Gir fra seg mynt-summen og
  // nullstiller selv -- ingen sjanse for aa hente den samme summen to ganger.
  function hentUtMynter() {
    var n = poengSamlet;
    poengSamlet = 0;
    return n;
  }

  // Foerste gang, naar alt i settet alt er oevd ferdig, ELLER naar det er en
  // annen spiller enn sist (settOrd og poengSamlet er bare vanlige
  // JS-variabler i denne fila -- uten denne sjekken ville en fersk spiller
  // arvet en annen spillers ord og mynter, siden ingenting ellers nullstiller
  // dem naar man bytter): lager et nytt sett. Ellers (tilbake fra et enkelt
  // ord han fortsatt holder paa med) tegner den bare det som alt finnes, saa
  // fremgangen ikke nullstilles ved et uhell.
  function apne() {
    var aktiv = Lagring.aktiv();
    var aktivId = aktiv && aktiv.id;
    if (aktivId !== settSpillerId) {
      settSpillerId = aktivId;
      poengSamlet = 0;
      nyttSett();
      return;
    }
    var alleFerdig = settOrd.length && settOrd.every(function (o) { return o.ferdig; });
    if (!settOrd.length || alleFerdig) nyttSett();
    else tegn();
  }

  global.Vanskord = {
    apne: apne,
    merkFerdig: merkFerdig,
    hentUtMynter: hentUtMynter,
    naarOrdValgt: function (fn) { paaValgt = fn; }
  };
})(window);
