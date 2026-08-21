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

  var EKSEMPEL =
    "Gutten gikk i sjuende klasse. Hver morgen gikk han den samme veien til " +
    "skolen, forbi den gamle butikken og ned mot elva.\n\n" +
    "En dag i november så han noe som lå i snøen ved brua. Det var en liten " +
    "hund. Den ristet på hele kroppen, og den hadde ingen bånd rundt halsen.\n\n" +
    "«Hei,» sa gutten forsiktig. «Har du gått deg bort?»";

  var naa = null;        // teksten som leses akkurat naa, null for innlimt
  var sisteEmne = null;  // hvor "Les en til" skal hente neste fra

  function vis(hvilken) {
    $("#velgSpiller").hidden = hvilken !== "spillere";
    $("#hus").hidden = hvilken !== "hus";
    $("#verden").hidden = hvilken !== "verden";
    $("#start").hidden = hvilken !== "tekst";
    $("#lesing").hidden = hvilken !== "lesing";
    $("#ferdig").hidden = hvilken !== "ferdig";
    $("#verktoy").hidden = hvilken !== "lesing";
    $("#stjerner").hidden = hvilken !== "lesing";
    $("#boka").hidden = true;

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
    // Innlimt tekst har ingen id og betaler derfor hver gang. Tekster fra
    // banken betaler én gang — id-en er noekkelen til hvilke han har lest.
    var b = Spill.betal(naa ? naa.id : null, r);
    tegnSpillerknapp();

    if (b.alleredeLest) {
      $("#ferdigTittel").textContent = "Fint lest om igjen!";
      $("#ferdigTall").textContent = b.beskjed;
      $("#ferdigBok").textContent = "";
    } else {
      $("#ferdigTittel").textContent = naa ? naa.tittel + " er lest!" : "Hele teksten er lest!";
      $("#ferdigTall").textContent =
        r.ord + " ord \u00b7 " + r.setninger + " stjerner \u00b7 " +
        "+" + b.mynter + " mynter";
      $("#ferdigBok").textContent = b.nyeBoker
        ? "Du fylte en hel bok \u2014 du er level " + b.level + " nå!"
        : (b.tilNesteBok
            ? b.tilNesteBok.mangler + " ord igjen til bok nummer " + b.tilNesteBok.nr + "."
            : "");
    }

    $("#lesEnTil").textContent = sisteEmne ? "Les en til" : "Lim inn en ny tekst";
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

  $("#limInn").onclick = function () {
    sisteEmne = null;
    vis("tekst");
  };

  $("#lesEnTil").onclick = function () {
    if (sisteEmne) lesFraEmne(sisteEmne);
    else vis("tekst");
  };

  $("#eksempel").onclick = function () { $("#innTekst").value = EKSEMPEL; };

  $("#settIGang").onclick = function () {
    var t = $("#innTekst").value.trim();
    if (!t) { $("#innTekst").focus(); return; }
    naa = null;
    sisteEmne = null;
    les({ tekst: t });
  };

  /* ---------- Hva maskinen kan tilby ---------- */

  function tegnFasit() {
    var v = Stemme.valgtStemme();
    var ja = function (t) { return '<span class="ja">' + t + "</span>"; };
    var nei = function (t) { return '<span class="nei">' + t + "</span>"; };
    var linjer = [];

    if (!Stemme.lytter.stoettes) {
      linjer.push("<div>" + nei("Denne nettleseren kan ikke lytte.") +
                  " Lesestjerna trenger Edge.</div>");
    }
    if (!v) {
      linjer.push("<div>" + nei("Ingen norsk stemme funnet.") +
                  " Hjelpen med å si ordene virker ikke.</div>");
    } else if (/\bfinn\b/i.test(v.name)) {
      linjer.push("<div>Leses av " + ja(v.name) + "</div>");
    } else {
      linjer.push("<div>Leses av " + v.name + ". " +
                  (Stemme.erEdge
                    ? "Finn er ikke tilgjengelig nå — er du på nett?"
                    : "Finn finnes bare i Edge.") + "</div>");
    }
    if (!navigator.onLine) {
      linjer.push("<div>" + nei("Ikke på nett.") +
                  " Både lyttingen og Finn trenger nettet.</div>");
    }
    $("#fasit").innerHTML = linjer.join("");
  }

  speechSynthesis.onvoiceschanged = tegnFasit;
  tegnFasit();

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
