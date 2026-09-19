# La Spirale di Ulam — app standalone

Progetto Next.js isolato (nessun CSS/reset esterno) per il rompicapo sui numeri primi.

## Avvio in locale

```bash
npm install
npm run dev
```

Poi apri http://localhost:3000

## Build di produzione

```bash
npm run build
npm run start
```

## Deploy su Vercel

Basta collegare questa cartella come progetto indipendente (nuovo progetto Vercel,
non una sotto-route di un altro progetto) — così nessun CSS globale di altri
progetti può interferire con i colori o le dimensioni del pannello.

## Struttura

- `app/layout.jsx` — layout radice, carica i font (Fraunces, IBM Plex Mono, Inter)
- `app/globals.css` — reset minimo (solo box-sizing e sfondo pagina)
- `app/page.jsx` — pagina che monta il gioco
- `app/UlamSpiralPuzzle.jsx` — componente del gioco (logica + UI)
- `app/theme.js` — colori e font condivisi da gioco e modale
- `app/UlamSpiralModal.jsx` — bottone "Esplora la spirale" (nell'intestazione) e
  modale con la spirale di Ulam completa
- `app/UlamSpiralViewer.jsx` — contenuto della modale: controlli + canvas
- `app/spiral/` — moduli di calcolo e disegno della spirale (senza React, tranne
  `useChunkedJob.js`): `ulamSpiral.js` (posizioni), `integerHighlightEngines.js`
  (primi, k-almost primes, Collatz, Goldbach), `spiralCompute.js` (calcolo a
  fette), `spiralDraw.js` (disegno), `canvasUtils.js`

## La spirale di Ulam in modale

Il bottone **Esplora la spirale**, accanto a "Come si gioca", apre una modale con la
spirale di Ulam. Scelte disponibili (le stesse del viewer di R18):

- **Evidenziazione**: numeri primi, k-almost primes, passi di Collatz, Goldbach;
- **Numeri mostrati**: da 200 a 1.000.000 (slider logaritmico);
- **Dim. punti**.

Fino a 1.000.000 di numeri il calcolo avviene a fette, senza bloccare la pagina
(compare "Calcolo in corso… N%"); oltre 30.000 punti il disegno passa da cerchi a
pixel diretti. Passando il mouse (o toccando) su un punto si legge il valore di `n`.

La modale si chiude con Esc, con la X o cliccando sullo sfondo; il focus resta al suo
interno e torna al bottone alla chiusura. Finche' e' aperta le frecce da tastiera
non muovono il rompicapo sotto. Le impostazioni scelte restano se la si riapre.

## Accessibilità

- Tutte le pietre di partenza sono raggiungibili con Tab e attivabili con
  Invio/Spazio, oltre che con il click.
- I tasti freccia della tastiera muovono nella direzione corrispondente quando
  disponibile.
- Lo stato della partita è annunciato agli screen reader (`aria-live`).
- Il focus da tastiera è sempre visibile (contorno dorato).
- Le animazioni di movimento e la vibrazione di errore rispettano
  `prefers-reduced-motion`: se attivo nel sistema, i passaggi sono istantanei.
