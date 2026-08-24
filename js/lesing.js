/* Lesemotoren i Lesestjerna. Gutten leser hoegt, appen lytter, ordene lyser.
 *
 * Denne fila eier lesesskjermen og ingenting annet: teksten, mikrofonen,
 * stjernene og hjelpeknappene. Den vet ikke hvor teksten kommer fra og
 * ikke hva som skjer etterpaa — den sier bare fra naar oekta er over, og
 * forteller hvor mye som ble lest. Da kan den samme motoren brukes bade av
 * innlimt tekst og av spillet.
 *
 *   Lesing.start({ tekst: "...", vanskeligeOrd: [...] }, { ferdig: fn })
 *   Lesing.stopp()
 *
 * Reglene som gjelder alle appene i huset gjelder her ogsaa: ingen klokke,
 * ingen maate aa tape paa, alt kan gjoeres om igjen. Leser han feil, skjer det
 * ingenting — ordet blir staaende og vente. Det finnes ikke roedt her.
 */
(function (global) {
  "use strict";

  var $ = function (v) { return document.querySelector(v); };

  /* ---------- Tilstand ---------- */

  var raaTekst = "";     // hele teksten slik den kom inn, til Stemme.lytter.start()
  var ord = [];          // flat liste over alle ordene i hele teksten
  var setninger = [];    // { ordFra, ordTil, el, ferdig }
  var basis = 0;         // hvor langt endelige resultater har foert oss
  var peker = 0;         // ordet han skal lese naa
  var midlertidige = []; // ord en mellomvariant har markert, og som kan tas bort
  var stjerner = 0;
  var sistFramgang = 0;
  var sistRullet = -1;
  var venteur = null;
  var kroker = {};       // { ferdig }
  var meldtFerdig = false;
  var forsoktPeker = -1; // hvilket ord de siste mislykkede forsokene gjaldt
  var forsokUtenFramgang = 0;

  /* ---------- Bygge teksten ---------- */

  function bygg(raatekst, vanskelige) {
    raaTekst = raatekst;
    var vansk = {};
    (vanskelige || []).forEach(function (o) {
      var r = Tekst.reint(o);
      if (r) vansk[r] = true;
    });

    var boks = $("#tekst");
    boks.textContent = "";
    ord = [];
    setninger = [];

    Tekst.avsnitt(raatekst).forEach(function (avsn) {
      var p = document.createElement("p");
      p.className = "avsnitt";
      avsn.forEach(function (setn, nr) {
        var sEl = document.createElement("span");
        sEl.className = "setning";
        var post = { ordFra: ord.length, ordTil: 0, el: sEl, ferdig: false };
        var sIndeks = setninger.length;

        setn.split(/\s+/).forEach(function (o, i) {
          if (i) sEl.append(" ");
          var rein = Tekst.reint(o);
          var el = document.createElement("span");
          el.className = "ord";
          el.textContent = o;
          if (rein) {
            el.dataset.i = ord.length;
            ord.push({
              tekst: o, rein: rein, el: el, s: sIndeks,
              truffet: false, hoppet: false, vanskelig: !!vansk[rein],
              tall: null
            });
          }
          sEl.append(el);
        });

        post.ordTil = ord.length;
        // En setning der *alle* ordene er merket vanskelige ville aldri kunne
        // bli ferdig, siden vanskelige ord ikke teller med. Da gjelder de
        // vanlige reglene for hele setningen i stedet.
        if (!harVanligOrd(post)) {
          for (var i = post.ordFra; i < post.ordTil; i++) ord[i].vanskelig = false;
        }
        merkTall(post);
        setninger.push(post);
        p.append(sEl);
        if (nr < avsn.length - 1) p.append(" ");
      });
      boks.append(p);
    });

    basis = 0; peker = 0; midlertidige = []; stjerner = 0; sistRullet = -1;
    meldtFerdig = false; forsoktPeker = -1; forsokUtenFramgang = 0;
    // Mikrofonen startes na med det samme (se start()), ikke ved et trykk
    // paa knappen -- den satte foer i gang klokka for "staar du fast?".
    // Uten denne linja ville den klokka fortsatt staa paa forrige oekt, og
    // "staar du fast?" kunne dukke opp med det samme paa det aller foerste
    // ordet i en ny tekst.
    sistFramgang = Date.now();
    $("#stjerner").textContent = "\u2605 0";
    tegn();
  }

  function harVanligOrd(s) {
    for (var i = s.ordFra; i < s.ordTil; i++) if (!ord[i].vanskelig) return true;
    return false;
  }

  /* Finner tallene i en setning og regner ut hva de betyr.
   *
   * Gjenkjenneren gir "2469" for hele munnfullen "to tusen fire hundre og
   * sekstini". Loesningen er aa regne ut hva teksten *mener*, og sammenlikne
   * tall med tall. Da spiller det ingen rolle om det staar "sju" eller "syv" i
   * teksten, og alle de seks ordene kan lyse ekte groent i stedet for aa bli
   * gitt bort naar setningen er ferdig.
   *
   * "og" hoerer med bare naar det staar *inni* tallet: "fire hundre OG
   * sekstini", ikke "tre kilo og en halv time". */
  function merkTall(post) {
    var i = post.ordFra;
    while (i < post.ordTil) {
      if (!Tekst.erTallord(ord[i].rein)) { i++; continue; }

      var j = i + 1;
      while (j < post.ordTil) {
        if (Tekst.erTallord(ord[j].rein)) { j++; continue; }
        if (ord[j].rein === "og" && j + 1 < post.ordTil
            && Tekst.erTallord(ord[j + 1].rein)) { j += 2; continue; }
        break;
      }

      var reine = [];
      for (var k = i; k < j; k++) reine.push(ord[k].rein);
      var verdi = Tekst.tallverdi(reine);
      if (verdi !== null) {
        var gruppe = { fra: i, til: j, verdi: verdi };
        for (k = i; k < j; k++) ord[k].tall = gruppe;
      }
      i = j;
    }
  }

  /* ---------- Matching ----------
   *
   * `basis` er *foerste ord i setningen han holder paa med* — ikke det siste
   * ordet som ble truffet. Det er forskjellen mellom en app som virker og en
   * som ikke gjoer det: hoerer gjenkjenneren "gir" der det staar "gikk", ville
   * en peker som bare gaar framover legge ordet bak seg for godt, og han kunne
   * lese setningen aldri saa riktig uten at hullet ble fylt. Naar hver
   * gjennomlesing i stedet begynner paa nytt fra setningens foerste ord, fanges
   * ordet opp neste gang han sier det.
   *
   * Vi tillater at inntil to ord bommer underveis, ellers ville ett feilhoert
   * ord sperre resten av setningen. Men de overhoppede ordene lyser *ikke*:
   * sier han "revet" der det staar "reven", skal han ikke ha groent for det.
   */

  // Store tall kommer av og til med mellomrom som tusenskille -- "250 000" i
  // stedet for "250000" -- og da splittes de i to ord av split(/\s+/) over.
  // Hver del for seg matcher ingenting, og gruppa lyser aldri. Et tall-ord
  // etterfulgt av noeyaktig tre nye siffer er alltid en fortsettelse av det
  // forrige, aldri et nytt tall, saa de kan trygt limes sammen igjen.
  function slaaSammenTusenskille(sagt) {
    var ut = [];
    sagt.forEach(function (o) {
      var forrige = ut.length - 1;
      if (forrige >= 0 && /^\d+$/.test(ut[forrige]) && /^\d{3}$/.test(o)) {
        ut[forrige] += o;
      } else {
        ut.push(o);
      }
    });
    return ut;
  }

  // Gjenkjenneren hoerer titt og ofte nesten riktig -- en dialektendelse, en
  // vokal som blir feiltolket -- og da hjelper det ikke aa spoerre om flere
  // tolkninger, for ingen av dem treffer bokstavrett. Et ord som ligger tett
  // nok (faa bokstaver unna) skal telle likevel. Korte ord holdes utenfor:
  // "en" er bare to bokstaver fra de fleste andre smaa ord, og ville truffet
  // altfor mye feil.
  function likTNok(a, b) {
    if (a.length < 4 || b.length < 4) return a === b;
    var tillatt = (a.length > 7 || b.length > 7) ? 2 : 1;
    return avstand(a, b, tillatt + 1) <= tillatt;
  }

  // Levenshtein-avstand, men gir opp saa fort den passerer taket -- ordene
  // her er korte og taket lite, saa dette koster ingenting merkbart.
  function avstand(a, b, tak) {
    if (Math.abs(a.length - b.length) > tak) return tak + 1;
    var forrige = [];
    for (var j = 0; j <= b.length; j++) forrige.push(j);
    for (var i = 1; i <= a.length; i++) {
      var rad = [i];
      var minRad = i;
      for (j = 1; j <= b.length; j++) {
        var kost = a[i - 1] === b[j - 1] ? 0 : 1;
        var v = Math.min(forrige[j] + 1, rad[j - 1] + 1, forrige[j - 1] + kost);
        rad.push(v);
        if (v < minRad) minRad = v;
      }
      if (minRad > tak) return tak + 1;
      forrige = rad;
    }
    return forrige[b.length];
  }

  function match(hoert, endelig) {
    // En mellomvariant sender hele fragmentet paa nytt hver gang, saa det den
    // markerte forrige runde tas bort foer vi gaar gjennom paa ny. Endelige
    // treff blir staaende.
    midlertidige.forEach(function (i) { ord[i].truffet = false; });
    midlertidige = [];

    var sagt = slaaSammenTusenskille(hoert.split(/\s+/).map(Tekst.reint).filter(Boolean));
    var i = basis;

    sagt.forEach(function (o) {
      var bom = 0;
      // Gjenkjenneren staver aldri ut et tall: "2469", ikke "to tusen fire
      // hundre og sekstini". Ett hoert siffertall svarer derfor til en hel
      // rekke ord i teksten, og de skal lyse alle sammen.
      var tall = /^\d+$/.test(o) ? parseInt(o, 10) : null;

      for (var j = i; j < ord.length && j - i < 12; j++) {
        var g = ord[j].tall;
        if (tall !== null && g && g.fra === j && g.verdi === tall) {
          for (var k = g.fra; k < g.til; k++) {
            if (!ord[k].truffet) {
              ord[k].truffet = true;
              if (!endelig) midlertidige.push(k);
            }
          }
          i = g.til;
          return;
        }
        if (ord[j].rein === o || likTNok(ord[j].rein, o)) {
          if (!ord[j].truffet) {
            ord[j].truffet = true;
            if (!endelig) midlertidige.push(j);
          }
          i = j + 1;
          return;
        }
        // Aa gaa forbi et ord han alt har lest riktig koster ingenting. Bare
        // ord som fortsatt staar grae teller mot budsjettet — ellers ville de
        // tre riktige ordene foran spise opp hoppene, og det ene ordet han
        // pruever om igjen ville aldri bli funnet.
        //
        // Vanskelige ord koster heller ingenting. De er merket nettopp fordi
        // gjenkjenneren ikke kan treffe dem, saa aa la dem tape hopp er aa
        // straffe ham for noe maskinen ikke klarer. "to tusen fire hundre og
        // sekstini" kommer tilbake som "2469" — seks ord paa rad som aldri
        // matcher. Med bare to hopp ble alt etter tallet uNaaelig, og han kunne
        // lese resten av setningen aldri saa riktig uten at et ord lyste.
        if (!ord[j].truffet && !ord[j].vanskelig && ++bom > 2) return;
      }
    });

    // Stjerna og flyttingen til neste setning venter paa et endelig resultat.
    // En mellomvariant kan trekkes tilbake i neste oeyeblikk, og en stjerne som
    // forsvinner igjen er verre enn en stjerne som kommer et halvsekund senere.
    if (endelig) gaaVidere();

    var ny = foersteUtreffet();
    if (ny !== peker) sistFramgang = Date.now();
    peker = ny;
    tegn();
  }

  /* Vanskelige ord teller ikke med. Gjenkjenneren er trent paa voksen
   * dagligtale, og "magmakammer" blir staaende graatt uansett hvor tydelig han
   * sier det. Ett slikt ord skal ikke kunne sperre stjerna for hele setningen. */
  function setningFerdig(s) {
    for (var i = s.ordFra; i < s.ordTil; i++) {
      if (!ord[i].vanskelig && !ord[i].truffet) return false;
    }
    return s.ordTil > s.ordFra;
  }

  /* Flytter basis forbi hver setning som er ferdiglest, og deler ut stjerner.
   * Leser han to setninger i ett drag, gaar begge unna her. */
  function gaaVidere() {
    while (basis < ord.length && setningFerdig(setninger[ord[basis].s])) {
      var s = setninger[ord[basis].s];
      if (!s.ferdig) {
        s.ferdig = true;
        // De vanskelige ordene sperret ikke stjerna, men de skal ikke bli
        // staaende graae i en setning som er ferdig. De lyser — uten aa telle
        // som lest, akkurat som et ord han har trykt seg forbi.
        for (var i = s.ordFra; i < s.ordTil; i++) {
          if (!ord[i].truffet) { ord[i].truffet = true; ord[i].hoppet = true; }
        }
        giStjerne();
      }
      basis = s.ordTil;
    }
  }

  /* En voksen som lytter selv kan godkjenne hele teksten med ett trykk --
   * nyttig naar gjenkjenneren sliter (stoey, dialekt, en mikrofon som ikke
   * fungerer godt), men den voksne uansett hoerer at han leser riktig. Da
   * skal *alt* telle som ekte lest, ikke som hoppet over -- det er nettopp
   * poenget med aa la en voksen godkjenne i stedet for gjenkjenneren. Knappen
   * vises bare naar en forelder har skrudd den paa, se foreldre.js. */
  function godkjennHele() {
    if (!ord.length) return;
    setninger.forEach(function (s) {
      if (!s.ferdig) { s.ferdig = true; giStjerne(); }
    });
    ord.forEach(function (o) { o.truffet = true; o.hoppet = false; });
    midlertidige = [];
    basis = ord.length;
    peker = ord.length;
    forsoktPeker = -1; forsokUtenFramgang = 0;
    beskjed("En voksen godkjente hele teksten. Bra jobbet!");
    tegn();
  }

  function foersteUtreffet() {
    for (var i = basis; i < ord.length; i++) if (!ord[i].truffet) return i;
    return ord.length;
  }

  function giStjerne() {
    stjerner++;
    var el = $("#stjerner");
    el.textContent = "\u2605 " + stjerner;
    el.classList.remove("vokser");
    void el.offsetWidth;                  // tvinger animasjonen til aa gaa om igjen
    el.classList.add("vokser");
    // Roboten hans (om han har valgt en, se hus.js) reagerer ogsaa -- appen
    // vet ikke hvordan det ser ut, bare at det skjedde. Se js/app.js.
    if (kroker.stjerne) kroker.stjerne();
  }

  /* ---------- Fasit for oekta ---------- */

  function resultat() {
    var lest = 0, hoppet = 0;
    ord.forEach(function (o) {
      if (o.hoppet) hoppet++;
      else if (o.truffet) lest++;
    });
    return {
      ord: lest,               // ord han faktisk leste hoegt
      hoppetOver: hoppet,      // ord som lyste uten aa bli lest
      setninger: stjerner,
      ordTotalt: ord.length,
      fullfoert: peker >= ord.length
    };
  }

  /* ---------- Tegne ---------- */

  function tegn() {
    var naaSetning = peker < ord.length ? ord[peker].s : setninger.length - 1;

    ord.forEach(function (o, i) {
      o.el.classList.toggle("truffet", o.truffet);
      o.el.classList.toggle("naa", i === peker);
      if (i !== peker) o.el.classList.remove("venter");
    });

    setninger.forEach(function (s, i) {
      s.el.classList.toggle("gjort", s.ferdig && i !== naaSetning);
      s.el.classList.toggle("senere", !s.ferdig && i > naaSetning);
    });

    // Bare rull naar han faktisk har flyttet seg. Gjenkjenneren sender to
    // resultater i sekundet, og teksten ville skjelve om vi rullet paa hvert.
    if (peker < ord.length) {
      if (peker !== sistRullet) {
        sistRullet = peker;
        ord[peker].el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    } else if (!meldtFerdig && ord.length) {
      meldtFerdig = true;
      var r = resultat();
      Stemme.lytter.stopp();
      clearInterval(venteur);
      if (kroker.ferdig) kroker.ferdig(r);
    }
  }

  function beskjed(t, feil) {
    $("#beskjed").textContent = t || "";
    $("#beskjed").classList.toggle("feil", !!feil);
  }

  /* ---------- Hjelp naar han staar fast ---------- */

  function passPaa() {
    clearInterval(venteur);
    venteur = setInterval(function () {
      if (!Stemme.lytter.vil || Stemme.snakker() || peker >= ord.length) return;
      var fastFoer = ord[peker].el.classList.contains("venter");
      var fast = Date.now() - sistFramgang > 7000;
      ord[peker].el.classList.toggle("venter", fast);
      if (fast) beskjed("Står du fast? Trykk på ordet, så sier jeg det.");
      else if (fastFoer) beskjed("Les høyt, du.");
    }, 1000);
  }

  /* ---------- Handlinger ---------- */

  function naaSetning() {
    return setninger[peker < ord.length ? ord[peker].s : setninger.length - 1];
  }

  // Trykk paa et ord for aa hoere det. Det endrer ingenting i framgangen —
  // hjelp skal aldri koste ham noe.
  $("#tekst").addEventListener("click", function (e) {
    var el = e.target.closest(".ord");
    if (!el || el.dataset.i === undefined) return;
    sistFramgang = Date.now();
    Stemme.si(ord[+el.dataset.i].tekst, 0.8).catch(function () {
      beskjed("Fant ingen norsk stemme.", true);
    });
  });

  // Naar gjenkjenneren rett og slett ikke vil hoere et ord, skal han ikke staa
  // fast i det. Ordet lyser, og han gaar videre. Brukt baade av knappen og av
  // det automatiske sikkerhetsnettet i paaResultat under.
  function hoppOverGjeldendeOrd() {
    if (peker >= ord.length) return;
    ord[peker].truffet = true;
    ord[peker].hoppet = true;
    midlertidige = midlertidige.filter(function (i) { return i !== peker; });
    gaaVidere();
    peker = foersteUtreffet();
    sistFramgang = Date.now();
    forsoktPeker = -1; forsokUtenFramgang = 0;
    tegn();
  }

  $("#hoppOver").onclick = hoppOverGjeldendeOrd;

  $("#godkjennHele").onclick = godkjennHele;

  $("#lesForMeg").onclick = function () {
    if (!ord.length) return;
    var s = naaSetning();
    var tekst = ord.slice(s.ordFra, s.ordTil).map(function (o) { return o.tekst; }).join(" ");
    sistFramgang = Date.now();
    beskjed("Hør etter, så prøver du.");
    Stemme.si(tekst).catch(function () { beskjed("Fant ingen norsk stemme.", true); });
  };

  $("#mikrofon").onclick = function () {
    if (Stemme.lytter.vil) {
      Stemme.lytter.stopp();
    } else {
      sistFramgang = Date.now();
      Stemme.lytter.start(raaTekst);
    }
  };

  /* ---------- Kobling mot stemmelaget ---------- */

  // Gjenkjenneren gir na en liste med tolkninger av det samme lydklippet, ikke
  // bare den ene den er sikrest paa. En mellomvariant bruker bare den beste,
  // siden den uansett blir tegnet paa nytt naar neste fragment kommer. Et
  // endelig resultat proever i stedet alle tolkningene: siden endelige treff
  // aldri viskes ut igjen (bare de midlertidige gjoer det, se toppen av
  // match()), kan vi trygt kjoere match() flere ganger paa rad -- treffene
  // legger seg oppa hverandre i stedet for aa fortrenge hverandre. Dermed
  // teller det ordet han faktisk sa, selv om det bare var gjenkjennerens
  // nest- eller tredjebeste gjetning.
  //
  // Noen ord klarer gjenkjenneren rett og slett aldri aa faa til, uansett
  // hvor mange ganger eller hvor tydelig han sier dem — et uvanlig navn, et
  // sammensatt ord, en stemme den ikke er trent paa. Uten et sikkerhetsnett
  // ville han staatt fast der for alltid, og "prov igjen" ville aldri hjelpe.
  // Derfor telles endelige forsok paa det samme ordet: gir fem forsok paa rad
  // ingen framgang i det hele tatt, oppfoerer vi oss som om han trykte paa
  // "hopp over ordet" selv. Det skal aldri skje paa forste eller andre forsok
  // — bare naar det er tydelig at han faktisk proever, om og om igjen, uten aa
  // komme videre.
  Stemme.lytter.paaResultat = function (kandidater, endelig) {
    if (!ord.length) return;
    if (!endelig) { match(kandidater[0], false); return; }

    var foer = peker;
    kandidater.forEach(function (k) { match(k, true); });

    if (peker === foer && peker < ord.length) {
      if (peker !== forsoktPeker) { forsoktPeker = peker; forsokUtenFramgang = 0; }
      forsokUtenFramgang++;
      if (forsokUtenFramgang >= 5) {
        hoppOverGjeldendeOrd();
        beskjed("Det ordet var vanskelig å høre for meg. Vi går videre!");
      }
    } else {
      forsoktPeker = -1; forsokUtenFramgang = 0;
    }
  };

  Stemme.lytter.paaFeil = function (kode, forklaring) { beskjed(forklaring, true); };

  // Framdriftsmelding, ikke en feil -- t.d. "Laster ned lyttemotoren ..."
  // fra js/lyttemotor-whisper.js foerste gang den brukes. Samme melding-
  // linje som alt annet her, bare uten den roede feil-stilen.
  Stemme.lytter.paaStatus = function (tekst) { beskjed(tekst, false); };

  Stemme.lytter.paaTilstand = function (paa) {
    var k = $("#mikrofon");
    k.classList.toggle("lytter", paa);
    k.classList.toggle("hoved", !paa);
    k.textContent = paa ? "Jeg hører etter \u2026" : "Trykk her, så hører jeg etter";
    if (paa) beskjed("Les høyt, du.");
  };

  /* ---------- Utsida ---------- */

  global.Lesing = {
    /* oppgave: { tekst, vanskeligeOrd }   kroker: { ferdig(resultat) } */
    start: function (oppgave, k) {
      kroker = k || {};
      bygg(oppgave.tekst, oppgave.vanskeligeOrd);
      // Lytteren starter na med det samme -- han skal ikke maatte trykke en
      // egen knapp foerst for hver eneste tekst eller hvert eneste ord.
      // Stemme.lytter.start() sier selv fra ("Les hoeyt, du.") naar den er i
      // gang, se paaTilstand i stemme.js. Stoetter ikke nettleseren lytting i
      // det hele tatt, blir han staaende med en forklaring i stedet.
      if (Stemme.lytter.stoettes) {
        Stemme.lytter.start(oppgave.tekst);
      } else {
        beskjed("Denne nettleseren kan ikke lytte. Prøv en annen nettleser.", true);
      }
      passPaa();
    },

    stopp: function () {
      Stemme.lytter.stopp();
      Stemme.stille();
      clearInterval(venteur);
      kroker = {};
    },

    beskjed: beskjed,
    resultat: resultat,
    godkjennHele: godkjennHele,

    // Slipper matchingen til i konsollen, saa den kan proeves uten mikrofon.
    match: match,
    tilstand: function () {
      return {
        peker: peker, basis: basis, stjerner: stjerner,
        ord: ord.map(function (o) {
          return o.tekst + (o.hoppet ? "~" : o.truffet ? "*" : "");
        }).join(" ")
      };
    }
  };
})(window);
