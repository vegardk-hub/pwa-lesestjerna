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
 *   sekssju      -- armene dytter opp og ned hele tiden (css/.arm-vipp),
 *                   blinkende lys, og trykk gir en frase med robotstemme
 *   utenomjordisk -- hodet dreier fram og tilbake og skyter laserstraaler
 *                   fra oeynene (css/.utenom-hode + .utenom-laser),
 *                   blinkende lys, og trykk gir en frase med robotstemme
 *   utrolig      -- hopper og snurrer rundt, og bytter saa om paa hodet og
 *                   kroppen sin (css/.utrolig-hele/-hode/-kropp), blinkende
 *                   lys, og trykk gir en frase med robotstemme
 *   uknuselig    -- en aura av ild/vann/lyn/vind rundt roboten, ut fra dens
 *                   "kraft"-felt (css/.kraft-ild/-vann/-lyn/-vind), blinkende
 *                   lys, og trykk gir en frase med robotstemme
 *   transformer  -- glitcher som episk (css/.glitch), og forvandler seg om
 *                   til kjoeretoeyet sitt og tilbake igjen (css/.transformer-
 *                   robot/-kjoretoy, ut fra "kjoretoy"-feltet). Trykk gir
 *                   lyden av kjoeretoeyet (Robotlyd.spill), ingen frase.
 *
 * Frasen (reager() under) knyttes til at figuren HAR en frase i
 * data/figurer.json, ikke til en bestemt kategori -- i dag er det
 * legendarisk og sekssju, men koden bryr seg ikke om hvilke.
 *
 * visStor() nedenfor kobler alt dette (lyd, glitch, opptak) til et gitt
 * sett DOM-elementer -- delt med "Ola sin robot" i hus.js, som viser den
 * valgte roboten stort på nøyaktig samme måte som her.
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
    if (v.frase) {
      setTimeout(function () { Robotlyd.si(v.frase); }, 450);
    }
  }

  // Knappen som gjoer roboten til hans personlige ikon -- se hus.js, som
  // eier selve lagringen og alt som viser den valgte roboten andre steder
  // (huskortet, "bytt spiller", "Ola sin robot"). Tegnes paa nytt etter
  // hvert trykk, saa teksten alltid stemmer med hva som faktisk er valgt.
  function tegnVelgKnapp(v) {
    var knapp = $("#velgSomMin");
    var erValgt = Lagring.valgtRobot() === v.id;
    knapp.textContent = erValgt ? "✓ Dette er min robot" : "Velg som min robot";
    knapp.classList.toggle("valgt", erValgt);
    knapp.onclick = function () {
      Hus.velgRobot(erValgt ? null : v.id);
      tegnVelgKnapp(v);
    };
  }

  // Kobler en robot til et sett DOM-elementer: ikonet reagerer med lyd/frase
  // ved trykk (og glitcher om den er episk eller transformer), og mytiske
  // roboter faar opptaksknappene sine i stedet. "els" er { ikon, hint,
  // opptakBoks, opptak: { taOpp, spillAv, status } } -- se visDetalj under
  // og tegnRobotvalg i hus.js, som begge bruker denne til å vise akkurat
  // samme oppførsel.
  function visStor(v, els) {
    els.ikon.innerHTML = Figurer.svg(v.id);
    els.ikon.classList.toggle("glitch", v.kategori === "episk" || v.kategori === "transformer");
    els.ikon.onclick = function () { reager(v); };

    if (v.kategori === "mytisk") {
      if (els.hint) els.hint.hidden = true;
      els.opptakBoks.hidden = false;
      settOppOpptak(v, els.opptak);
    } else {
      els.opptakBoks.hidden = true;
      if (els.hint) {
        els.hint.hidden = false;
        els.hint.textContent = v.frase
          ? "Trykk på roboten for å høre den snakke igjen."
          : "Trykk på roboten for å høre lyden igjen.";
      }
    }

    reager(v);
  }

  function visDetalj(v) {
    $("#samlingDetaljNavn").textContent = v.navn;
    tegnVelgKnapp(v);
    $("#samlingListe").hidden = true;
    $("#samlingTom").hidden = true;
    $("#samlingDetalj").hidden = false;

    visStor(v, {
      ikon: $("#samlingDetaljIkon"),
      hint: $("#samlingDetaljHint"),
      opptakBoks: $("#samlingOpptak"),
      opptak: { taOpp: $("#taOpp"), spillAv: $("#spillOpptak"), status: $("#opptakStatus") }
    });
  }

  /* ---------- Opptak (mytiske roboter) ---------- */

  function settOppOpptak(v, opptakEls) {
    var taOpp = opptakEls.taOpp;
    var spillAv = opptakEls.spillAv;
    var status = opptakEls.status;

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
    apne: apne,
    visStor: visStor
  };
})(window);
