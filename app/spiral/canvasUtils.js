// canvasUtils.js
//
// Helper condivisi dai due viewer per lavorare con un sistema di coordinate
// "logico" fisso (es. 640x640) indipendente dalla risoluzione reale del canvas.
// Cosi' il disegno resta nitido sia quando il canvas viene ingrandito via CSS
// (max-w-3xl = 768px > 640px) sia sugli schermi ad alta densita' (Retina),
// senza cambiare le formule di layout dei viewer.

// Imposta la risoluzione reale del canvas (logicalSize * ratio) e applica una
// trasformazione, cosi' si continua a disegnare in coordinate logiche.
export function prepareCanvas(canvas, logicalSize) {
  const ratio = Math.min(3, Math.max(2, Math.ceil(window.devicePixelRatio || 1)));
  const px = logicalSize * ratio;
  if (canvas.width !== px || canvas.height !== px) {
    canvas.width = px;
    canvas.height = px;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

// Converte la posizione di un evento puntatore in coordinate logiche del canvas.
// Usa clientLeft/clientWidth (area interna, bordo escluso): getBoundingClientRect
// include il bordo di 1px del canvas e falserebbe leggermente la posizione.
export function pointerToLogical(e, canvas, logicalSize) {
  const rect = canvas.getBoundingClientRect();
  const w = canvas.clientWidth || rect.width || 1;
  const h = canvas.clientHeight || rect.height || 1;
  return {
    x: ((e.clientX - rect.left - canvas.clientLeft) * logicalSize) / w,
    y: ((e.clientY - rect.top - canvas.clientTop) * logicalSize) / h,
  };
}

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
