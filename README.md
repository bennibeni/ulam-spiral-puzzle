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

## Accessibilità

- Tutte le pietre di partenza sono raggiungibili con Tab e attivabili con
  Invio/Spazio, oltre che con il click.
- I tasti freccia della tastiera muovono nella direzione corrispondente quando
  disponibile.
- Lo stato della partita è annunciato agli screen reader (`aria-live`).
- Il focus da tastiera è sempre visibile (contorno dorato).
- Le animazioni di movimento e la vibrazione di errore rispettano
  `prefers-reduced-motion`: se attivo nel sistema, i passaggi sono istantanei.
