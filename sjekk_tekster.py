"""Sjekker data/tekster.json foer den tas i bruk.

Kjor:  python sjekk_tekster.py

Appen legger bort tekster den ikke forstaar og leser videre, saa en feil her
fjerner ingenting fra skjermen — den gjor bare at teksten aldri dukker opp.
Dette skriptet sier fra med én gang i stedet.

Avslutter med kode 1 om noe er galt, 0 om banken er ren.
"""

import json
import re
import sys
from pathlib import Path

FIL = Path(__file__).parent / "data" / "tekster.json"

MAKS_SETNINGER = 5
MAKS_ORD = 60

FORKORTELSER = {
    "bl.a.", "bla.", "f.eks.", "feks.", "dvs.", "osv.", "m.m.", "o.l.",
    "mfl.", "pga.", "iht.", "jf.", "ca.", "evt.", "inkl.", "ekskl.",
    "nr.", "tlf.", "dr.", "prof.", "kl.",
}

MAANEDER = {"januar", "februar", "mars", "april", "mai", "juni", "juli",
            "august", "september", "oktober", "november", "desember"}

# Tallord ma staa i vanskeligeOrd. Gjenkjenneren gir "2469" der teksten sier
# "to tusen fire hundre og sekstini", og da er hvert av de seks ordene umulig
# a treffe. Er de ikke merket, blir setningen aldri ferdig, og han far aldri
# stjerna uansett hvor riktig han leser.
#
# "en" og "ett" star ikke i lista. De er artikler like ofte som tall, og en
# advarsel pa hver eneste "en katt" ville gjort hele sjekken verdt a overse.
_TIERE = ["tjue", "tretti", "førti", "femti", "seksti", "sytti", "åtti", "nitti"]
_ENERE = ["en", "to", "tre", "fire", "fem", "seks", "sju", "syv", "åtte", "ni"]

TALLORD = {
    "null", "to", "tre", "fire", "fem", "seks", "sju", "syv", "åtte", "ni", "ti",
    "elleve", "tolv", "tretten", "fjorten", "femten", "seksten", "sytten",
    "atten", "nitten", "hundre", "tusen", "million", "millioner", "milliard",
    "milliarder", "halv", "halve", "halvt",
} | set(_TIERE) | {t + e for t in _TIERE for e in _ENERE}


def setninger(tekst):
    """Samme deling som js/tekst.js. Naiv deling paa punktum revner
    '17. mai' og 'ca.' midt i, og gir feil setningstall."""
    tekst = re.sub(r"\s+", " ", tekst).strip()
    ut, forrige = [], 0
    for m in re.finditer(r"[.!?]+[\"\u00bb']?(?=\s|$)", tekst):
        if not ekte_grense(tekst, m.start(), m.end(), m.group()):
            continue
        bit = tekst[forrige:m.end()].strip()
        if bit:
            ut.append(bit)
        forrige = m.end()
    rest = tekst[forrige:].strip()
    if rest:
        ut.append(rest)
    return ut


def ekte_grense(tekst, start, slutt, treff):
    if treff[0] != ".":
        return True
    etter = tekst[slutt:].lstrip()
    m = re.search(r"[0-9a-zA-Z\u00e6\u00f8\u00e5\u00c6\u00d8\u00c5.]+$", tekst[:start])
    ord_foran = m.group() if m else ""
    if etter and re.match(r"[a-z\u00e6\u00f8\u00e5]", etter):
        return False
    if ord_foran.isdigit() and etter:
        neste = etter.split()[0].lower().strip(",.:;!?")
        if neste in MAANEDER:
            return False
    if (ord_foran + ".").lower() in FORKORTELSER:
        return False
    if len(ord_foran) == 1 and ord_foran.isalpha() and ord_foran.isupper():
        return False
    return True


def reint(o):
    return re.sub(r"[^0-9a-z\u00e6\u00f8\u00e5\u00e4\u00f6\u00e9\u00e8\u00fc\u00e0]", "", o.lower())


def main():
    feil, advarsler = [], []

    try:
        data = json.loads(FIL.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print("Fant ikke", FIL)
        return 1
    except json.JSONDecodeError as e:
        print("JSON-feil i", FIL.name, "linje", e.lineno, "-", e.msg)
        print("Som regel et komma for mye eller for lite.")
        return 1

    emner = {e["id"]: e for e in data.get("emner", [])}
    if not emner:
        feil.append("Fila har ingen emner.")

    sett = set()
    per_emne = {}

    for t in data.get("tekster", []):
        tid = t.get("id")
        merk = tid or "(tekst uten id)"

        if not tid:
            feil.append("En tekst mangler id.")
        elif tid in sett:
            feil.append(f"{merk}: id-en er brukt to ganger. Den maa vaere unik.")
        else:
            sett.add(tid)

        if t.get("emne") not in emner:
            feil.append(f"{merk}: ukjent emne {t.get('emne')!r}.")
        else:
            per_emne[t["emne"]] = per_emne.get(t["emne"], 0) + 1

        if not t.get("tittel"):
            advarsler.append(f"{merk}: mangler tittel.")

        if t.get("niva") not in (1, 2, 3):
            feil.append(f"{merk}: niva maa vaere 1, 2 eller 3 (er {t.get('niva')!r}).")

        tekst = t.get("tekst", "")
        if not tekst.strip():
            feil.append(f"{merk}: har ingen tekst.")
            continue

        setn = setninger(tekst)
        ord = [o for o in re.split(r"\s+", tekst) if reint(o)]

        if len(setn) > MAKS_SETNINGER:
            feil.append(f"{merk}: {len(setn)} setninger, maks er {MAKS_SETNINGER}.")
        if len(ord) > MAKS_ORD:
            advarsler.append(f"{merk}: {len(ord)} ord. Lange tekster sliter ut en aattearing.")

        # Gjenkjenneren gir ofte "5000" der teksten sier "fem tusen", og
        # motsatt. Tall skrevet med siffer blir derfor staaende graae uansett
        # hvor riktig han leser.
        siffer = re.findall(r"\d+", tekst)
        if siffer:
            feil.append(f"{merk}: tall med siffer ({', '.join(siffer)}). "
                        "Skriv dem med bokstaver.")

        reine = {reint(o) for o in ord}
        for v in t.get("vanskeligeOrd", []):
            if reint(v) not in reine:
                advarsler.append(f"{merk}: vanskeligOrd {v!r} finnes ikke i teksten.")

        vansk_rein = {reint(v) for v in t.get("vanskeligeOrd", [])}

        umerkte = sorted({reint(o) for o in ord
                          if reint(o) in TALLORD and reint(o) not in vansk_rein})
        if umerkte:
            feil.append(f"{merk}: tallordene {', '.join(umerkte)} ma inn i "
                        "vanskeligeOrd, ellers blir setningen aldri ferdig.")

        # "og" mellom to tallord er en del av tallet — "fire hundre OG
        # sekstini" kommer tilbake som "2469", og da forsvinner bindeordet
        # sammen med resten. Bare "og" teller: i "sju AV ti" og "hundrevis AV
        # sugekopper" sier gjenkjenneren ordet som vanlig.
        for s in setn:
            i_s = [reint(o) for o in re.split(r"\s+", s) if reint(o)]
            for k in range(1, len(i_s) - 1):
                if (i_s[k] == "og" and "og" not in vansk_rein
                        and i_s[k - 1] in TALLORD and i_s[k + 1] in TALLORD):
                    feil.append(f"{merk}: 'og' star inni et tall og ma ogsa "
                                "inn i vanskeligeOrd.")

        # En setning der alle ordene er vanskelige kan aldri gjores ferdig av
        # seg selv. Appen slaar av merkingen i saa fall, men det er nesten
        # alltid ikke det som var meningen.
        vansk = {reint(v) for v in t.get("vanskeligeOrd", [])}
        for s in setn:
            i_s = [reint(o) for o in re.split(r"\s+", s) if reint(o)]
            if i_s and all(o in vansk for o in i_s):
                advarsler.append(f"{merk}: alle ordene i \u00ab{s}\u00bb er merket vanskelige.")

    for eid in emner:
        if not per_emne.get(eid):
            advarsler.append(f"Emnet {eid!r} har ingen tekster.")

    for a in advarsler:
        print("  ?", a)
    for f in feil:
        print("  !", f)

    n = len(data.get("tekster", []))
    if feil:
        print(f"\n{len(feil)} feil i {n} tekster. Disse blir ikke lest.")
        return 1
    print(f"\n{n} tekster i {len(emner)} emner. Alt i orden"
          + (f", {len(advarsler)} ting aa se paa." if advarsler else "."))
    return 0


if __name__ == "__main__":
    sys.exit(main())
