"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  RefreshCw,
  Wand2,
  Trophy,
  Info,
  X,
  Gem,
  Lightbulb,
} from "lucide-react";
import UlamSpiralModal from "./UlamSpiralModal";
import { COLORS, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "./theme";

/* ============================================================
   TOKENS
   ============================================================ */
/* ============================================================
   GRID CONSTRUCTION (Ulam spiral, 12x12, custom origin)
   ============================================================ */
const N = 12;
const CELL = 48;
const PANEL_MIN_HEIGHT = N * CELL + 30;

function buildGrid() {
  const grid = Array.from({ length: N }, () => Array(N).fill(null));
  const cycle = [
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 0],
  ];
  let r = 6,
    c = 5;
  grid[r][c] = 1;
  let num = 1,
    placed = 1,
    dirI = 0;
  let k = 1;
  const lengths = [];
  while (lengths.length < 30) {
    lengths.push(k, k);
    k++;
  }
  let lp = 0;
  while (placed < N * N) {
    const [dr, dc] = cycle[dirI % 4];
    const steps = lengths[lp++];
    for (let s = 0; s < steps; s++) {
      r += dr;
      c += dc;
      if (r >= 0 && r < N && c >= 0 && c < N) {
        num++;
        grid[r][c] = num;
        placed++;
        if (placed >= N * N) break;
      }
    }
    dirI++;
  }
  return grid;
}

function isPrime(n) {
  if (n < 2) return false;
  for (let p = 2; p * p <= n; p++) if (n % p === 0) return false;
  return true;
}

const GRID = buildGrid();
const PRIME_AT = {};
const POS_OF_PRIME = {};
for (let r = 0; r < N; r++) {
  for (let c = 0; c < N; c++) {
    const v = GRID[r][c];
    if (isPrime(v)) {
      PRIME_AT[`${r},${c}`] = v;
      POS_OF_PRIME[v] = { r, c };
    }
  }
}
const TOTAL_PRIMES = Object.keys(PRIME_AT).length; // 34

/* ============================================================
   MOVEMENT ENGINE
   ============================================================ */
const DELTA = { N: [-1, 0], S: [1, 0], E: [0, 1], W: [0, -1] };
const ICONS = { N: ArrowUp, S: ArrowDown, E: ArrowRight, W: ArrowLeft };
const LABELS = { N: "Nord", S: "Sud", E: "Est", W: "Ovest" };

function optionsFor(dir) {
  if (dir === null) return ["N", "E", "S", "W"];
  if (dir === "E" || dir === "W") return [dir, "N", "S"];
  return [dir, "E", "W"];
}

function forcedWalk(pos, dir, collectedSet) {
  const [dr, dc] = DELTA[dir];
  let { r, c } = pos;
  const cells = [];
  while (true) {
    r += dr;
    c += dc;
    if (r < 0 || r >= N || c < 0 || c >= N) {
      return { ok: false, cells, value: null, endPos: null };
    }
    cells.push({ r, c });
    const key = `${r},${c}`;
    if (PRIME_AT[key] !== undefined && !collectedSet.has(PRIME_AT[key])) {
      return { ok: true, cells, value: PRIME_AT[key], endPos: { r, c } };
    }
  }
}

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Verified solution (found by exhaustive search) — used for "Mostra soluzione"
const SOLUTION = [
  { v: 113, d: null },
  { v: 43, d: "N" },
  { v: 41, d: "N" },
  { v: 37, d: "N" },
  { v: 103, d: "W" },
  { v: 101, d: "N" },
  { v: 97, d: "E" },
  { v: 5, d: "S" },
  { v: 7, d: "S" },
  { v: 107, d: "W" },
  { v: 109, d: "S" },
  { v: 47, d: "E" },
  { v: 83, d: "E" },
  { v: 89, d: "N" },
  { v: 31, d: "W" },
  { v: 29, d: "S" },
  { v: 3, d: "W" },
  { v: 2, d: "S" },
  { v: 11, d: "E" },
  { v: 13, d: "N" },
  { v: 59, d: "N" },
  { v: 131, d: "E" },
  { v: 127, d: "S" },
  { v: 53, d: "W" },
  { v: 19, d: "W" },
  { v: 17, d: "N" },
  { v: 67, d: "W" },
  { v: 71, d: "S" },
  { v: 73, d: "S" },
  { v: 79, d: "E" },
  { v: 137, d: "N" },
  { v: 139, d: "W" },
  { v: 61, d: "S" },
  { v: 23, d: "S" },
];

// Suggerimento: partenza e prima direzione della soluzione nota
const HINT_START_POS = POS_OF_PRIME[SOLUTION[0].v];
const HINT_START_DIR = SOLUTION[1].d;
const ARROW_ANGLE = { N: 0, E: 90, S: 180, W: 270 };

/* ============================================================
   COMPONENT
   ============================================================ */
export default function UlamSpiralPuzzle() {
  const [pos, setPos] = useState(null);
  const [dir, setDir] = useState(null);
  const [collected, setCollected] = useState([]);
  const [trail, setTrail] = useState([]);
  const [phase, setPhase] = useState("start"); // start | choosing | animating | won | stuck
  const [history, setHistory] = useState([]);
  const [showNumbers, setShowNumbers] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [availableDirs, setAvailableDirs] = useState([]);
  const [flashFail, setFlashFail] = useState(false);
  const [pulse, setPulse] = useState(null); // { r, c, key } — pietra appena raccolta
  const [showHint, setShowHint] = useState(false);
  const pulseIdRef = useRef(0);

  const triggerPulse = useCallback((p) => {
    pulseIdRef.current += 1;
    setPulse({ r: p.r, c: p.c, key: pulseIdRef.current });
  }, []);

  const timerRef = useRef(null);
  const solvingRef = useRef(false);

  const collectedSet = useMemo(
    () => new Set(collected.map((c) => c.value)),
    [collected]
  );

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const computeAvailable = useCallback((curPos, curDir, curCollectedSet) => {
    const candidates = optionsFor(curDir);
    return candidates.filter((d) => forcedWalk(curPos, d, curCollectedSet).ok);
  }, []);

  const playCells = useCallback((cells, speed, onDone) => {
    if (speed <= 0 || cells.length === 0) {
      if (cells.length) {
        setPos(cells[cells.length - 1]);
        setTrail((prev) => [...prev, ...cells]);
      }
      onDone();
      return;
    }
    let i = 0;
    const step = () => {
      if (i >= cells.length) {
        onDone();
        return;
      }
      const cell = cells[i];
      setPos(cell);
      setTrail((prev) => [...prev, cell]);
      i++;
      timerRef.current = setTimeout(step, speed);
    };
    step();
  }, []);

  const handleCellClick = (r, c) => {
    if (phase !== "start") return;
    const key = `${r},${c}`;
    const v = PRIME_AT[key];
    if (v === undefined) return;
    setPos({ r, c });
    setDir(null);
    setCollected([{ value: v, pos: { r, c } }]);
    setTrail([{ r, c }]);
    setHistory([]);
    setFlashFail(false);
    setShowHint(false);
    triggerPulse({ r, c });
    const avail = computeAvailable({ r, c }, null, new Set([v]));
    setAvailableDirs(avail);
    setPhase(avail.length ? "choosing" : "stuck");
  };

  const chooseDirection = useCallback(
    (d) => {
      if (phase !== "choosing") return;
      if (!availableDirs.includes(d)) return;
      const res = forcedWalk(pos, d, collectedSet);
      if (!res.ok) {
        setFlashFail(true);
        setTimeout(() => setFlashFail(false), 350);
        return;
      }
      setHistory((h) => [...h, { pos, dir, collected, trail }]);
      setPhase("animating");
      const speed = prefersReducedMotion() ? 0 : 90;
      playCells(res.cells, speed, () => {
        const newCollected = [...collected, { value: res.value, pos: res.endPos }];
        const newSet = new Set(newCollected.map((x) => x.value));
        setCollected(newCollected);
        setDir(d);
        triggerPulse(res.endPos);
        if (newCollected.length === TOTAL_PRIMES) {
          setPhase("won");
          setAvailableDirs([]);
        } else {
          const avail = computeAvailable(res.endPos, d, newSet);
          setAvailableDirs(avail);
          setPhase(avail.length ? "choosing" : "stuck");
        }
      });
    },
    [phase, availableDirs, pos, dir, collected, trail, collectedSet, playCells, computeAvailable, triggerPulse]
  );

  useEffect(() => {
    const map = { ArrowUp: "N", ArrowDown: "S", ArrowLeft: "W", ArrowRight: "E" };
    const onKey = (e) => {
      if (map[e.key]) {
        e.preventDefault();
        chooseDirection(map[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chooseDirection]);

  const undo = () => {
    if (phase === "animating" || solvingRef.current) return;
    if (history.length === 0) return;
    clearTimeout(timerRef.current);
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setPos(prev.pos);
    setDir(prev.dir);
    setCollected(prev.collected);
    setTrail(prev.trail);
    const set = new Set(prev.collected.map((x) => x.value));
    if (prev.collected.length === 0) {
      setPhase("start");
      setAvailableDirs([]);
    } else {
      const avail = computeAvailable(prev.pos, prev.dir, set);
      setAvailableDirs(avail);
      setPhase(avail.length ? "choosing" : "stuck");
    }
  };

  const restart = () => {
    clearTimeout(timerRef.current);
    solvingRef.current = false;
    setPos(null);
    setDir(null);
    setCollected([]);
    setTrail([]);
    setHistory([]);
    setAvailableDirs([]);
    setFlashFail(false);
    setShowHint(false);
    setPhase("start");
  };

  const showSolution = () => {
    clearTimeout(timerRef.current);
    solvingRef.current = true;
    setShowHint(false);
    const startPos = POS_OF_PRIME[SOLUTION[0].v];
    setPos(startPos);
    setDir(null);
    setCollected([{ value: SOLUTION[0].v, pos: startPos }]);
    setTrail([startPos]);
    setHistory([]);
    setAvailableDirs([]);
    setPhase("animating");
    triggerPulse(startPos);

    // La demo della soluzione deve sempre mostrare l'avanzamento passo passo,
    // anche con "riduci animazioni" attivo nel sistema: qui il movimento è il
    // contenuto stesso, non una decorazione da sopprimere.
    const CELL_SPEED = 55; // ms per cella percorsa
    const PAUSE_AT_STONE = 260; // pausa quando si raccoglie una pietra, utile nei punti di incrocio

    let i = 1;
    let curPos = startPos;
    let acc = [{ value: SOLUTION[0].v, pos: startPos }];

    const step = () => {
      if (!solvingRef.current) return;
      if (i >= SOLUTION.length) {
        setPhase("won");
        solvingRef.current = false;
        return;
      }
      const { v, d } = SOLUTION[i];
      const set = new Set(acc.map((x) => x.value));
      const res = forcedWalk(curPos, d, set);
      playCells(res.cells, CELL_SPEED, () => {
        curPos = res.endPos;
        acc = [...acc, { value: v, pos: res.endPos }];
        setCollected(acc);
        setDir(d);
        triggerPulse(res.endPos);
        i++;
        timerRef.current = setTimeout(step, PAUSE_AT_STONE);
      });
    };
    timerRef.current = setTimeout(step, 400);
  };

  const cx = (c) => c * CELL + CELL / 2;
  const cy = (r) => r * CELL + CELL / 2;
  const trailPoints = trail.map((p) => `${cx(p.c)},${cy(p.r)}`).join(" ");

  const statusText =
    phase === "start"
      ? "Tocca o seleziona con Tab una pietra color rame sulla griglia per iniziare."
      : phase === "choosing"
      ? `Attualmente su ${collected[collected.length - 1]?.value}. Scegli la prossima direzione.`
      : phase === "stuck"
      ? "Vicolo cieco: nessuna direzione porta a un'altra pietra senza uscire dalla griglia. Prova ad annullare l'ultima mossa."
      : phase === "won"
      ? "Tutte le 34 pietre raccolte."
      : "";

  return (
    <div
      style={{
        background: COLORS.ink,
        minHeight: "100vh",
        color: COLORS.paper,
        fontFamily: FONT_BODY,
        padding: "28px 16px 40px",
      }}
    >
      <style>{`
        .usp-btn { transition: transform .12s ease, background .15s ease, opacity .15s ease; }
        .usp-btn:active:not(:disabled) { transform: scale(0.94); }
        .usp-cell { cursor: pointer; }
        .usp-shake { animation: usp-shake .35s; }
        @keyframes usp-shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .usp-pulse-ring {
          transform-box: fill-box;
          transform-origin: center;
          animation: usp-pulse-ring 550ms ease-out forwards;
          pointer-events: none;
        }
        .usp-pulse-dot {
          transform-box: fill-box;
          transform-origin: center;
          animation: usp-pulse-dot 350ms ease-out;
        }
        @keyframes usp-pulse-ring {
          0% { transform: scale(1); opacity: 0.85; }
          100% { transform: scale(2.1); opacity: 0; }
        }
        @keyframes usp-pulse-dot {
          0% { transform: scale(1); }
          40% { transform: scale(1.45); }
          100% { transform: scale(1); }
        }
        .usp-hint-ring {
          transform-box: fill-box;
          transform-origin: center;
          animation: usp-hint-ring-pulse 1.4s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes usp-hint-ring-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.22); }
        }
        .usp-hint-arrow {
          animation: usp-hint-arrow-blink 1.2s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes usp-hint-arrow-blink {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
        .usp-btn:focus-visible,
        .usp-cell:focus-visible {
          outline: 2px solid ${COLORS.gold};
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .usp-shake { animation: none; }
          .usp-btn { transition: none; }
          .usp-pulse-ring { animation: none; opacity: 0; }
          .usp-pulse-dot { animation: none; }
          .usp-hint-ring { animation: none; opacity: 0.85; }
          .usp-hint-arrow { animation: none; opacity: 0.9; }
        }
      `}</style>

      <div style={{ maxWidth: 1320, width: "100%", margin: "0 auto" }}>
        {/* header */}
        <div style={{ marginBottom: 22 }}>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: COLORS.copper,
              marginBottom: 6,
            }}
          >
            Rompicapo sui numeri primi a spirale · 12 × 12 · 34 pietre
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <h1
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 600,
                fontSize: "clamp(28px, 4vw, 40px)",
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              La Spirale di Ulam
            </h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <UlamSpiralModal />
              <button
                onClick={() => setShowRules((s) => !s)}
                className="usp-btn"
                aria-expanded={showRules}
                aria-controls="usp-rules"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "transparent",
                  border: `1px solid ${COLORS.line}`,
                  color: COLORS.paperDim,
                  padding: "7px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <Info size={14} aria-hidden="true" /> Come si gioca
              </button>
            </div>
          </div>
        </div>

        {showRules && (
          <div
            id="usp-rules"
            style={{
              background: COLORS.panel,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 12,
              padding: "18px 20px",
              marginBottom: 22,
              fontSize: 14,
              lineHeight: 1.6,
              color: COLORS.paperDim,
              position: "relative",
            }}
          >
            <button
              onClick={() => setShowRules(false)}
              aria-label="Chiudi le istruzioni"
              className="usp-btn"
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                background: "none",
                border: "none",
                color: COLORS.paperDim,
                cursor: "pointer",
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
            <p style={{ margin: "0 0 10px", color: COLORS.paper }}>
              Raccogli le 34 pietre (i numeri primi) con un unico percorso.
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Scegli una pietra qualsiasi come partenza, poi una direzione libera.</li>
              <li>Ti muovi solo in orizzontale o verticale, mai in diagonale.</li>
              <li>Attraversi liberamente caselle vuote, composte o già raccolte.</li>
              <li>Ogni pietra incontrata va raccolta: non puoi ignorarla.</li>
              <li>
                Puoi cambiare direzione <em>solo</em> nel momento in cui raccogli una
                pietra ancora presente — mai un'inversione a 180°.
              </li>
              <li>Una pietra già raccolta diventa un passaggio libero, non un bivio.</li>
            </ul>
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 28,
            flexWrap: "wrap",
            alignItems: "stretch",
          }}
        >
          {/* GRID */}
          <div
            className={flashFail ? "usp-shake" : ""}
            style={{
              flex: "1 1 420px",
              maxWidth: N * CELL,
              width: "100%",
              background: COLORS.panel,
              borderRadius: 16,
              padding: 14,
              border: `1px solid ${COLORS.line}`,
            }}
          >
            <svg
              viewBox={`0 0 ${N * CELL} ${N * CELL}`}
              style={{ width: "100%", height: "auto", display: "block" }}
              role="group"
              aria-label="Griglia della spirale di Ulam, 12 per 12"
            >
              {Array.from({ length: N + 1 }).map((_, i) => (
                <line
                  key={"v" + i}
                  x1={i * CELL}
                  y1={0}
                  x2={i * CELL}
                  y2={N * CELL}
                  strokeWidth={1}
                  style={{ stroke: COLORS.lineFaint }}
                />
              ))}
              {Array.from({ length: N + 1 }).map((_, i) => (
                <line
                  key={"h" + i}
                  x1={0}
                  y1={i * CELL}
                  x2={N * CELL}
                  y2={i * CELL}
                  strokeWidth={1}
                  style={{ stroke: COLORS.lineFaint }}
                />
              ))}

              {GRID.map((row, r) =>
                row.map((v, c) => {
                  const key = `${r},${c}`;
                  const prime = PRIME_AT[key];
                  const isCollected = prime !== undefined && collectedSet.has(prime);
                  const clickable = phase === "start" && prime !== undefined;
                  const label =
                    prime !== undefined
                      ? `Pietra ${prime}${isCollected ? ", raccolta" : ", da raccogliere"}`
                      : null;
                  return (
                    <g
                      key={key}
                      className={clickable ? "usp-cell" : ""}
                      onClick={() => handleCellClick(r, c)}
                      role={clickable ? "button" : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      aria-label={clickable ? `Inizia da ${label}` : undefined}
                      onKeyDown={
                        clickable
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleCellClick(r, c);
                              }
                            }
                          : undefined
                      }
                    >
                      {prime !== undefined && (
                        <circle
                          key={pulse && pulse.r === r && pulse.c === c ? `dot-${pulse.key}` : "dot"}
                          className={pulse && pulse.r === r && pulse.c === c ? "usp-pulse-dot" : ""}
                          cx={cx(c)}
                          cy={cy(r)}
                          r={15.5}
                          strokeWidth={1.5}
                          style={{
                            fill: isCollected ? COLORS.jade : COLORS.copper,
                            stroke: isCollected ? COLORS.jadeDim : COLORS.copperDim,
                            transition: "fill .25s ease",
                          }}
                        />
                      )}
                      {showNumbers && (
                        <text
                          x={cx(c)}
                          y={cy(r) + 4}
                          textAnchor="middle"
                          style={{
                            fontFamily: FONT_MONO,
                            fontSize: prime ? 10 : 9.5,
                            fill: prime ? "#0F1218" : COLORS.paperDim,
                            opacity: prime ? 1 : 0.55,
                            fontWeight: prime ? 600 : 400,
                            pointerEvents: "none",
                          }}
                        >
                          {v}
                        </text>
                      )}
                    </g>
                  );
                })
              )}

              {trail.length > 1 && (
                <polyline
                  points={trailPoints}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.9}
                  style={{ fill: "none", stroke: COLORS.gold }}
                />
              )}

              {pos && (
                <circle
                  cx={cx(pos.c)}
                  cy={cy(pos.r)}
                  r={20}
                  strokeWidth={2.5}
                  style={{ fill: "none", stroke: COLORS.gold }}
                />
              )}

              {pulse && (
                <circle
                  key={`ring-${pulse.key}`}
                  className="usp-pulse-ring"
                  cx={cx(pulse.c)}
                  cy={cy(pulse.r)}
                  r={15.5}
                  strokeWidth={2.5}
                  style={{ fill: "none", stroke: COLORS.gold }}
                />
              )}

              {showHint && phase === "start" && (
                <>
                  <circle
                    className="usp-hint-ring"
                    cx={cx(HINT_START_POS.c)}
                    cy={cy(HINT_START_POS.r)}
                    r={15.5}
                    strokeWidth={3}
                    style={{ fill: "none", stroke: COLORS.gold }}
                  />
                  <g
                    className="usp-hint-arrow"
                    transform={`translate(${cx(HINT_START_POS.c) + DELTA[HINT_START_DIR][1] * CELL}, ${
                      cy(HINT_START_POS.r) + DELTA[HINT_START_DIR][0] * CELL
                    }) rotate(${ARROW_ANGLE[HINT_START_DIR]})`}
                  >
                    <path d="M 0,-10 L 8,8 L -8,8 Z" style={{ fill: COLORS.gold }} />
                  </g>
                </>
              )}
            </svg>
          </div>

          {/* PANEL */}
          <div
            style={{
              flex: "1 1 340px",
              minWidth: 260,
              minHeight: PANEL_MIN_HEIGHT,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* status */}
            <div
              style={{
                background: COLORS.panel,
                border: `1px solid ${COLORS.line}`,
                borderRadius: 12,
                padding: "16px 18px",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 13, color: COLORS.paperDim }}>Pietre raccolte</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 18, color: COLORS.gold }}>
                  {collected.length} / {TOTAL_PRIMES}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={collected.length}
                aria-valuemin={0}
                aria-valuemax={TOTAL_PRIMES}
                aria-label="Pietre raccolte"
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: COLORS.panelAlt,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(collected.length / TOTAL_PRIMES) * 100}%`,
                    background: COLORS.gold,
                    transition: "width .2s ease",
                  }}
                />
              </div>

              <p
                aria-live="polite"
                style={{
                  fontSize: 13.5,
                  color: phase === "stuck" ? COLORS.danger : COLORS.paperDim,
                  marginTop: 12,
                  marginBottom: 0,
                }}
              >
                {statusText}
              </p>
              {phase === "start" && (
                <div style={{ marginTop: 12 }}>
                  <ActionButton
                    icon={Lightbulb}
                    label={showHint ? "Nascondi suggerimento" : "Suggerimento"}
                    onClick={() => setShowHint((s) => !s)}
                    tone="gold"
                    ariaPressed={showHint}
                  />
                </div>
              )}
              {phase === "won" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 8,
                    color: COLORS.jade,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  <Trophy size={16} aria-hidden="true" /> Traguardo raggiunto
                </div>
              )}
            </div>

            {/* compass */}
            <div
              role="group"
              aria-label="Controlli di direzione"
              style={{
                background: COLORS.panel,
                border: `1px solid ${COLORS.line}`,
                borderRadius: 12,
                padding: 18,
                marginBottom: 16,
                display: "grid",
                gridTemplateColumns: "56px 56px 56px",
                gridTemplateRows: "56px 56px 56px",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <div />
              <DirButton d="N" enabled={availableDirs.includes("N")} onClick={chooseDirection} />
              <div />
              <DirButton d="W" enabled={availableDirs.includes("W")} onClick={chooseDirection} />
              <div
                aria-hidden="true"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: COLORS.paperDim,
                }}
              >
                <Gem size={18} />
              </div>
              <DirButton d="E" enabled={availableDirs.includes("E")} onClick={chooseDirection} />
              <div />
              <DirButton d="S" enabled={availableDirs.includes("S")} onClick={chooseDirection} />
              <div />
            </div>

            {/* controls */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <ActionButton
                icon={RotateCcw}
                label="Annulla"
                onClick={undo}
                disabled={history.length === 0 || phase === "animating"}
              />
              <ActionButton icon={RefreshCw} label="Ricomincia" onClick={restart} />
              <ActionButton icon={Wand2} label="Mostra soluzione" onClick={showSolution} accent />
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: COLORS.paperDim,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={showNumbers}
                onChange={(e) => setShowNumbers(e.target.checked)}
              />
              Mostra i numeri della griglia
            </label>

            {/* collected list */}
            <div
              style={{
                marginTop: 18,
                background: COLORS.panel,
                border: `1px solid ${COLORS.line}`,
                borderRadius: 12,
                padding: "14px 16px",
                flex: 1,
                minHeight: 220,
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: COLORS.paperDim,
                  marginBottom: 8,
                }}
              >
                Ordine di raccolta
              </div>
              {collected.length === 0 ? (
                <p style={{ fontSize: 13, color: COLORS.paperDim, margin: 0 }}>
                  Nessuna pietra raccolta ancora.
                </p>
              ) : (
                <ol
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                  }}
                >
                  {collected.map((s, i) => (
                    <li
                      key={i}
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 12,
                        background: COLORS.panelAlt,
                        color: COLORS.jade,
                        padding: "3px 7px",
                        borderRadius: 6,
                      }}
                    >
                      {s.value}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DirButton({ d, enabled, onClick }) {
  const Icon = ICONS[d];
  return (
    <button
      className="usp-btn"
      disabled={!enabled}
      onClick={() => onClick(d)}
      aria-label={`Vai a ${LABELS[d]}`}
      title={LABELS[d]}
      style={{
        width: 56,
        height: 56,
        borderRadius: 10,
        border: `1px solid ${enabled ? COLORS.gold : COLORS.line}`,
        background: enabled ? "rgba(232,196,104,0.12)" : "transparent",
        color: enabled ? COLORS.gold : "#454C58",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: enabled ? "pointer" : "not-allowed",
      }}
    >
      <Icon size={22} aria-hidden="true" />
    </button>
  );
}

function ActionButton({ icon: Icon, label, onClick, disabled, accent, tone = "default", ariaPressed }) {
  const toneColor = tone === "gold" ? COLORS.gold : accent ? COLORS.copper : null;
  return (
    <button
      className="usp-btn"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={ariaPressed}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "9px 13px",
        borderRadius: 9,
        border: `1px solid ${toneColor || COLORS.line}`,
        background: toneColor ? `${toneColor}24` : "transparent",
        color: toneColor || COLORS.paperDim,
        fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Icon size={15} aria-hidden="true" /> {label}
    </button>
  );
}
