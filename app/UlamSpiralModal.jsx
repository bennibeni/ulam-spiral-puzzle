"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LayoutGrid, X } from "lucide-react";
import { COLORS, FONT_BODY, FONT_DISPLAY, FONT_MONO } from "./theme";
import UlamSpiralViewer, { DEFAULT_SETTINGS } from "./UlamSpiralViewer";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * UlamSpiralModal
 *
 * Bottone "Esplora la spirale" + modale che mostra la spirale di Ulam completa
 * (fino a 1.000.000 di numeri) con le stesse scelte del viewer di R18.
 *
 * Accessibilita': role="dialog" + aria-modal, focus intrappolato nella modale e
 * riportato al bottone alla chiusura, Esc e clic sullo sfondo chiudono, lo
 * scorrimento della pagina sotto e' bloccato finche' la modale e' aperta.
 * Le impostazioni scelte restano se si chiude e si riapre.
 */
export default function UlamSpiralModal() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const triggerRef = useRef(null);
  const dialogRef = useRef(null);
  const titleId = useId();

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const updateSettings = useCallback(
    (patch) => setSettings((s) => ({ ...s, ...patch })),
    []
  );

  // finche' e' aperta: blocca lo scorrimento della pagina (senza far "saltare" il
  // layout quando sparisce la barra di scorrimento) e porta il focus nella modale
  useEffect(() => {
    if (!open) return undefined;
    const { body, documentElement } = document;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    dialogRef.current?.focus();
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, [open]);

  function onKeyDown(e) {
    // Il rompicapo ascolta le frecce sulla finestra per muovere le pietre:
    // finche' la modale e' aperta i tasti restano alla modale (es. le frecce
    // sugli slider) e non arrivano al gioco sotto.
    e.stopPropagation();

    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== "Tab") return;

    // focus intrappolato: Tab e Maiusc+Tab restano dentro la modale
    const nodes = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE));
    if (nodes.length === 0) {
      e.preventDefault();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === dialogRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <style>{`
        .usm-btn { transition: transform .12s ease, background .15s ease, border-color .15s ease; }
        .usm-btn:hover { border-color: ${COLORS.paperDim}; }
        .usm-btn:active { transform: scale(0.94); }
        .usm-btn:focus-visible,
        .usm-dialog input:focus-visible,
        .usm-dialog select:focus-visible {
          outline: 2px solid ${COLORS.gold};
          outline-offset: 2px;
        }
        .usm-dialog:focus { outline: none; }
        @media (prefers-reduced-motion: reduce) {
          .usm-btn { transition: none; }
        }
      `}</style>

      <button
        ref={triggerRef}
        type="button"
        className="usm-btn"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
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
          fontFamily: FONT_BODY,
          cursor: "pointer",
        }}
      >
        <LayoutGrid size={14} aria-hidden="true" /> Esplora la spirale
      </button>

      {open &&
        createPortal(
          <div
            // mousedown e non click: trascinare uno slider e rilasciare sullo
            // sfondo non deve chiudere la modale
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close();
            }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 12,
              background: "rgba(8, 10, 14, 0.78)",
            }}
          >
            <div
              ref={dialogRef}
              className="usm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              onKeyDown={onKeyDown}
              style={{
                width: "min(940px, 100%)",
                maxHeight: "calc(100vh - 24px)",
                overflowY: "auto",
                background: COLORS.panel,
                border: `1px solid ${COLORS.line}`,
                borderRadius: 16,
                boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
                padding: "0 22px 22px",
                color: COLORS.paper,
              }}
            >
              <div
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  background: COLORS.panel,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "18px 0 14px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 11,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: COLORS.copper,
                      marginBottom: 4,
                    }}
                  >
                    Numeri primi · fino a 1.000.000 di numeri
                  </div>
                  <h2
                    id={titleId}
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 600,
                      fontSize: "clamp(22px, 3.2vw, 30px)",
                      margin: 0,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    La spirale di Ulam
                  </h2>
                </div>
                <button
                  type="button"
                  className="usm-btn"
                  onClick={close}
                  aria-label="Chiudi la spirale"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 36,
                    height: 36,
                    flex: "none",
                    background: "transparent",
                    border: `1px solid ${COLORS.line}`,
                    color: COLORS.paperDim,
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              <UlamSpiralViewer settings={settings} onChange={updateSettings} />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
