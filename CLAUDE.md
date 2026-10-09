# Lesestjerna
Lese-PWA for barn: de leser tekster høyt, appen lytter og lyser ordene, og de tjener mynter til roboter, hus og butikk. Ren HTML/CSS/JS, ingen byggesteg.

## Kjøre og teste
- Forhåndsvisning: `lesestjerna` i `.claude/launch.json`, port 8000 (`python serve.py 8000`). `serve.py` er en vanlig filserver som sender `Cache-Control: no-store`, fordi nettleseren ellers kjørte gamle filer og ga bugs som så ekte ut.
- Røyktest: `node .dev/roykTest.mjs` (skal skrive «Røyktest OK»).
- Tekstsjekk: `python -I sjekk_tekster.py` (validerer `data/tekster.json`: setningstall, ordtall, tallord i vanskeligeOrd m.m.; kode 1 ved feil).

## Publisering
- Repo `vegardk-hub/pwa-lesestjerna`, gren `main`, live: https://vegardk-hub.github.io/pwa-lesestjerna/ (GitHub Pages). Skillen `publiser-pwa` gjør utgivelsen.
- Ingen service worker (ingen `sw.js`), så det finnes ikke noe cache-navn å bumpe. Nye versjoner når brukeren ved vanlig nettleserlasting av siden.
- Versjonsnummeret står i `index.html`: `<span id="versjon">` på spillervalg-skjermen («Hvem leser?»), nå `v77`. Øk det ved hver utgivelse.
- `#versjonHjorne` i topplinja skal stå fast på `v67` (barnets ønske, se commit 9f166e3). Ikke bump den.

## Struktur
- To lyttemotorer registrerer seg i `js/stemme.js`; valgt motor lagres og velges i Foreldrekontroll. `lyttemotor-nettleser.js` (Web Speech API, standard) sender lyd til nettleserens skytjeneste. `lyttemotor-whisper.js` er eksperimentell og lokal: nb-whisper via Transformers.js, lastet fra CDN første gang.
- `data/tekster.json` har tekstbanken (id-er får aldri endres, se `_lesmeg` i fila); `data/figurer.json` har robotene.
- All lagring er i `localStorage` under nøkkelen `lesestjerna.v1`, via `js/lagring.js` (maks 3 spillere, papirkurv, eksport/import av sikkerhetskopi).
- `prove-lytting.html` er et frittstående diagnoseverktøy for å se hva Edge faktisk hører når et barn leser.

## Verdt å vite
- Tekst-id-er må aldri endres: de er nøkkelen til hvem som har lest hva, og ny id betyr at teksten betales på nytt.
- Talegjenkjenning avhenger av nettleseren: Edge anbefales («language-not-supported» på norsk andre steder), mikrofon må tillates, og lyden går til skyen så nett kreves. Safari/iPad stopper gjenkjenneren selv etter stillhet; motoren lager derfor et helt nytt gjenkjenner-objekt hver gang. Kommentarene i `lyttemotor-nettleser.js` forklarer feilrunder (v52, v53); les dem før du rører friskningen.
- Whisper-biblioteket er festet til Transformers.js 3.7.6 med vilje; 4.x kan ikke laste modellen. Test lasting før oppgradering.
- Kameraordteller bruker Tesseract.js (v5, norsk) fra CDN og ord-for-ord-data, ikke råtekst. Skarphetsgrensen er kalibrert mot ekte bilder etter at en for streng grense avviste gode bilder.
- Alt barna har bygd (mynter, roboter, lesing, opptak) ligger bare i nettleseren; tømmer den seg, er det borte uten sikkerhetskopi. Skriptene bruker ASCII-norsk (aa, oe) i kommentarer; følg stilen.
- `lag_ikon.py` (Pillow) tegner appikonene (`icon-*.png`, `apple-touch-icon.png`).
