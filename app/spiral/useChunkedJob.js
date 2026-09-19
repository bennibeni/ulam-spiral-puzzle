import { useEffect, useMemo, useState } from "react";
import { runJob, runSync } from "./spiralCompute";

/**
 * Esegue un calcolo pesante: `build(a, b)` deve restituire un generatore (vedi
 * spiralCompute.js). Il calcolo si rifa' quando cambiano `a` o `b`.
 *  - sync = true: il risultato si ricava direttamente nel rendering (conteggi
 *    piccoli, costa pochi ms), senza passare da un effetto;
 *  - sync = false: calcolo a fette, senza bloccare la pagina; se `a` o `b`
 *    cambiano prima della fine (es. si trascina uno slider) il calcolo in corso
 *    viene annullato. Lo stato si aggiorna solo nelle callback di avanzamento e
 *    di fine calcolo, mai in modo sincrono dentro l'effetto.
 *
 * `build` deve essere una funzione stabile (definita a livello di modulo) e `a`,
 * `b` valori stabili (oggetti costanti o numeri).
 *
 * Restituisce { value, input: [a, b], running, progress }:
 *  - `value` e' il risultato dell'ultimo calcolo COMPLETATO (resta invariato mentre
 *    se ne fa uno nuovo, cosi' il disegno a schermo non sparisce);
 *  - `input` sono gli (a, b) a cui quel risultato si riferisce: confrontandoli con
 *    quelli attuali si sa se il risultato e' aggiornato.
 */
export function useChunkedJob(build, a, b, sync) {
  const syncValue = useMemo(
    () => (sync ? runSync(() => build(a, b)) : null),
    [build, a, b, sync]
  );

  const [done, setDone] = useState(null); // { a, b, value } dell'ultimo calcolo finito
  const [prog, setProg] = useState(null); // { a, b, progress } dell'ultimo avanzamento

  useEffect(() => {
    if (sync) return undefined;
    return runJob(() => build(a, b), {
      onProgress: (progress) => setProg({ a, b, progress }),
      onDone: (value) => setDone({ a, b, value }),
    });
  }, [build, a, b, sync]);

  if (sync) return { value: syncValue, input: [a, b], running: false, progress: 1 };

  const current = done !== null && done.a === a && done.b === b;
  return {
    value: done ? done.value : null,
    input: done ? [done.a, done.b] : [null, null],
    running: !current,
    progress: current ? 1 : prog !== null && prog.a === a && prog.b === b ? prog.progress : 0,
  };
}
