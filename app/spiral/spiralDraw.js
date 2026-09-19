// spiralDraw.js
//
// Disegno dei punti di VogelSpiralViewer su canvas, in due modalita':
//  - drawArcs:   un cerchio antialiasato per punto, in ordine di n. E' il
//                disegno "classico", ottimo fino a qualche decina di migliaia
//                di punti.
//  - drawRaster: scrive i pixel direttamente in un ImageData e lo copia sul
//                canvas in un colpo solo. Con centinaia di migliaia di punti,
//                per lo piu' piu' piccoli di un pixel, e' l'unico modo di
//                restare veloci (1M di arc()+fill() richiederebbe secondi).

const BG_HEX = "#12141a";

// Sopra questo numero di punti si passa al disegno raster.
export const ARC_MAX_COUNT = 30000;

// Distanza media (in pixel logici) fra punti vicini a cui i punti hanno la
// dimensione "piena": oltre 12000 numeri i punti si fanno piu' fitti e vanno
// rimpiccioliti in proporzione, altrimenti si sovrappongono e coprono tutto.
const FULL_SIZE_SPACING = 4.6;

// Raggio base (pixel logici) dei punti, prima del moltiplicatore dello stile.
export function baseRadius({ spacing, pointScale, pointFactor }) {
  const density = Math.min(1, spacing / FULL_SIZE_SPACING);
  return 1.1 * pointScale * pointFactor * density;
}

export function drawArcs(ctx, size, geo, sty, radius) {
  ctx.fillStyle = BG_HEX;
  ctx.fillRect(0, 0, size, size);

  const { px, py } = geo;
  const { idx, table } = sty;
  for (let i = 0; i < geo.count; i++) {
    const style = table[idx[i]];
    ctx.beginPath();
    ctx.fillStyle = style.color;
    ctx.arc(px[i], py[i], radius * style.radiusFactor, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- raster ----------------------------------------------------------------

const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

let colorParser = null;
const colorCache = new Map();

// Colore CSS -> intero RGBA a 32 bit nell'ordine di memoria di ImageData.
function toPixel(color) {
  let v = colorCache.get(color);
  if (v !== undefined) return v;
  if (!colorParser) colorParser = document.createElement("canvas").getContext("2d");
  colorParser.fillStyle = "#000";
  colorParser.fillStyle = color; // il browser normalizza in "#rrggbb"
  const hex = colorParser.fillStyle;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  v = LITTLE_ENDIAN
    ? ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
    : ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
  colorCache.set(color, v);
  return v;
}

// Pixel coperti da un punto di raggio r (in pixel fisici), rispetto al suo centro.
function discOffsets(r) {
  if (r < 0.75) return [0, 0];
  const out = [];
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy <= r * r) out.push(dx, dy);
    }
  }
  return out;
}

// Nelle costruzioni su griglia (Ulam) con celle di pochi pixel, un punto piccolo
// come un pixel lascerebbe "buchi" periodici (moire') fra una cella e l'altra:
// in quel caso ogni punto occupa almeno l'intera cella.
const GRID_FILL_BELOW = 3; // pixel fisici per cella

// Quadrato di lato `side` che copre la cella centrata sul punto.
function squareOffsets(side) {
  const out = [];
  const lo = -Math.floor((side - 1) / 2);
  for (let dy = 0; dy < side; dy++) for (let dx = 0; dx < side; dx++) out.push(lo + dx, lo + dy);
  return out;
}

// cellSpacing: passo della griglia in pixel logici (0 per le spirali polari)
export function drawRaster(canvas, size, geo, sty, radius, cellSpacing = 0) {
  const ctx = canvas.getContext("2d");
  const P = canvas.width; // pixel fisici per lato
  const ratio = P / size;
  const cellPhys = cellSpacing * ratio;
  const fillSide = cellPhys > 0 && cellPhys < GRID_FILL_BELOW ? Math.ceil(cellPhys) : 1;
  const img = ctx.createImageData(P, P);
  const buf = new Uint32Array(img.data.buffer);
  buf.fill(toPixel(BG_HEX));

  const { px, py } = geo;
  const { order, groups, table } = sty;

  for (const g of groups) {
    const style = table[g.styleId];
    const pixel = toPixel(style.color);
    let offs = discOffsets(radius * style.radiusFactor * ratio);
    if (fillSide > 1 && offs.length < fillSide * fillSide * 2) offs = squareOffsets(fillSide);

    if (offs.length === 2) {
      // caso piu' comune con tanti punti: un solo pixel per punto
      for (let k = g.start; k < g.end; k++) {
        const i = order[k];
        const x = Math.round(px[i] * ratio);
        const y = Math.round(py[i] * ratio);
        if (x >= 0 && x < P && y >= 0 && y < P) buf[y * P + x] = pixel;
      }
    } else {
      for (let k = g.start; k < g.end; k++) {
        const i = order[k];
        const x0 = Math.round(px[i] * ratio);
        const y0 = Math.round(py[i] * ratio);
        for (let o = 0; o < offs.length; o += 2) {
          const x = x0 + offs[o];
          const y = y0 + offs[o + 1];
          if (x >= 0 && x < P && y >= 0 && y < P) buf[y * P + x] = pixel;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}
