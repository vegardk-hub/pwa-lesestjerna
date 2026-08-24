/* Lyttemotor: Microsofts Pronunciation Assessment (nettbasert, eksperimentell).
 *
 * Motsatt av de to andre: her VET motoren på forhånd hvilken tekst han skal
 * lese (se "tekst" i Stemme.lytter.start(), stemme.js), og bruker det til å
 * be Azure vurdere hvert eneste ord opp mot akkurat den fasiten -- ikke bare
 * gjette hva som ble sagt, slik de to andre motorene gjør. Ordene Azure sier
 * seg fornøyd med, sendes videre gjennom Stemme.lytter sitt vanlige
 * resultat-hook som om de var en helt vanlig transkripsjon -- lesing.js sin
 * egen ord-for-ord-matching gjør resten, akkurat som med de andre motorene.
 *
 * Krever en Azure-taleressurs (abonnementsnøkkel + region), lagt inn i
 * Foreldrekontroll. Ligger bare på denne enheten -- se lagring.js. Lyden
 * sendes til Microsofts tjeneste for vurdering (motsatt av
 * js/lyttemotor-whisper.js, som aldri sender noe noe sted).
 *
 * TERSKELEN for "grønt" er satt bevisst lavt (MIN_SCORE under) -- målet er
 * å måle at han faktisk sa ordet, ikke at uttalen er feilfri. Se også
 * enableMiscue (under) som gjør at Azure selv oppdager ord han hoppet over
 * eller la til, ikke bare hvor godt han uttalte dem han sa.
 */
(function (global) {
  "use strict";

  var SDK_URL = "https://cdn.jsdelivr.net/npm/microsoft-cognitiveservices-speech-sdk@latest/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js";

  // Raus med vilje -- se forklaringen oeverst i fila. Azure sin egen skala
  // er 0-100, der under ca. 40 vanligvis regnes som "daarlig" uttale. Vi
  // bryr oss bare om han i det hele tatt sa noe som lignet ordet.
  var MIN_SCORE = 30;

  var stoettes = !!(global.navigator && global.navigator.mediaDevices && global.navigator.mediaDevices.getUserMedia);

  var lastingSdk = null; // Promise<SpeechSDK>
  var aktiv = null;      // { recognizer, avbrutt } -- null naar vi ikke lytter

  function lastSdk() {
    if (global.SpeechSDK) return Promise.resolve(global.SpeechSDK);
    if (lastingSdk) return lastingSdk;
    lastingSdk = new Promise(function (ok, feil) {
      var s = document.createElement("script");
      s.src = SDK_URL;
      s.onload = function () {
        if (global.SpeechSDK) ok(global.SpeechSDK);
        else feil(new Error("Azure-biblioteket lastet, men SpeechSDK mangler"));
      };
      s.onerror = function () { feil(new Error("Klarte ikke å laste Azure-biblioteket")); };
      document.head.appendChild(s);
    });
    return lastingSdk;
  }

  // Sant naar ordet enten var perfekt, eller i det minste godt nok til at
  // det telles som lest -- se MIN_SCORE oeverst. "Omission" betyr Azure
  // ikke hoerte ordet i det hele tatt, uansett score -- det skal aldri
  // telle, uansett hvor raust vi ellers er.
  function godkjentOrd(w) {
    var pa = w.PronunciationAssessment || {};
    if (pa.ErrorType === "Omission") return false;
    return pa.AccuracyScore === undefined || pa.AccuracyScore >= MIN_SCORE;
  }

  function start(hooks, tekst) {
    stopp();
    var nokkel = global.Lagring && Lagring.azureNokkel();
    var region = global.Lagring && Lagring.azureRegion();
    if (!nokkel || !region) {
      hooks.feil("mangler-noekkel",
        "Denne lyttemotoren trenger en Azure-nøkkel og -region, lagt inn i Foreldrekontroll.");
      hooks.tilstand(false);
      return;
    }

    var oekt = { avbrutt: false, recognizer: null };
    aktiv = oekt;

    lastSdk().then(function (SpeechSDK) {
      if (oekt.avbrutt) return;

      var speechConfig = SpeechSDK.SpeechConfig.fromSubscription(nokkel, region);
      speechConfig.speechRecognitionLanguage = "nb-NO";
      var audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      var recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

      // enableMiscue: Azure sammenlikner selv mot fasitteksten og merker
      // ord han hoppet over eller la til, ikke bare hvor godt han uttalte
      // dem han faktisk sa.
      var pronConfig = new SpeechSDK.PronunciationAssessmentConfig(
        tekst || "",
        SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
        SpeechSDK.PronunciationAssessmentGranularity.Word,
        true
      );
      pronConfig.applyTo(recognizer);

      // Mellomvariant -- rein transkripsjon, ingen vurdering ennaa. Brukes
      // bare til aa flytte pekeren midlertidig mens han fortsatt snakker.
      recognizer.recognizing = function (s, e) {
        if (e.result && e.result.text) hooks.resultat([e.result.text], false);
      };

      // Endelig -- her har Azure ordvurderingen klar. Bygger en tekststreng
      // av bare de ordene han fikk godkjent (se godkjentOrd over), og sender
      // den gjennom akkurat samme kanal som en vanlig transkripsjon --
      // lesing.js sin egen matching trenger ikke vite forskjellen.
      recognizer.recognized = function (s, e) {
        if (!e.result || e.result.reason !== SpeechSDK.ResultReason.RecognizedSpeech) return;
        var ord = [];
        try {
          var raa = e.result.properties.getProperty(SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult);
          var data = JSON.parse(raa);
          ord = (data.NBest && data.NBest[0] && data.NBest[0].Words) || [];
        } catch (feil) { /* ingen vurdering denne runden -- bruk raateksten under i stedet */ }

        var godkjente = ord.filter(godkjentOrd).map(function (w) { return w.Word; });
        var samlet = godkjente.length ? godkjente.join(" ") : e.result.text;
        if (samlet) hooks.resultat([samlet], true);
      };

      recognizer.canceled = function (s, e) {
        if (e.reason === SpeechSDK.CancellationReason.Error) {
          hooks.feil("azure-feil", "Den nettbaserte lyttemotoren fikk en feil: " +
            (e.errorDetails || e.errorCode || "ukjent"));
          hooks.tilstand(false);
        }
      };

      oekt.recognizer = recognizer;
      recognizer.startContinuousRecognitionAsync(
        function () { /* i gang */ },
        function (feilmelding) {
          hooks.feil("azure-feil", "Klarte ikke å starte den nettbaserte lyttemotoren: " + feilmelding);
          hooks.tilstand(false);
        }
      );
    }).catch(function (e) {
      if (oekt.avbrutt) return;
      hooks.feil("azure-feil", "Klarte ikke å laste den nettbaserte lyttemotoren: " +
        ((e && e.message) || String(e)));
      hooks.tilstand(false);
    });
  }

  function stopp() {
    if (!aktiv) return;
    var oekt = aktiv;
    aktiv = null;
    oekt.avbrutt = true;
    var r = oekt.recognizer;
    if (r) {
      try {
        r.stopContinuousRecognitionAsync(
          function () { try { r.close(); } catch (e) { /* alt lukket */ } },
          function () { try { r.close(); } catch (e) { /* alt lukket */ } }
        );
      } catch (e) { /* alt stoppet */ }
    }
  }

  global.Stemme.lyttemotorer.registrer({
    id: "azure",
    navn: "Microsoft Azure (nettbasert, eksperimentell)",
    stoettes: stoettes,
    start: start,
    stopp: stopp
  });
})(window);
