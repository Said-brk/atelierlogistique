import { useRef, useState, useEffect, useCallback } from 'react';
import { planFleet } from './engine/fleet';

/** Calcul de flotte dans un Web Worker dédié (repli synchrone si indisponible). */
export function useFleetPlanner() {
  const workerRef = useRef(null);
  const [status, setStatus] = useState('idle'); // 'idle' | 'running' | 'done' | 'error'
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let worker = null;
    try {
      worker = new Worker(new URL('./worker/fleet.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        if (e.data?.ok) { setPlan(e.data.plan); setStatus('done'); } else { setError(e.data?.error || 'Erreur moteur'); setStatus('error'); }
      };
      worker.onerror = () => { workerRef.current = null; };
      workerRef.current = worker;
    } catch { workerRef.current = null; }
    return () => { if (worker) worker.terminate(); };
  }, []);

  const runFleet = useCallback((definitions, vehicles, options) => {
    setStatus('running'); setError(null);
    if (workerRef.current) { workerRef.current.postMessage({ definitions, vehicles, options }); return; }
    try { setPlan(planFleet(definitions, vehicles, options)); setStatus('done'); } catch (e) { setError(e?.message || 'Erreur moteur'); setStatus('error'); }
  }, []);

  /** Réaffiche une flotte déjà calculée (chargement enregistré), sans relancer le calcul. */
  const restoreFleet = useCallback((p) => { setPlan(p); setStatus('done'); setError(null); }, []);
  const resetFleet = useCallback(() => { setStatus('idle'); setPlan(null); setError(null); }, []);
  return { runFleet, resetFleet, restoreFleet, plan, status, error };
}
