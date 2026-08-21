/* Foreldrekontroll: en firesifret kode som styrer om knappen "Les den for
 * meg" skal vises i lesevisningen.
 *
 * Koden er ikke ekte sikkerhet -- den ligger i klartekst i localStorage som
 * alt annet i appen. Poenget er bare at et barn ikke skal kunne skru på
 * hjelpeknappen selv ved et uhell, ikke å beskytte noe verdifullt.
 *
 * Første gang noen åpner dette, finnes det ingen kode ennå, og skjermen ber
 * om å lage en i stedet for å låse opp. Det er samme skjerm begge veier --
 * bare teksten og hva trykket gjør er forskjellig.
 */
(function (global) {
  "use strict";

  var $ = function (v) { return document.querySelector(v); };

  function feilmelding(t) {
    $("#foreldreFeil").textContent = t || "";
  }

  function visLaas() {
    $("#foreldreInnstillinger").hidden = true;
    $("#foreldreLaas").hidden = false;
    $("#foreldrePin").value = "";
    feilmelding("");

    var harPin = Lagring.harForeldrePin();
    $("#foreldreLaasTekst").textContent = harPin
      ? "Skriv inn firesifret kode for å endre innstillinger."
      : "Lag en firesifret kode. Den trengs neste gang noen vil hit.";
    $("#foreldreLaasOpp").textContent = harPin ? "Lås opp" : "Lag kode";
    $("#foreldrePin").focus();
  }

  function visInnstillinger() {
    $("#foreldreLaas").hidden = true;
    $("#foreldreInnstillinger").hidden = false;
    $("#lesForMegVeksle").checked = Lagring.lesForMegPaa();
  }

  $("#foreldreLaasOpp").onclick = function () {
    var kode = $("#foreldrePin").value.trim();
    if (!/^\d{4}$/.test(kode)) {
      feilmelding("Koden må være fire tall.");
      return;
    }
    if (Lagring.harForeldrePin()) {
      if (!Lagring.sjekkForeldrePin(kode)) {
        feilmelding("Feil kode.");
        $("#foreldrePin").value = "";
        $("#foreldrePin").focus();
        return;
      }
    } else {
      Lagring.settForeldrePin(kode);
    }
    visInnstillinger();
  };

  $("#foreldrePin").addEventListener("keydown", function (e) {
    if (e.key === "Enter") $("#foreldreLaasOpp").click();
  });

  $("#lesForMegVeksle").onchange = function () {
    Lagring.settLesForMeg(this.checked);
  };

  function lukk() {
    $("#foreldre").hidden = true;
    $("#velgSpiller").hidden = false;
  }

  $("#lukkForeldreLaas").onclick = lukk;
  $("#lukkForeldre").onclick = lukk;

  global.Foreldre = {
    apne: function () {
      $("#velgSpiller").hidden = true;
      $("#foreldre").hidden = false;
      visLaas();
    }
  };
})(window);
