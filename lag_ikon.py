"""Lager appikonene til Lesestjerna: en stjerne over en oppslått bok.

Tegnes fire ganger så stort som nødvendig og skaleres ned til slutt – da blir
kantene glatte uten at vi trenger noe mer enn Pillow.
"""

from PIL import Image, ImageDraw
from pathlib import Path
import math

HER = Path(__file__).parent
SKALA = 4

BAKGRUNN = (29, 33, 37)
PAPIR = (255, 255, 255)
LINJE = (150, 160, 172)
STJERNE = (242, 183, 5)


def stjernepunkter(x, y, ytre, indre, tagger=5):
    """Punktene i en stjerne, med den øverste taggen rett opp."""
    punkter = []
    for i in range(tagger * 2):
        r = ytre if i % 2 == 0 else indre
        v = -math.pi / 2 + i * math.pi / tagger
        punkter.append((x + r * math.cos(v), y + r * math.sin(v)))
    return punkter


def lag(storrelse, marg_andel, filnavn):
    s = storrelse * SKALA
    bilde = Image.new("RGBA", (s, s), BAKGRUNN + (255,))
    tegn = ImageDraw.Draw(bilde, "RGBA")

    marg = s * marg_andel
    flate = s - 2 * marg

    # Boka ligger i nedre halvdel: to sider som møtes i en rygg på midten.
    bok_b = flate * 0.98
    bok_h = flate * 0.40
    x0 = (s - bok_b) / 2
    y0 = marg + flate * 0.56
    midt = s / 2
    lofte = bok_h * 0.30           # hvor mye ytterkantene henger ned

    venstre = [(x0, y0 + lofte), (midt, y0), (midt, y0 + bok_h),
               (x0, y0 + bok_h + lofte * 0.55)]
    hoyre = [(midt, y0), (x0 + bok_b, y0 + lofte),
             (x0 + bok_b, y0 + bok_h + lofte * 0.55), (midt, y0 + bok_h)]
    tegn.polygon(venstre, fill=PAPIR + (255,))
    tegn.polygon(hoyre, fill=PAPIR + (255,))

    # Tekstlinjer på begge sider. De korteste nederst, som en avsluttet setning.
    strek = max(2, int(bok_h * 0.055))
    for i, andel in enumerate((0.86, 0.86, 0.55)):
        yy = y0 + bok_h * (0.30 + i * 0.22)
        inn = bok_b * 0.06
        tegn.line([(x0 + inn + lofte * 0.5, yy + lofte * (1 - (x0 + inn) / midt) * 0.5),
                   (midt - bok_b * 0.05, yy - lofte * 0.06)],
                  fill=LINJE + (255,), width=strek)
        bredde = (midt - x0) * andel
        tegn.line([(midt + bok_b * 0.05, yy - lofte * 0.06),
                   (midt + bredde * 0.9, yy + lofte * 0.25)],
                  fill=LINJE + (255,), width=strek)

    # Ryggen skiller sidene.
    tegn.line([(midt, y0), (midt, y0 + bok_h)], fill=LINJE + (255,), width=strek)

    # Stjerna svever over boka.
    st_r = flate * 0.27
    tegn.polygon(stjernepunkter(midt, marg + flate * 0.27, st_r, st_r * 0.44),
                 fill=STJERNE + (255,))

    bilde.resize((storrelse, storrelse), Image.LANCZOS).save(HER / filnavn)
    print("skrev", filnavn)


if __name__ == "__main__":
    # Vanlige ikoner fyller nesten hele flaten. Maskable trenger klaring til
    # sikkerhetssonen, ellers klippes toppen av stjerna bort.
    lag(512, 0.10, "icon-512.png")
    lag(192, 0.10, "icon-192.png")
    lag(180, 0.10, "apple-touch-icon.png")
    lag(512, 0.23, "icon-maskable-512.png")
