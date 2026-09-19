// ulamSpiral.js
//
// Spirale di Ulam: gli interi sono scritti su una griglia quadrata seguendo una
// spirale che parte da 1 al centro: 1 passo a destra, 1 in su, 2 a sinistra,
// 2 in giu', 3 a destra, 3 in su, ... (le lunghezze dei tratti sono 1,1,2,2,3,3,...).
//
//   37 36 35 34 33 32 31
//   38 17 16 15 14 13 30
//   39 18  5  4  3 12 29
//   40 19  6  1  2 11 28
//   41 20  7  8  9 10 27
//   42 21 22 23 24 25 26
//
// La posizione di n si ricava con una formula chiusa (nessuno stato da portarsi
// dietro), cosi' si puo' calcolare a blocchi anche per milioni di numeri.

// Scrive in xs/ys le posizioni degli interi da+1 ... a (indice i <-> intero i+1).
// Coordinate di griglia: x verso destra, y verso il BASSO (come sul canvas).
export function fillUlam(xs, ys, from, to) {
  for (let i = from; i < to; i++) {
    const n = i + 1;
    if (n === 1) {
      xs[i] = 0;
      ys[i] = 0;
      continue;
    }
    const k = Math.ceil((Math.sqrt(n) - 1) / 2); // anello a cui appartiene n
    const side = 2 * k; // lunghezza di un lato dell'anello
    let m = (2 * k + 1) * (2 * k + 1); // ultimo numero dell'anello (angolo in basso a destra)
    let x;
    let y; // y verso l'alto
    if (n >= m - side) {
      // lato inferiore, si va verso destra
      x = k - (m - n);
      y = -k;
    } else {
      m -= side;
      if (n >= m - side) {
        // lato sinistro, si va verso il basso
        x = -k;
        y = -k + (m - n);
      } else {
        m -= side;
        if (n >= m - side) {
          // lato superiore, si va verso sinistra
          x = -k + (m - n);
          y = k;
        } else {
          // lato destro, si va verso l'alto
          m -= side;
          x = k;
          y = k - (m - n);
        }
      }
    }
    xs[i] = x;
    ys[i] = -y;
  }
}

// Massimo |x| o |y| raggiunto da 1..count (serve per scalare il disegno).
export function ulamExtent(count) {
  return Math.max(1, Math.ceil((Math.sqrt(count) - 1) / 2));
}
