/* Opptak: mikrofonopptak for de mytiske robotene.
 *
 * Inntil ti sekunder, én gang per robot -- trykker han paa nytt, erstattes
 * det forrige. Selve lydfila lagres av samling.js (via Lagring), denne fila
 * vet bare hvordan man faar tak i den fra mikrofonen.
 */
(function (global) {
  "use strict";

  var MAKS_MS = 10000;

  var stoettes = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
                    window.MediaRecorder);

  var opptaker = null;
  var tidsur = null;

  function start(ferdig, feil) {
    if (!stoettes) {
      if (feil) feil("Denne nettleseren støtter ikke opptak.");
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (strom) {
      var biter = [];
      opptaker = new MediaRecorder(strom);
      opptaker.ondataavailable = function (e) {
        if (e.data && e.data.size) biter.push(e.data);
      };
      opptaker.onstop = function () {
        clearTimeout(tidsur);
        strom.getTracks().forEach(function (spor) { spor.stop(); });
        var blob = new Blob(biter, { type: opptaker.mimeType || "audio/webm" });
        opptaker = null;
        if (ferdig) ferdig(blob);
      };
      opptaker.start();
      tidsur = setTimeout(stopp, MAKS_MS);
    }).catch(function () {
      if (feil) feil("Fikk ikke tilgang til mikrofonen.");
    });
  }

  function stopp() {
    clearTimeout(tidsur);
    if (opptaker && opptaker.state !== "inactive") opptaker.stop();
  }

  function pagaar() {
    return !!(opptaker && opptaker.state === "recording");
  }

  // Til lagring: en dataURL kan ligge rett i det samme localStorage-objektet
  // som resten av spilleren, uten noe eget lagringssystem ved siden av.
  function blobTilURL(blob) {
    return new Promise(function (fullfoert) {
      var leser = new FileReader();
      leser.onload = function () { fullfoert(leser.result); };
      leser.readAsDataURL(blob);
    });
  }

  global.Opptak = {
    stoettes: stoettes,
    MAKS_MS: MAKS_MS,
    start: start,
    stopp: stopp,
    pagaar: pagaar,
    blobTilURL: blobTilURL
  };
})(window);
