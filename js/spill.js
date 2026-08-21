/* Oekonomien i Lesestjerna: mynter, telling, boeker og level.
 *
 * Ingen skjerm her, bare regnestykkene. Da kan de proeves uten mikrofon og
 * uten grafikk, og de kan endres uten aa roere lesemotoren.
 *
 * To regler henger sammen med husreglene og maa ikke rotes bort:
 *   - Det trekkes aldri mynter, og level kan aldri gaa ned.
 *   - Hjelp koster ingenting. Et ord han trykte seg forbi gir ingen mynt, men
 *     det er *ingen bonus*, ikke en straff. Forskjellen betyr alt for en
 *     aatteaaring.
 */
(function (global) {
  "use strict";

  var MYNT_PER_ORD = 1;
  var FULLFOERT_BONUS = 10;

  /* Bok nr. N krever 100 * N * (N+2) ord i alt: 300, 800, 1500, 2400, 3500 …
   * Med rundt 50 ord i hver tekst blir foerste bok seks tekster, den neste ti
   * til. Stigningen er med vilje: de foerste boekene skal komme fort. */
  function bokKrav(n) { return 100 * n * (n + 2); }

  function meg() { return Lagring.aktiv(); }

  /* Level 1 fra foerste oeyeblikk. Ingen begynner paa null. */
  function level(s) { return ((s || meg()) || { boker: 0 }).boker + 1; }

  function tilNesteBok(s) {
    s = s || meg();
    if (!s) return null;
    var nr = s.boker + 1;
    var krav = bokKrav(nr);
    return { nr: nr, krav: krav, mangler: Math.max(0, krav - s.ord) };
  }

  /* Betaler for en lest tekst og bokfoerer den.
   *
   * `r` er det lesemotoren gir fra seg: { ord, hoppetOver, setninger,
   * ordTotalt, fullfoert }.
   */
  function betal(tekstId, r) {
    var s = meg();
    if (!s) return null;

    s.okter++;

    // Hver tekst betaler én gang. Ellers ville den korteste teksten lest
    // foerti ganger vaere den beste maaten aa tjene penger paa, og da leser
    // han ikke noe nytt.
    if (tekstId && s.tekster.indexOf(tekstId) !== -1) {
      s.gjenlesinger++;
      Lagring.lagre();
      return {
        alleredeLest: true, mynter: 0, nyeBoker: 0,
        level: level(s), tilNesteBok: tilNesteBok(s),
        beskjed: "Denne har du lest før — les den gjerne en gang til, men myntene har du alt fått."
      };
    }

    var mynter = r.ord * MYNT_PER_ORD + (r.fullfoert ? FULLFOERT_BONUS : 0);
    var foerLevel = level(s);

    s.mynter += mynter;
    s.ord += r.ord;
    s.setninger += r.setninger;
    s.hoppetOver += r.hoppetOver || 0;
    if (tekstId) s.tekster.push(tekstId);

    var dag = Lagring.idag();
    s.dager[dag] = (s.dager[dag] || 0) + r.ord;
    s.sistBrukt = dag;

    // Leser han mye i ett jafs, kan flere boeker falle paa én gang.
    var nyeBoker = 0;
    while (s.ord >= bokKrav(s.boker + 1)) { s.boker++; nyeBoker++; }

    Lagring.lagre();

    return {
      alleredeLest: false,
      mynter: mynter,
      nyeBoker: nyeBoker,
      level: level(s),
      steg: level(s) - foerLevel,
      tilNesteBok: tilNesteBok(s)
    };
  }

  /* ---------- Butikken ---------- */

  function kjop(ting, pris, x, y) {
    var s = meg();
    if (!s || s.mynter < pris) return false;
    s.mynter -= pris;
    s.eide.push({ ting: ting, pris: pris, x: x || 0, y: y || 0 });
    Lagring.lagre();
    return true;
  }

  /* Full pris tilbake. Han skal kunne ombestemme seg uten aa tape paa det. */
  function selg(nr) {
    var s = meg();
    if (!s || !s.eide[nr]) return false;
    s.mynter += s.eide[nr].pris;
    s.eide.splice(nr, 1);
    Lagring.lagre();
    return true;
  }

  function flytt(nr, x, y) {
    var s = meg();
    if (!s || !s.eide[nr]) return false;
    s.eide[nr].x = x;
    s.eide[nr].y = y;
    Lagring.lagre();
    return true;
  }

  /* ---------- Boka paa bordet ---------- */

  function statistikk() {
    var s = meg();
    if (!s) return null;
    return {
      navn: s.navn,
      level: level(s),
      mynter: s.mynter,
      ord: s.ord,
      setninger: s.setninger,
      tekster: s.tekster.length,
      boker: s.boker,
      okter: s.okter,
      gjenlesinger: s.gjenlesinger,
      // Antall dager han har lest. Med vilje ikke en rekke som kan brytes —
      // en brutt rekke er en maate aa tape paa.
      dager: Object.keys(s.dager).length,
      tilNesteBok: tilNesteBok(s)
    };
  }

  global.Spill = {
    meg: meg,
    level: level,
    bokKrav: bokKrav,
    tilNesteBok: tilNesteBok,
    betal: betal,
    kjop: kjop,
    selg: selg,
    flytt: flytt,
    statistikk: statistikk,
    MYNT_PER_ORD: MYNT_PER_ORD,
    FULLFOERT_BONUS: FULLFOERT_BONUS
  };
})(window);
