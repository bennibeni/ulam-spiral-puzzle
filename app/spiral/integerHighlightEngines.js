// integerHighlightEngines.js
//
// Motori di evidenziazione condivisi per rappresentazioni di interi su spirale
// (Vogel Spiral Viewer, Ulam Spiral Puzzle, ecc.). Ogni engine espone getStyle(n)
// che restituisce { color, radiusFactor } per il punto associato all'intero n.
//
// L'idea è avere UN SOLO posto dove vivono primalità, k-almost primes, Collatz,
// Goldbach ecc., cosi' i due visualizzatori restano coerenti e si estendono insieme.

export function isPrime(n) {
  if (n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

// Numero di fattori primi con molteplicità (per k-almost primes: k=1 primi, k=2 semiprimi, ...)
export function primeFactorCount(n) {
  let count = 0;
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    while (m % p === 0) {
      m /= p;
      count++;
    }
  }
  if (m > 1) count++;
  return count;
}

export function collatzSteps(n, maxSteps = 10000) {
  let steps = 0;
  let m = n;
  while (m !== 1 && steps < maxSteps) {
    m = m % 2 === 0 ? m / 2 : 3 * m + 1;
    steps++;
  }
  return steps;
}

// Vero se n è pari, >=4, e scomponibile in due primi (per la congettura di Goldbach
// dovrebbe valere sempre in questo range, ma il flag resta utile per l'evidenziazione).
export function hasGoldbachPair(n) {
  if (n < 4 || n % 2 !== 0) return false;
  for (let p = 2; p <= n / 2; p++) {
    if (isPrime(p) && isPrime(n - p)) return true;
  }
  return false;
}

const PALETTE = {
  accent: "#e8b64c", // angolo aureo / evidenziazione principale
  neutral: "#3f4451",
  kColors: ["#3f4451", "#e8b64c", "#e2725b", "#7fb3d5", "#9b7ede", "#5fbf8f"],
};

function collatzStyle(steps) {
  const t = Math.min(steps / 120, 1);
  const r = Math.round(60 + t * 195);
  const g = Math.round(60 + (1 - t) * 120);
  const b = Math.round(200 - t * 140);
  return { color: `rgb(${r},${g},${b})`, radiusFactor: 0.7 + t * 0.9 };
}

export const highlightEngines = {
  primes: {
    label: "Numeri primi",
    getStyle: (n) =>
      isPrime(n)
        ? { color: PALETTE.accent, radiusFactor: 1.4 }
        : { color: PALETTE.neutral, radiusFactor: 0.8 },
  },

  almostPrimes: {
    label: "k-almost primes",
    getStyle: (n) => {
      const k = primeFactorCount(n);
      const idx = Math.min(k, PALETTE.kColors.length - 1);
      return {
        color: PALETTE.kColors[idx],
        radiusFactor: 0.75 + Math.min(k, 5) * 0.12,
      };
    },
  },

  collatz: {
    label: "Passi di Collatz",
    getStyle: (n) => collatzStyle(collatzSteps(n)),
    // Versione veloce per chi valuta tutti gli interi 1..count in ordine (es.
    // 1.000.000 di punti): una traiettoria si ferma appena scende sotto n, perche'
    // i passi dei numeri piu' piccoli sono gia' calcolati. Stessi risultati di
    // getStyle, ma circa 5-10 volte piu' veloce.
    prepare: (count) => {
      const cache = new Uint16Array(count + 1); // cache[m] = passi di m (0 = non calcolato)
      return (n) => {
        if (n > count) return collatzStyle(collatzSteps(n));
        let steps = 0;
        if (n > 1) {
          let m = n;
          do {
            m = m % 2 === 0 ? m / 2 : 3 * m + 1;
            steps++;
          } while (m >= n && steps < 10000);
          if (m < n && (m === 1 || cache[m] !== 0)) steps += m === 1 ? 0 : cache[m];
          else steps = collatzSteps(n); // fuori ordine o oltre il tetto: calcolo diretto
        }
        cache[n] = steps;
        return collatzStyle(steps);
      };
    },
  },

  goldbach: {
    label: "Goldbach (pari scomponibili)",
    getStyle: (n) =>
      n % 2 === 0 && hasGoldbachPair(n)
        ? { color: PALETTE.accent, radiusFactor: 1.2 }
        : { color: PALETTE.neutral, radiusFactor: 0.7 },
  },
};
