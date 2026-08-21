/* Lesemotoren i Lesestjerna. Gutten leser hoegt, appen lytter, ordene lyser.
 *
 * Denne fila eier lesesskjermen og ingenting annet: teksten, mikrofonen,
 * stjernene og de fire hjelpeknappene. Den vet ikke hvor teksten kommer fra og
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

  /* ---------- Bygge teksten ---------- */

  function bygg(raatekst, vanskelige) {
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
    meldtFerdig = false;
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
  function match(hoert, endelig) {
    // En mellomvariant sender hele fragmentet paa nytt hver gang, saa det den
    // markerte forrige runde tas bort foer vi gaar gjennom paa ny. Endelige
    // treff blir staaende.
    midlertidige.forEach(function (i) { ord[i].truffet = false; });
    midlertidige = [];

    var sagt = hoert.split(/\s+/).map(Tekst.reint).filter(Boolean);
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
        if (ord[j].rein === o) {
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
      var fast = Date.now() - sistFramgang > 7000;
      ord[peker].el.classList.toggle("venter", fast);
      if (fast) beskjed("Står du fast? Trykk på ordet, så sier jeg det.");
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
  // fast i det. Ordet lyser, og han gaar videre.
  $("#hoppOver").onclick = function () {
    if (peker >= ord.length) return;
    ord[peker].truffet = true;
    ord[peker].hoppet = true;
    midlertidige = midlertidige.filter(function (i) { return i !== peker; });
    gaaVidere();
    peker = foersteUtreffet();
    sistFramgang = Date.now();
    tegn();
  };

  $("#lesForMeg").onclick = function () {
    if (!ord.length) return;
    var s = naaSetning();
    var tekst = ord.slice(s.ordFra, s.ordTil).map(function (o) { return o.tekst; }).join(" ");
    sistFramgang = Date.now();
    beskjed("Hør etter, så prøver du.");
    Stemme.si(tekst).catch(function () { beskjed("Fant ingen norsk stemme.", true); });
  };

  $("#paaNytt").onclick = function () {
    if (!ord.length) return;
    var s = naaSetning();
    for (var i = s.ordFra; i < s.ordTil; i++) {
      ord[i].truffet = false;
      ord[i].hoppet = false;
    }
    s.ferdig = false;
    basis = s.ordFra;
    peker = s.ordFra;
    midlertidige = [];
    sistFramgang = Date.now();
    tegn();
    beskjed("Vær så god, prøv en gang til.");
  };

  $("#mikrofon").onclick = function () {
    if (Stemme.lytter.vil) {
      Stemme.lytter.stopp();
    } else {
      sistFramgang = Date.now();
      Stemme.lytter.start();
    }
  };

  /* ---------- Kobling mot stemmelaget ---------- */

  Stemme.lytter.paaResultat = function (hoert, endelig) {
    if (ord.length) match(hoert, endelig);
  };

  Stemme.lytter.paaFeil = function (kode, forklaring) { beskjed(forklaring, true); };

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
      beskjed("Trykk på den store knappen når du er klar.");
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
