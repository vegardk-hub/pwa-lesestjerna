/* Norsk tekstbehandling for Lesestjerna.
 *
 * Portert fra stemmeklone/norsk_tekst.py. Bare setningsdelingen er tatt med.
 * Normaliseringen der (tall og forkortelser skrevet ut som ord) hoerer ikke
 * hjemme her: den ville endre teksten som sendes til stemmen, og da stemmer
 * den ikke lenger overens med teksten paa skjermen som gutten leser.
 *
 * Aa dele naivt paa punktum revner "17. mai", "dvs. ca." og "H. C. Andersen"
 * midt i. En setning som revner blir til to halve oppgaver, og den andre
 * halvdelen begynner med liten bokstav.
 */
(function (global) {
  "use strict";

  // "kl." staar ikke i Python-lista. Den trengtes ikke der, fordi normaliseringen
  // gjorde "kl. 11.30" om til "klokka elleve tretti" foer delingen. Her kommer
  // teksten urort inn, og uten denne revner setningen etter "kl.".
  var FORKORTELSER = ["bl.a.", "bla.", "f.eks.", "feks.", "dvs.", "osv.",
    "m.m.", "o.l.", "mfl.", "pga.", "iht.", "jf.", "ca.", "evt.", "inkl.",
    "ekskl.", "nr.", "tlf.", "dr.", "prof.", "kl."];

  var MAANEDER = ["januar", "februar", "mars", "april", "mai", "juni", "juli",
    "august", "september", "oktober", "november", "desember"];

  var SMAA = /^[a-zæøå]/;
  var ORD_FORAN = /[0-9a-zA-ZæøåÆØÅ.]+$/;

  function ekteGrense(tekst, start, slutt, treff) {
    if (treff[0] !== ".") return true;          // ! og ? er alltid slutt

    var etter = tekst.slice(slutt).replace(/^\s+/, "");
    var m = tekst.slice(0, start).match(ORD_FORAN);
    var o = m ? m[0] : "";

    // "dvs. ca.", "kl. 11", "17. mai" — fortsettelsen har liten bokstav
    if (etter && SMAA.test(etter)) return false;

    // "17. Mai" — tall foran, maanedsnavn etter
    if (/^\d+$/.test(o)) {
      var neste = etter.split(/\s+/)[0].toLowerCase().replace(/[,.:;!?]+$/, "");
      if (MAANEDER.indexOf(neste) !== -1) return false;
    }

    if (FORKORTELSER.indexOf((o + ".").toLowerCase()) !== -1) return false;

    // Initial i navn: "H. C. Andersen"
    if (o.length === 1 && o === o.toUpperCase() && /[a-zæøå]/i.test(o)) return false;

    return true;
  }

  /* Deler teksten i setninger. Én setning per element, tegnsetting beholdt. */
  function setninger(tekst) {
    var re = /[.!?]+["»']?(?=\s|$)/g;
    var ut = [], forrige = 0, m;
    while ((m = re.exec(tekst)) !== null) {
      if (!ekteGrense(tekst, m.index, re.lastIndex, m[0])) continue;
      var s = tekst.slice(forrige, re.lastIndex).trim();
      if (s) ut.push(s);
      forrige = re.lastIndex;
    }
    var rest = tekst.slice(forrige).trim();
    if (rest) ut.push(rest);
    return ut;
  }

  /* Deler teksten i avsnitt, og hvert avsnitt i setninger. Tomme linjer i
   * innlimt tekst er ekte avsnittsskiller og skal ikke forsvinne. */
  function avsnitt(tekst) {
    return tekst.split(/\n\s*\n/)
      .map(function (a) { return setninger(a.replace(/\s+/g, " ").trim()); })
      .filter(function (a) { return a.length; });
  }

  /* Reduserer et ord til det som skal sammenliknes med det gjenkjenneren hoerte.
   *
   * Maa fjerne baade tegnsetting og stor forbokstav. Gjenkjenneren gir
   * "gutten gikk i" underveis, men "Gutten gikk i sjuende klasse." naar den er
   * ferdig — uten dette ville siste ord slutte aa lyse i samme oeyeblikk som
   * resultatet ble endelig.
   */
  function reint(ord) {
    return ord
      .toLowerCase()
      .replace(/[^0-9a-zæøåäöéèüà]/g, "");
  }

  /* ---------- Tall ----------
   *
   * Gjenkjenneren gir "2469" der teksten sier "to tusen fire hundre og
   * sekstini". Loesningen er aa regne ut hva teksten *mener*, ikke aa gjette
   * hvordan gjenkjenneren staver. Da spiller det ingen rolle om det staar
   * "sju" eller "syv" i teksten — begge blir sju.
   */
  var ENERE = {
    "null": 0, "en": 1, "én": 1, "ett": 1, "to": 2, "tre": 3, "fire": 4,
    "fem": 5, "seks": 6, "sju": 7, "syv": 7, "åtte": 8, "ni": 9, "ti": 10,
    "elleve": 11, "tolv": 12, "tretten": 13, "fjorten": 14, "femten": 15,
    "seksten": 16, "sytten": 17, "atten": 18, "nitten": 19
  };

  var TIERE = { "tjue": 20, "tretti": 30, "førti": 40, "femti": 50,
                "seksti": 60, "sytti": 70, "åtti": 80, "nitti": 90 };

  // "tjueen", "sekstini" og resten. Skrives sammen paa moderne norsk.
  Object.keys(TIERE).forEach(function (t) {
    ["en", "to", "tre", "fire", "fem", "seks", "sju", "syv", "åtte", "ni"]
      .forEach(function (e) { ENERE[t + e] = TIERE[t] + ENERE[e]; });
  });
  Object.keys(TIERE).forEach(function (t) { ENERE[t] = TIERE[t]; });

  var GANGERE = { "hundre": 100, "tusen": 1000,
                  "million": 1e6, "millioner": 1e6,
                  "milliard": 1e9, "milliarder": 1e9 };

  function erTallord(rein) {
    return ENERE[rein] !== undefined || GANGERE[rein] !== undefined;
  }

  /* Regner ut verdien av en rekke tallord. Gir null om rekka ikke er et tall. */
  function tallverdi(reine) {
    var sum = 0, gruppe = 0, sett = false;
    for (var i = 0; i < reine.length; i++) {
      var o = reine[i];
      // "og" binder sammen inni tallet: "fire hundre OG sekstini".
      if (o === "og") { if (!sett) return null; continue; }
      if (ENERE[o] !== undefined) {
        gruppe += ENERE[o];
        sett = true;
      } else if (GANGERE[o] !== undefined) {
        var g = GANGERE[o];
        // "hundre" ganger opp det som staar foran; "tusen" og oppover legger
        // hele gruppa til side og begynner paa nytt.
        if (g === 100) gruppe = (gruppe || 1) * 100;
        else { sum += (gruppe || 1) * g; gruppe = 0; }
        sett = true;
      } else {
        return null;
      }
    }
    return sett ? sum + gruppe : null;
  }

  global.Tekst = {
    setninger: setninger,
    avsnitt: avsnitt,
    reint: reint,
    erTallord: erTallord,
    tallverdi: tallverdi
  };
})(window);
