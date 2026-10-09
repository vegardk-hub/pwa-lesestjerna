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
    s.mynterTjent += mynter;
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

  /* Rett betaling for smaating som ikke er en hel tekst -- i dag bare de
   * vanskelige ordene (js/vanskord.js). Ingen bok- eller "ord lest"-
   * sammenheng her, bare mynter rett i lomma -- vanskelige ord skal ikke
   * bli en snarvei forbi bok-oekonomien i betal() over. */
  function tjenMynter(antall) {
    var s = meg();
    if (!s || !antall) return;
    s.mynter += antall;
    s.mynterTjent += antall;
    Lagring.lagre();
  }

  /* Betaler for "Lese fritt" (js/frilesing.js) -- han leser hoeyt fra hva
   * han vil, ingen bestemt tekst aa matche mot, saa ingen setninger og
   * ingen stjerner. Ordene teller likevel mot boeker og level, akkurat som
   * vanlig lesing (samme MYNT_PER_ORD) -- det er nettopp poenget, en annen
   * vei til de samme belønningene, ikke en snarvei utenom dem. */
  function betalFriLesing(antallOrd) {
    var s = meg();
    if (!s || !antallOrd) return { mynter: 0, nyeBoker: 0, level: level(s) };

    s.okter++;
    var mynter = antallOrd * MYNT_PER_ORD;
    var foerLevel = level(s);

    s.mynter += mynter;
    s.mynterTjent += mynter;
    s.ord += antallOrd;

    var dag = Lagring.idag();
    s.dager[dag] = (s.dager[dag] || 0) + antallOrd;
    s.sistBrukt = dag;

    var nyeBoker = 0;
    while (s.ord >= bokKrav(s.boker + 1)) { s.boker++; nyeBoker++; }

    Lagring.lagre();

    return {
      mynter: mynter,
      nyeBoker: nyeBoker,
      level: level(s),
      steg: level(s) - foerLevel,
      tilNesteBok: tilNesteBok(s)
    };
  }

  /* ---------- Butikken ---------- */

  function kjop(ting, pris) {
    var s = meg();
    if (!s || s.mynter < pris) return false;
    s.mynter -= pris;
    s.eide.push({ ting: ting, pris: pris });
    // Roboten begynner aa jobbe (se under) i det oeyeblikket han kjoeper
    // den -- ikke foerste gang han aapner fabrikken. Ellers kunne en robot
    // kjoept i dag staa stille i en uke fordi han ikke gikk innom.
    if (!s.jobb) s.jobb = {};
    s.jobb[ting] = Date.now();
    Lagring.lagre();
    return true;
  }

  /* ---------- Robotfabrikken ----------
   *
   * Robotene han eier staar og jobber mens appen er lukket, og legger opp
   * mynter han henter ut ved aa trykke paa hver enkelt av dem (js/jobb.js).
   *
   * Tre tak, alle bestemt av Vegard:
   *   - en robot tjener aldri mer enn en FEMDEL av det den kostet,
   *   - den slutter aa tjene etter ETT DOEGN, og
   *   - alle robotene til sammen gir aldri mer enn JOBB_TAK_TOTAL (1000)
   *     mynter i doegnet.
   *
   * De to foerste betyr at en robot tjener seg selv inn paa fem doegn om
   * han henter hver dag -- og at det ikke gaar an aa la appen ligge en
   * maaned og komme tilbake til en formue. Det tredje hindrer at en stor
   * samling gir en formue hver dag: med alle de 52 robotene ville femdelene
   * alene blitt ca. 6600 mynter i doegnet. Fabrikken er en grunn til aa
   * komme innom, ikke en erstatning for aa lese.
   *
   * Myntene gaar rett i lomma, som de vanskelige ordene (tjenMynter over):
   * de teller IKKE som "ord lest" og gir ingen boeker eller level. Lesing
   * skal vaere den eneste veien dit.
   */

  var JOBB_MAKS_MS = 24 * 60 * 60 * 1000;
  var JOBB_ANDEL = .20;
  var JOBB_TAK_TOTAL = 1000;

  /* Faktoren som tilpasser hver robots inntekt til totaltaket.
   *
   * Summen av alle femdelene regnes ut, og er den over taket, skaleres HVER
   * robot ned med samme brokk (taket / summen). Da beholder alle sin plass i
   * rekkefoelgen: en dyr robot tjener fortsatt mer enn en billig, og ingen
   * faller helt ut -- noe som ville skjedd om vi bare kuttet de siste i
   * rekka. Under taket er faktoren 1, og ingenting endres.
   *
   * Regnes av det han eier NAA, ikke lagres: kjoeper han en ny robot, faller
   * de andres andel litt, og selger/mister han en, stiger den. Og hver robots
   * maks rundes ned, saa summen havner alltid paa eller under taket. */
  function jobbSkala() {
    var s = meg();
    if (!s) return 1;
    var sett = {}, sum = 0;
    (s.eide || []).forEach(function (e) {
      if (sett[e.ting]) return;
      sett[e.ting] = true;
      sum += Math.floor(e.pris * JOBB_ANDEL);
    });
    return sum > JOBB_TAK_TOTAL ? JOBB_TAK_TOTAL / sum : 1;
  }

  /* Hva roboten har staaende akkurat naa. `pris` er det han faktisk betalte
   * (se s.eide), ikke dagens katalogpris -- de er like i dag, men det er
   * hans eget kjoep dette skal regnes av. */
  function jobbStatus(figurId, pris) {
    var s = meg();
    if (!s) return null;
    if (!s.jobb) s.jobb = {};

    // Mangler starttiden helt, er det en robot som kom inn utenom kjoep --
    // t.d. fra en sikkerhetskopi tatt foer fabrikken fantes. Da begynner
    // den aa tjene naa, i stedet for aa gi full pott med det samme.
    if (!s.jobb[figurId]) { s.jobb[figurId] = Date.now(); Lagring.lagre(); }

    var skala = jobbSkala();
    var maks = Math.floor(Math.floor(pris * JOBB_ANDEL) * skala);
    var andel = Math.min(1, Math.max(0, Date.now() - s.jobb[figurId]) / JOBB_MAKS_MS);
    return {
      mynter: Math.floor(maks * andel),
      maks: maks,
      skala: skala,
      andel: andel,
      full: andel >= 1
    };
  }

  /* Henter ut det roboten har staaende, og setter den i gang igjen.
   *
   * Starttiden flyttes fram med noeyaktig den tiden han faktisk fikk betalt
   * for -- ikke helt til naa. Ellers ville brøkdelen som ikke ble en hel
   * mynt (seks mynter opptjent av et tak paa ti gir 6, ikke 6,4) gaa tapt
   * hver eneste gang han henter, og den som henter ofte ville tjent mindre
   * enn den som venter.
   *
   * En FULL robot er unntaket, og det maa den vaere: har den staatt i to
   * doegn, er bare det foerste betalt (taket), og aa forskyve starttiden
   * med det ene betalte doegnet ville latt det andre bli staaende som
   * oppspart tid -- roboten ville vaert full paa nytt i samme oeyeblikk, og
   * han kunne hentet full pott om og om igjen. Da maa klokka begynne helt
   * paa nytt fra naa. */
  function hentJobb(figurId, pris) {
    var s = meg();
    if (!s) return 0;
    var st = jobbStatus(figurId, pris);
    if (!st || st.mynter <= 0) return 0;

    s.mynter += st.mynter;
    s.mynterTjent += st.mynter;
    s.jobb[figurId] = st.full
      ? Date.now()
      : s.jobb[figurId] + (st.mynter / st.maks) * JOBB_MAKS_MS;
    Lagring.lagre();
    return st.mynter;
  }

  /* ---------- Boka paa bordet ---------- */

  function statistikk() {
    var s = meg();
    if (!s) return null;
    return {
      navn: s.navn,
      level: level(s),
      mynter: s.mynter,
      mynterTjent: s.mynterTjent,
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
    betalFriLesing: betalFriLesing,
    kjop: kjop,
    tjenMynter: tjenMynter,
    jobbStatus: jobbStatus,
    hentJobb: hentJobb,
    statistikk: statistikk,
    MYNT_PER_ORD: MYNT_PER_ORD,
    FULLFOERT_BONUS: FULLFOERT_BONUS,
    JOBB_TIMER: JOBB_MAKS_MS / 3600000,
    JOBB_ANDEL: JOBB_ANDEL,
    JOBB_TAK_TOTAL: JOBB_TAK_TOTAL
  };
})(window);
