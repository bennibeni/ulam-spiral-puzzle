// spiralCompute.js
//
// Calcolo "pesante" per VogelSpiralViewer, pensato per arrivare a 1.000.000 di
// interi senza bloccare la pagina:
//  - i dati stanno in array tipizzati (Float64Array/Int32Array), non in un
//    oggetto per punto: a 1M di punti la differenza e' di centinaia di MB e di
//    secondi di garbage collection;
//  - i calcoli sono generatori che cedono il controllo ogni tanto (runJob), cosi'
//    la pagina resta reattiva e si puo' mostrare l'avanzamento;
//  - un calcolo superato da uno piu' recente (es. si sta trascinando lo slider)
//    viene annullato.

const CHUNK = 20000;

// ---------------------------------------------------------------------------
// Esecuzione a fette
// ---------------------------------------------------------------------------

// Esegue il generatore a fette di ~sliceMs, cedendo il controllo al browser fra
// una fetta e l'altra. Ritorna la funzione di annullamento.
export function runJob(makeGen, { onProgress, onDone, sliceMs = 12 } = {}) {
  let cancelled = false;
  let timer = null;
  const gen = makeGen();

  function step() {
    if (cancelled) return;
    const t0 = performance.now();
    let r = gen.next();
    while (!r.done && performance.now() - t0 < sliceMs) r = gen.next();
    if (cancelled) return;
    if (r.done) {
      onDone?.(r.value);
    } else {
      onProgress?.(r.value);
      timer = setTimeout(step, 0);
    }
  }

  timer = setTimeout(step, 0);
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}

// Esegue il generatore fino in fondo, subito (per i conteggi piccoli).
export function runSync(makeGen) {
  const gen = makeGen();
  let r = gen.next();
  while (!r.done) r = gen.next();
  return r.value;
}

// ---------------------------------------------------------------------------
// Geometria: posizioni in pixel + indice a griglia per la ricerca del vicino
// ---------------------------------------------------------------------------

/**
 * type: { fill(xs, ys, from, to), extent(count) } (vedi SPIRAL_TYPES)
 * Ritorna { count, scale, cellSize, cols, px, py, cellStart, cellItems }.
 * L'indice i dei vettori corrisponde all'intero n = i + 1.
 */
export function* buildGeometry(type, count, size) {
  const xs = new Float64Array(count);
  const ys = new Float64Array(count);
  for (let from = 0; from < count; from += CHUNK) {
    type.fill(xs, ys, from, Math.min(count, from + CHUNK));
    yield (0.4 * from) / count;
  }

  // scala/centro per convertire coordinate matematiche in pixel
  const extent = type.extent(count);
  const scale = (size / 2 - 24) / extent;
  const cx = size / 2;
  const cy = size / 2;
  const px = new Float64Array(count);
  const py = new Float64Array(count);
  for (let from = 0; from < count; from += CHUNK) {
    const to = Math.min(count, from + CHUNK);
    for (let i = from; i < to; i++) {
      px[i] = cx + xs[i] * scale;
      py[i] = cy + ys[i] * scale;
    }
    yield 0.4 + (0.2 * from) / count;
  }

  // indice a griglia (bucket) per trovare velocemente il punto piu' vicino al
  // mouse senza scansionare tutti i punti: ordinamento per conteggio, in due passate
  const avgSpacing = (size / 2 - 24) / Math.sqrt(count || 1);
  const cellSize = Math.max(avgSpacing * 3, 8);
  const cols = Math.ceil(size / cellSize) + 1;
  const cellOf = (i) => {
    const cellX = Math.min(cols - 1, Math.max(0, Math.floor(px[i] / cellSize)));
    const cellY = Math.min(cols - 1, Math.max(0, Math.floor(py[i] / cellSize)));
    return cellY * cols + cellX;
  };

  const cellStart = new Int32Array(cols * cols + 1);
  for (let from = 0; from < count; from += CHUNK) {
    const to = Math.min(count, from + CHUNK);
    for (let i = from; i < to; i++) cellStart[cellOf(i) + 1]++;
    yield 0.6 + (0.2 * from) / count;
  }
  for (let c = 0; c < cols * cols; c++) cellStart[c + 1] += cellStart[c];

  const fillPos = cellStart.slice(0, cols * cols);
  const cellItems = new Int32Array(count);
  for (let from = 0; from < count; from += CHUNK) {
    const to = Math.min(count, from + CHUNK);
    for (let i = from; i < to; i++) cellItems[fillPos[cellOf(i)]++] = i;
    yield 0.8 + (0.2 * from) / count;
  }

  return { count, scale, cellSize, cols, px, py, cellStart, cellItems };
}

// ---------------------------------------------------------------------------
// Stili: colore/dimensione di ogni punto secondo l'engine di evidenziazione
// ---------------------------------------------------------------------------

/**
 * engine: { getStyle(n) -> { color, radiusFactor }, prepare?(count) -> getStyle } (vedi integerHighlightEngines.js)
 * Ritorna:
 *   count
 *   idx     Int32Array: per ogni punto, l'indice del suo stile nella tabella
 *   table   [{ color, radiusFactor }]  gli stili distinti (pochi: ~2 per i primi,
 *           qualche centinaio per Collatz)
 *   groups  [{ styleId, start, end }]  stili in ordine di dimensione crescente
 *   order   Int32Array: i punti raggruppati per stile, nell'ordine di `groups`
 *           (serve al disegno veloce: i punti piu' grandi, es. i primi, si
 *           disegnano per ultimi e restano visibili sopra gli altri)
 */
export function* buildStyles(engine, count) {
  const idx = new Int32Array(count);
  const table = [];
  const lookup = new Map();

  // alcuni engine offrono una versione ottimizzata per valutare 1..count in ordine
  const getStyle = engine.prepare ? engine.prepare(count) : engine.getStyle;

  for (let n = 1; n <= count; n++) {
    const s = getStyle(n);
    const key = s.color + "|" + s.radiusFactor;
    let id = lookup.get(key);
    if (id === undefined) {
      id = table.length;
      table.push({ color: s.color, radiusFactor: s.radiusFactor });
      lookup.set(key, id);
    }
    idx[n - 1] = id;
    if (n % 4096 === 0) yield (0.85 * n) / count;
  }

  // ordine degli stili: dimensione crescente (a parita', ordine di comparsa)
  const ids = table.map((_, i) => i);
  ids.sort((a, b) => table[a].radiusFactor - table[b].radiusFactor || a - b);
  const rank = new Int32Array(table.length);
  ids.forEach((id, r) => {
    rank[id] = r;
  });

  const groupCount = new Int32Array(table.length + 1);
  for (let i = 0; i < count; i++) groupCount[rank[idx[i]] + 1]++;
  for (let r = 0; r < table.length; r++) groupCount[r + 1] += groupCount[r];
  yield 0.9;

  const fillPos = groupCount.slice(0, table.length);
  const order = new Int32Array(count);
  for (let i = 0; i < count; i++) order[fillPos[rank[idx[i]]]++] = i;

  const groups = ids.map((styleId, r) => ({
    styleId,
    start: groupCount[r],
    end: groupCount[r + 1],
  }));

  return { count, idx, table, groups, order };
}
