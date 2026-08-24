/* Skallet: hvilken skjerm som vises naar, og hva som skjer mellom dem.
 *
 * Sloeyfa er hus -> verden -> lesing -> ferdig -> hus. Lesemotoren i lesing.js
 * vet ikke hvor teksten kom fra, og oekonomien i spill.js vet ikke hvordan den
 * ser ut paa skjermen. Det er her de moetes, og det er bare her.
 *
 * Huset ligger foerst med vilje. Det er det han leser *for*, saa han skal se
 * rommet sitt foer han gaar ut og tjener til det.
 */
(function () {
  "use strict";

  var $ = function (v) { return document.querySelector(v); };

  var naa = null;        // teksten som leses akkurat naa
  var sisteEmne = null;  // hvor "Les en til" skal hente neste fra
  var lesFraVanskord = false; // sant naar lesingen kom fra "Vanskelige ord",
                              // saa "tilbake" og fullfoert foerer dit igjen
  var ferdigAutoTimer = null; // i leseflyt: naeste tekst etter tre sekunder, se ferdig()

  // Roboter uten en fast frase (bare de legendariske har det, se
  // data/figurer.json) faar en av disse i stedet, saa alle -- ikke bare fem
  // av trettito -- kan heie naar en tekst er ferdig.
  var HEIAROP = [
    "Bra jobbet!", "Det gikk kjempefint!", "Du leser så bra!",
    "Nå bygger vi videre!", "Det der var flott lesing!", "Jeg er stolt av deg!"
  ];

  function valgtRobotFigur() {
    var id = Lagring.valgtRobot();
    return id && Figurer.finn(id);
  }

  function vis(hvilken) {
    // Uansett hvor vi skal -- ogsaa til "ferdig" selv, se ferdig() -- skal
    // en overgang som var planlagt fra en TIDLIGERE ferdig-skjerm avlyses.
    // Ellers kunne leseflyt sin automatiske "neste tekst" komme brasende inn
    // over noe han alt har navigert videre til paa egen haand.
    if (ferdigAutoTimer) { clearTimeout(ferdigAutoTimer); ferdigAutoTimer = null; }

    $("#velgSpiller").hidden = hvilken !== "spillere";
    $("#hus").hidden = hvilken !== "hus";
    $("#verden").hidden = hvilken !== "verden";
    $("#vanskord").hidden = hvilken !== "vanskord";
    $("#lesing").hidden = hvilken !== "lesing";
    $("#ferdig").hidden = hvilken !== "ferdig";
    $("#verktoy").hidden = hvilken !== "lesing";
    $("#stjerner").hidden = hvilken !== "lesing";
    $("#boka").hidden = true;
    $("#lestBok").hidden = true;
    $("#robotvalg").hidden = true;

    // Begge disse er avslaatt som standard -- se foreldre.js. Satt hver
    // gang, ikke bare ved oppstart, i tilfelle en forelder endrer dem mens
    // han allerede leser.
    if (hvilken === "lesing") {
      $("#lesForMeg").hidden = !Lagring.lesForMegPaa();
      $("#godkjennHele").hidden = !Lagring.godkjennVoksenPaa();

      // I leseflyt gir det ikke mening aa hoppe over ETT ord -- se
      // styles.css/js/lesing.js, det er ikke lenger noe "dette ordet naa" aa
      // hoppe forbi. I stedet faar han en tydelig, groenn knapp for aa si
      // fra selv at HELE teksten er ferdig, i tillegg til at appen ogsaa
      // gjoer det av seg selv etter en stund med stillhet (uendret).
      var flyt = Lagring.lesestil() === "leseflyt";
      $("#hoppOver").hidden = flyt;
      $("#ferdigLest").hidden = !flyt;

      // Roboten han har valgt (se hus.js) blir med som en liten foelgesvenn
      // ved siden av stjernene, og blunker naar han faar en ny -- se
      // reagerLesRobot(), kalt av lesing.js sitt "stjerne"-hook i les().
      var valgtLes = valgtRobotFigur();
      var lr = $("#lesRobot");
      lr.hidden = !valgtLes;
      if (valgtLes) lr.innerHTML = Figurer.svg(valgtLes.id);
    }

    // Tilbakeknappen finnes bare der det er noe aa gaa tilbake fra, og den
    // foerer alltid ett hakk innover: fra lesingen til verden, fra verden hjem.
    $("#tilbake").hidden = hvilken === "spillere" || hvilken === "hus" ||
                           hvilken === "ferdig";
    $("#tilbake").textContent = hvilken === "verden" ? "Hjem" : "Tilbake";
    $("#byttSpiller").hidden = hvilken === "spillere" || !Lagring.aktiv();
    tegnSpillerknapp();
  }

  function tegnSpillerknapp() {
    var s = Lagring.aktiv();
    if (!s) return;
    var tekst = s.navn + " \u00b7 lvl " + Spill.level(s) + " \u00b7 " + s.mynter + " \u25c9";
    var k = $("#byttSpiller");

    // Har han valgt en robot (se hus.js), viser knappen den i stedet for
    // bare navnet -- det samme ikonet skal kjennes igjen flere steder.
    var valgt = valgtRobotFigur();
    if (valgt) {
      k.innerHTML = '<span class="byttspiller-ikon">' + Figurer.svg(valgt.id) + "</span>";
      k.append(document.createTextNode(tekst));
    } else {
      k.textContent = tekst;
    }
  }

  function tilVerden() {
    Lesing.stopp();
    naa = null;
    Verden.tegn();
    vis("verden");
  }

  function tilHus() {
    Lesing.stopp();
    naa = null;
    sisteEmne = null;
    Hus.tegn();
    vis("hus");
  }

  function tilVanskord() {
    Lesing.stopp();
    naa = null;
    Vanskord.apne();
    vis("vanskord");
  }

  /* ---------- Lesing ---------- */

  // Trigger en kort blunke-animasjon paa foelgesvennen -- samme knep som
  // stjerne-tallet selv bruker (fjern klassen, tving reflow, legg den paa
  // igjen), ellers ville ikke CSS-animasjonen gaa om igjen paa rad.
  function reagerLesRobot() {
    var el = $("#lesRobot");
    if (el.hidden) return;
    el.classList.remove("reager");
    void el.offsetWidth;
    el.classList.add("reager");
  }

  function les(oppgave) {
    lesFraVanskord = false;
    vis("lesing");
    Lesing.start(oppgave, { ferdig: ferdig, stjerne: reagerLesRobot });
  }

  function lesFraEmne(emneId) {
    var t = Bank.neste(emneId);
    if (!t) return;
    naa = t;
    sisteEmne = emneId;
    les({ tekst: t.tekst, vanskeligeOrd: t.vanskeligeOrd });
  }

  // Valgt fra "Vanskelige ord" -- ett enkelt ord i stedet for en hel tekst,
  // og betaler ikke noe (se vanskord.js): ingen mynter, ingen "ord lest",
  // bare et hakk i den lille lista. Fullfoert (ved stemme, ved den vanlige
  // "fem forsoek"-sikkerheten i lesing.js, eller ved at en voksen godkjenner)
  // foerer rett tilbake til ordlista, ikke til den vanlige ferdig-skjermen.
  function lesVanskeligOrd(ord) {
    naa = null;
    lesFraVanskord = true;
    vis("lesing");
    Lesing.start({ tekst: ord + ".", vanskeligeOrd: [] }, {
      ferdig: function () {
        Vanskord.merkFerdig(ord);
        tilVanskord();
      },
      stjerne: reagerLesRobot
    });
  }

  // Valgt fra "Ola sin bok" -- en tekst han alt har lest, valgt fra den
  // alfabetiske lista i stedet for en tilfeldig i et emne. Den betaler ikke
  // på nytt (se Spill.betal), men "Les en til" etterpå fortsetter fint i
  // emnet teksten hoerer til.
  function lesSpesifikk(t) {
    naa = t;
    sisteEmne = t.emne;
    les({ tekst: t.tekst, vanskeligeOrd: t.vanskeligeOrd });
  }

  function ferdig(r) {
    // Tekster fra banken betaler én gang — id-en er noekkelen til hvilke
    // han har lest.
    var b = Spill.betal(naa.id, r);
    tegnSpillerknapp();

    if (b.alleredeLest) {
      $("#ferdigTittel").textContent = "Fint lest om igjen!";
      $("#ferdigTall").textContent = b.beskjed;
      $("#ferdigBok").textContent = "";
      $("#ferdigRobot").hidden = true;
    } else {
      $("#ferdigTittel").textContent = naa.tittel + " er lest!";
      $("#ferdigTall").textContent =
        r.ord + " ord \u00b7 " + r.setninger + " stjerner \u00b7 " +
        "+" + b.mynter + " mynter";
      $("#ferdigBok").textContent = b.nyeBoker
        ? "Du fylte en hel bok \u2014 du er level " + b.level + " nå!"
        : (b.tilNesteBok
            ? b.tilNesteBok.mangler + " ord igjen til bok nummer " + b.tilNesteBok.nr + "."
            : "");

      visFerdigRobot(b.nyeBoker);
    }

    vis("ferdig");

    // Leseflyt er en sammenhengende lesesloeyfe -- i stedet for aa vente paa
    // et trykk paa "Les en til", dukker neste tekst opp av seg selv etter et
    // par sekunder, saa han kan lese videre i eget tempo. Bare naar
    // "ferdig" faktisk kom fra en vanlig tekst (ikke fra vanskord-oeving,
    // som aldri viser denne skjermen i det hele tatt uansett).
    if (Lagring.lesestil() === "leseflyt") {
      ferdigAutoTimer = setTimeout(function () {
        ferdigAutoTimer = null;
        lesFraEmne(sisteEmne);
      }, 3000);
    }
  }

  // Roboten hans kommenterer teksten som akkurat ble lest -- stille, bare en
  // tekstlinje, saa det ikke blir masete aa lese mange tekster paa rad. Fylte
  // han derimot en hel bok (og gikk opp i level med det samme), feirer
  // roboten hoeyere: lyden sin, frasen sin (om den har en, ellers et
  // generelt heiarop) med robotstemme, og et lite hopp paa ikonet.
  function visFerdigRobot(nyBok) {
    var el = $("#ferdigRobot");
    var valgt = valgtRobotFigur();
    if (!valgt) { el.hidden = true; return; }

    var frase = valgt.frase || HEIAROP[Math.floor(Math.random() * HEIAROP.length)];
    el.querySelector(".ferdigRobot-ikon").innerHTML = Figurer.svg(valgt.id);
    el.querySelector(".ferdigRobot-tekst").textContent = valgt.navn + ": «" + frase + "»";
    el.hidden = false;
    el.classList.remove("feirer");

    if (nyBok) {
      Robotlyd.spill(valgt.id);
      setTimeout(function () { Robotlyd.si(frase); }, 500);
      void el.offsetWidth;
      el.classList.add("feirer");
    }
  }

  /* ---------- Knapper ---------- */

  Spillere.naarValgt(tilHus);
  Verden.naarValgt(lesFraEmne);
  Verden.naarHjem(tilHus);
  Hus.naarLestValgt(lesSpesifikk);
  Hus.naarRobotValgt(tegnSpillerknapp);
  Vanskord.naarOrdValgt(lesVanskeligOrd);

  $("#byttSpiller").onclick = function () {
    Lesing.stopp();
    Spillere.tegn();
    vis("spillere");
  };

  // Fra lesing gaar tilbake enten til verden (vanlig lesing) eller til
  // ordlista (les via "Vanskelige ord") -- se lesFraVanskord. Ellers gaar
  // den alltid hjem, enten det er fra verden eller fra ordlista selv.
  $("#tilbake").onclick = function () {
    if (!$("#lesing").hidden) {
      if (lesFraVanskord) tilVanskord(); else tilVerden();
    } else {
      tilHus();
    }
  };
  $("#tilVerden").onclick = tilVerden;
  $("#tilHus").onclick = tilHus;
  $("#utOgLes").onclick = tilVerden;
  $("#apneBoka").onclick = Hus.apneBoka;
  $("#apneLest").onclick = Hus.apneLest;
  $("#apneButikk").onclick = Butikk.apne;
  $("#apneSamling").onclick = Samling.apne;
  $("#apneRobotvalg").onclick = Hus.apneRobotvalg;
  $("#apneVanskord").onclick = tilVanskord;
  $("#apneForeldre").onclick = Foreldre.apne;

  // Hvert godkjent vanskelig ord er verdt to mynter, samlet opp i vanskord.js
  // til han trykker her -- da hentes hele summen ut paa én gang (se
  // Spill.tjenMynter) og han er hjemme igjen, i ett trykk -- ikke ferdig paa
  // ordlista og saa "tilbake" i tillegg. Ingen sammenheng med "ord lest"
  // eller boekene.
  $("#vanskordFerdig").onclick = function () {
    var n = Vanskord.hentUtMynter();
    if (n > 0) Spill.tjenMynter(n);
    tilHus();
  };

  $("#lesEnTil").onclick = function () { lesFraEmne(sisteEmne); };

  /* ---------- Oppstart ---------- */

  Spillere.tegn();
  // Banken og robotkatalogen hentes foer noe tegnes, ellers staar kortene
  // tomme et oeyeblikk.
  Promise.all([Bank.last(), Figurer.last()]).then(function () {
    // Spillerkortene ble tegnet foer robotkatalogen kom paa plass, saa en
    // som alt har valgt en robot fikk forbokstaven i stedet et kort
    // oeyeblikk. Tegnes paa nytt her, naar Figurer.finn() faktisk virker.
    Spillere.tegn();
    // Den som leste sist slipper aa velge seg selv paa nytt hver gang.
    if (Lagring.aktiv()) tilHus();
    else vis("spillere");
  });
})();
