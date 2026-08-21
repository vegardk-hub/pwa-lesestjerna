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

  function vis(hvilken) {
    $("#velgSpiller").hidden = hvilken !== "spillere";
    $("#hus").hidden = hvilken !== "hus";
    $("#verden").hidden = hvilken !== "verden";
    $("#lesing").hidden = hvilken !== "lesing";
    $("#ferdig").hidden = hvilken !== "ferdig";
    $("#verktoy").hidden = hvilken !== "lesing";
    $("#stjerner").hidden = hvilken !== "lesing";
    $("#boka").hidden = true;

    // "Les den for meg" er avslaatt som standard -- se foreldre.js. Satt
    // hver gang, ikke bare ved oppstart, i tilfelle en forelder endrer den
    // mens han allerede leser.
    if (hvilken === "lesing") $("#lesForMeg").hidden = !Lagring.lesForMegPaa();

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
    $("#byttSpiller").textContent =
      s.navn + " \u00b7 lvl " + Spill.level(s) + " \u00b7 " + s.mynter + " \u25c9";
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

  /* ---------- Lesing ---------- */

  function les(oppgave) {
    vis("lesing");
    Lesing.start(oppgave, { ferdig: ferdig });
  }

  function lesFraEmne(emneId) {
    var t = Bank.neste(emneId);
    if (!t) return;
    naa = t;
    sisteEmne = emneId;
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
    }

    vis("ferdig");
  }

  /* ---------- Knapper ---------- */

  Spillere.naarValgt(tilHus);
  Verden.naarValgt(lesFraEmne);
  Verden.naarHjem(tilHus);

  $("#byttSpiller").onclick = function () {
    Lesing.stopp();
    Spillere.tegn();
    vis("spillere");
  };

  $("#tilbake").onclick = function () {
    if ($("#verden").hidden) tilVerden();
    else tilHus();
  };
  $("#tilVerden").onclick = tilVerden;
  $("#tilHus").onclick = tilHus;
  $("#utOgLes").onclick = tilVerden;
  $("#apneBoka").onclick = Hus.apneBoka;
  $("#apneButikk").onclick = Butikk.apne;
  $("#apneSamling").onclick = Samling.apne;
  $("#apneForeldre").onclick = Foreldre.apne;

  $("#lesEnTil").onclick = function () { lesFraEmne(sisteEmne); };

  /* ---------- Oppstart ---------- */

  Spillere.tegn();
  // Banken og robotkatalogen hentes foer noe tegnes, ellers staar kortene
  // tomme et oeyeblikk.
  Promise.all([Bank.last(), Figurer.last()]).then(function () {
    // Den som leste sist slipper aa velge seg selv paa nytt hver gang.
    if (Lagring.aktiv()) tilHus();
    else vis("spillere");
  });
})();
