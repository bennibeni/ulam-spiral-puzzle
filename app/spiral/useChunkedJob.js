import { useEffect, useState } from "react";
import { runJob, runSync } from "./spiralCompute";

/**
 * Esegue un calcolo pesante (generatore) rifacendolo quando cambiano `deps`.
 *  - sync = true: calcolo immediato (conteggi piccoli, costa pochi ms);
 *  - sync = false: calcolo a fette, senza bloccare la pagina; se le dipendenze
 *    cambiano prima della fine (es. si trascina uno slider) il calcolo in corso
 *    viene annullato.
 * `value` resta quello dell'ultimo calcolo COMPLETATO finche' non ne finisce uno
 * nuovo, cosi' il disegno a schermo non sparisce mentre si ricalcola.
 */
export function useChunkedJob(makeGen, deps, sync) {
  const [state, setState] = useState({ value: null, progress: 0, running: !sync });

  useEffect(() => {
    if (sync) {
      setState({ value: runSync(makeGen), progress: 1, running: false });
      return undefined;
    }
    setState((s) => ({ ...s, progress: 0, running: true }));
    return runJob(makeGen, {
      onProgress: (progress) => setState((s) => ({ ...s, progress })),
      onDone: (value) => setState({ value, progress: 1, running: false }),
    });
    // makeGen cambia ad ogni render: conta solo il contenuto di `deps`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
