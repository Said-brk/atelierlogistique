import { useRef, useState, useEffect, useCallback } from 'react';
import { optimizeWithInsights } from './engine/optimizer';

/**
 * Pilote le moteur d'optimisation via un Web Worker (calcul hors thread UI).
 * Repli synchrone si le Worker n'est pas disponible, pour ne jamais bloquer
 * l'utilisateur ni afficher de page blanche.
 */
export function useOptimizer() {
  const workerRef = useRef(null);
  const [status, setStatus] = useState('idle'); // 'idle' | 'running' | 'done' | 'error'
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let worker = null;
    try {
      worker = new Worker(new URL('./worker/optimizer.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        if (e.data?.ok) {
          setResult(e.data.result);
          setStatus('done');
        } else {
          setError(e.data?.error || 'Erreur moteur');
          setStatus('error');
        }
      };
      worker.onerror = () => { workerRef.current = null; };
      workerRef.current = worker;
    } catch {
      workerRef.current = null;
    }
    return () => { if (worker) worker.terminate(); };
  }, []);

  const run = useCallback((container, definitions, options) => {
    setStatus('running');
    setError(null);
    const worker = workerRef.current;
    if (worker) {
      worker.postMessage({ container, definitions, options });
      return;
    }
    // Repli synchrone
    try {
      const r = optimizeWithInsights(container, definitions, options);
      setResult(r);
      setStatus('done');
    } catch (e) {
      setError(e?.message || 'Erreur moteur');
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  /** Réaffiche un plan déjà calculé (plan enregistré), sans relancer le moteur. */
  const restore = useCallback((r) => {
    setResult(r);
    setStatus('done');
    setError(null);
  }, []);

  return { run, reset, restore, result, status, error };
}
