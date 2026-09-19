"use client";

import { useEffect, useRef, useState } from "react";
import { COLORS, FONT_BODY, FONT_MONO } from "./theme";
import { highlightEngines } from "./spiral/integerHighlightEngines";
import { clamp, pointerToLogical, prepareCanvas } from "./spiral/canvasUtils";
import { fillUlam, ulamExtent } from "./spiral/ulamSpiral";
import { buildGeometry, buildStyles } from "./spiral/spiralCompute";
import { ARC_MAX_COUNT, baseRadius, drawArcs, drawRaster } from "./spiral/spiralDraw";
import { useChunkedJob } from "./spiral/useChunkedJob";

/**
 * UlamSpiralViewer
 *
 * Disegna gli interi 1..count sulla spirale di Ulam: una griglia quadrata in cui
 * i numeri si dispongono a spirale attorno all'1 (destra, su, sinistra, giu'...).
 * Stessi parametri e stesse scelte del viewer di R18: evidenziazione (primi,
 * k-almost primes, Collatz, Goldbach), quantita' di numeri mostrati (fino a
 * 1.000.000, scala logaritmica) e dimensione dei punti.
 *
 * Le impostazioni vivono nel genitore (props `settings` / `onChange`), cosi' si
 * ritrovano uguali quando la modale viene riaperta.
 */

// Costruzione di Ulam (vedi spiral/ulamSpiral.js). `grid` e `spacing` dicono al
// disegno che i punti stanno su una griglia di passo `scale`; `pointFactor`
// ingrandisce i punti perche' le diagonali si leggano.
const ULAM = {
  label: "Spirale di Ulam",
  pointFactor: 1.8,
  grid: true,
  fill: fillUlam,
  extent: ulamExtent,
  spacing: (scale) => scale,
  description:
    "Gli interi su una griglia quadrata, a spirale attorno all'1 (destra, su, sinistra, giù…). I numeri primi tendono ad allinearsi lungo le diagonali — scoperta da Stanisław Ulam nel 1963.",
};

export const DEFAULT_SETTINGS = { count: 3000, mode: "primes", pointScale: 1 };

// Valori selezionabili con lo slider "Numeri mostrati": scala logaritmica con 2
// cifre significative (200, 210, ... 990, 1000, 1100, ... 1.000.000). Uno slider
// lineare non sarebbe usabile su un intervallo cosi' ampio.
const COUNT_STEPS = (() => {
  const steps = [];
  for (let exp = 1; exp <= 4; exp++) {
    for (let m = 10; m <= 99; m++) {
      const v = m * 10 ** exp;
      if (v >= 200) steps.push(v);
    }
  }
  steps.push(1000000);
  return steps;
})();
const COUNT_MIN = COUNT_STEPS[0];
const COUNT_MAX = COUNT_STEPS[COUNT_STEPS.length - 1];

function nearestStepIndex(value) {
  let best = 0;
  for (let i = 1; i < COUNT_STEPS.length; i++) {
    if (Math.abs(COUNT_STEPS[i] - value) < Math.abs(COUNT_STEPS[best] - value)) best = i;
  }
  return best;
}

const formatCount = (n) => n.toLocaleString("it-IT");

const CANVAS_SIZE = 640; // coordinate logiche: la risoluzione reale la gestisce prepareCanvas
const HOVER_RADIUS_MOUSE = 6; // in coordinate logiche
const HOVER_RADIUS_TOUCH = 24; // un dito e' molto meno preciso del mouse

const labelStyle = {
  display: "block",
  fontFamily: FONT_MONO,
  fontSize: 10.5,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: COLORS.paperDim,
  marginBottom: 6,
};

export default function UlamSpiralViewer({ settings, onChange }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const [hovered, setHovered] = useState(null);

  const count = COUNT_STEPS[nearestStepIndex(clamp(settings.count, COUNT_MIN, COUNT_MAX))];
  const mode = settings.mode in highlightEngines ? settings.mode : "primes";
  const pointScale = settings.pointScale;
  const engine = highlightEngines[mode];

  // Fino a ARC_MAX_COUNT il calcolo e' immediato; oltre si fa a fette, con
  // avanzamento, e si annulla se nel frattempo lo slider si sposta.
  const sync = count <= ARC_MAX_COUNT;

  // Geometria (posizioni + indice a griglia) dipende dal conteggio; gli stili
  // (colori/dimensioni) da modalita' e conteggio: separati, cosi' cambiare solo
  // la modalita' non ricalcola le posizioni.
  const geoJob = useChunkedJob(
    function* () {
      return yield* buildGeometry(ULAM, count, CANVAS_SIZE);
    },
    [count],
    sync
  );
  const styJob = useChunkedJob(
    function* () {
      const sty = yield* buildStyles(engine, count);
      return { ...sty, mode };
    },
    [mode, count],
    sync
  );

  const geo = geoJob.value;
  const sty = styJob.value;
  // si disegna solo quando geometria e stili corrispondono alla scelta attuale;
  // nel frattempo resta a schermo l'ultimo disegno completo
  const ready = geo && sty && geo.count === sty.count && sty.mode === mode;

  const computing = !sync && (geoJob.running || styJob.running);
  const progressPct = Math.round(
    (((geoJob.running ? geoJob.progress : 1) + (styJob.running ? styJob.progress : 1)) / 2) * 100
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return undefined;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const radius = baseRadius({
        spacing: ULAM.spacing(geo.scale),
        pointScale,
        pointFactor: ULAM.pointFactor,
      });
      const ctx = prepareCanvas(canvas, CANVAS_SIZE);
      if (geo.count <= ARC_MAX_COUNT) {
        drawArcs(ctx, CANVAS_SIZE, geo, sty, radius);
      } else {
        drawRaster(canvas, CANVAS_SIZE, geo, sty, radius, ULAM.spacing(geo.scale));
      }
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ready, geo, sty, pointScale]);

  function handlePointer(e) {
    const canvas = canvasRef.current;
    if (!canvas || !geo) return;
    const { x: mx, y: my } = pointerToLogical(e, canvas, CANVAS_SIZE);

    const radius = e.pointerType === "touch" ? HOVER_RADIUS_TOUCH : HOVER_RADIUS_MOUSE;
    const { cellSize, cols, px, py, cellStart, cellItems } = geo;
    const cellX = Math.floor(mx / cellSize);
    const cellY = Math.floor(my / cellSize);
    // celle da controllare attorno a quella del cursore: con il mouse basta la
    // cella + le 8 vicine (cellSize >= 8 > raggio), con il tocco il raggio e'
    // maggiore e serve guardare un po' piu' lontano
    const reach = Math.ceil(radius / cellSize);

    let closest = -1;
    let closestDist = Infinity;
    for (let dx = -reach; dx <= reach; dx++) {
      for (let dy = -reach; dy <= reach; dy++) {
        const cx = cellX + dx;
        const cy = cellY + dy;
        if (cx < 0 || cy < 0 || cx >= cols || cy >= cols) continue;
        const cell = cy * cols + cx;
        for (let k = cellStart[cell]; k < cellStart[cell + 1]; k++) {
          const i = cellItems[k];
          const d = (px[i] - mx) ** 2 + (py[i] - my) ** 2;
          if (d < closestDist) {
            closestDist = d;
            closest = i;
          }
        }
      }
    }

    const nextHovered = closest >= 0 && closestDist < radius * radius ? closest + 1 : null;
    setHovered((prev) => (prev === nextHovered ? prev : nextHovered));
  }

  const controlBase = {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: COLORS.paper,
  };

  return (
    <div style={{ color: COLORS.paper, fontFamily: FONT_BODY }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          gap: "14px 20px",
          marginBottom: 14,
        }}
      >
        <div>
          <label style={labelStyle} htmlFor="usv-mode">
            Evidenziazione
          </label>
          <select
            id="usv-mode"
            value={mode}
            onChange={(e) => onChange({ mode: e.target.value })}
            style={{
              ...controlBase,
              background: COLORS.panelAlt,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 8,
              padding: "7px 10px",
              cursor: "pointer",
            }}
          >
            {Object.entries(highlightEngines).map(([key, e]) => (
              <option key={key} value={key}>
                {e.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: "1 1 200px", minWidth: 140 }}>
          <label style={labelStyle} htmlFor="usv-count">
            Numeri mostrati:{" "}
            <span style={{ color: COLORS.gold }}>{formatCount(count)}</span>
          </label>
          <input
            id="usv-count"
            type="range"
            min={0}
            max={COUNT_STEPS.length - 1}
            step={1}
            value={nearestStepIndex(count)}
            onChange={(e) => onChange({ count: COUNT_STEPS[Number(e.target.value)] })}
            aria-valuetext={`${formatCount(count)} numeri`}
            style={{ width: "100%", accentColor: COLORS.gold, margin: 0 }}
          />
        </div>

        <div style={{ flex: "0 1 150px", minWidth: 110 }}>
          <label style={labelStyle} htmlFor="usv-size">
            Dim. punti
          </label>
          <input
            id="usv-size"
            type="range"
            min={0.4}
            max={2.5}
            step={0.1}
            value={pointScale}
            onChange={(e) => onChange({ pointScale: Number(e.target.value) })}
            style={{ width: "100%", accentColor: COLORS.gold, margin: 0 }}
          />
        </div>
      </div>

      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          lineHeight: 1.55,
          color: COLORS.paperDim,
          maxWidth: 640,
        }}
      >
        {ULAM.description}
      </p>

      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        role="img"
        aria-label={`${ULAM.label}: interi da 1 a ${formatCount(count)}, evidenziazione «${engine.label}»`}
        aria-busy={computing}
        onPointerMove={handlePointer}
        onPointerDown={handlePointer}
        onPointerLeave={(e) => {
          // col tocco il "leave" scatta subito al sollevamento del dito:
          // lasciamo il valore letto finche' non si tocca altro
          if (e.pointerType !== "touch") setHovered(null);
        }}
        style={{
          display: "block",
          margin: "0 auto",
          // quadrato, ma mai piu' alto di quanto entri nella finestra con i controlli
          width: "min(100%, max(260px, calc(100vh - 320px)))",
          aspectRatio: "1 / 1",
          borderRadius: 12,
          border: `1px solid ${COLORS.line}`,
          cursor: "crosshair",
        }}
      />

      <div
        aria-live="polite"
        style={{
          marginTop: 10,
          minHeight: 20,
          textAlign: "center",
          fontFamily: FONT_MONO,
          fontSize: 12.5,
          color: COLORS.paperDim,
        }}
      >
        {computing
          ? `Calcolo in corso… ${progressPct}%`
          : hovered
            ? `n = ${formatCount(hovered)}`
            : "Passa il mouse (o tocca) su un punto per vedere il valore"}
      </div>
    </div>
  );
}
