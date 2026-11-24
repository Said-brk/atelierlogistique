// Preuve de chargement : petite icône discrète dans l'en-tête du chargement ; un clic ouvre les photos
// prises par le cariste à la fin du chargement (camion, nom, heure).

import { useEffect, useState } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';
import { loadingProofs } from './data';
import { fmtDateTime } from './ui';

export default function LoadingProof({ shipmentId, status }) {
  const [proofs, setProofs] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { setProofs(null); loadingProofs(shipmentId).then(setProofs).catch(() => setProofs([])); }, [shipmentId, status]);
  if (!proofs?.length) return null;
  const n = proofs.reduce((s, p) => s + p.urls.length, 0);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Preuve de chargement"
        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-violet-700">
        <Camera size={13} /> Preuve{n > 1 ? ` (${n})` : ''}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center">
              <div className="font-bricolage font-semibold text-lg text-slate-900 flex items-center gap-2"><Camera size={18} /> Preuve de chargement</div>
              <button onClick={() => setOpen(false)} aria-label="Fermer" className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
            </div>
            {proofs === null ? <Loader2 className="animate-spin mx-auto text-slate-400" /> : proofs.map((p) => (
              <div key={p.id} className="space-y-2">
                <div className="text-sm text-slate-600">
                  {proofs.some((x) => x.truck > 1) && <b className="text-slate-900">Camion {p.truck} · </b>}
                  Confirmé le {fmtDateTime(p.created_at)}{p.loaded_by ? ` par ${p.loaded_by}` : ''}
                </div>
                {p.urls.length ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {p.urls.map((u) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="Camion chargé" className="w-full h-40 object-cover rounded-lg border border-slate-200 hover:opacity-90" /></a>
                    ))}
                  </div>
                ) : <div className="text-xs text-slate-400">Confirmé sans photo.</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
