// Preuve de chargement : photos prises par le cariste à la fin du chargement (camion, nom, heure).
//  • useLoadingProofs(id, status) : preuves du chargement (rechargées quand le statut change)
//  • <ProofButton> : petite icône discrète « Preuve » (en-tête du chargement, carte d'un camion de la flotte)
//  • <ProofViewer> : fenêtre des photos (toutes, ou d'un camion)

import { useEffect, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { loadingProofs } from './data';
import { fmtDateTime } from './ui';
import { t as tr } from '../shared/i18n/core';

export function useLoadingProofs(shipmentId, status) {
  const [proofs, setProofs] = useState([]);
  useEffect(() => {
    if (!shipmentId) return undefined;
    let alive = true;
    loadingProofs(shipmentId).then((p) => alive && setProofs(p)).catch(() => alive && setProofs([]));
    return () => { alive = false; };
  }, [shipmentId, status]);
  return proofs;
}

/** Dernière confirmation de chaque camion : { [camion]: { loadedAt, by, photos } }. */
export function proofsByTruck(proofs) {
  const out = {};
  for (const p of proofs) if (!out[p.truck]) out[p.truck] = { loadedAt: p.created_at, by: p.loaded_by, photos: p.urls.length };
  return out;
}

export function ProofButton({ count, onClick }) {
  return (
    <button type="button" onClick={onClick} title={tr('Preuve de chargement')} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-violet-700">
      <Camera size={13} /> {tr('Preuve')}{count > 1 ? ` (${count})` : ''}
    </button>
  );
}

export function ProofViewer({ proofs, truck = null, onClose }) {
  const shown = truck ? proofs.filter((p) => p.truck === truck) : proofs;
  const fleet = proofs.some((x) => x.truck > 1);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center">
          <div className="font-bricolage font-semibold text-lg text-slate-900 flex items-center gap-2"><Camera size={18} /> {tr('Preuve de chargement')}{truck ? ` · ${tr('camion {n}', { n: truck })}` : ''}</div>
          <button onClick={onClose} aria-label={tr('Fermer')} className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>
        {shown.map((p) => (
          <div key={p.id} className="space-y-2">
            <div className="text-sm text-slate-600">
              {fleet && !truck && <b className="text-slate-900">{tr('Camion {n}', { n: p.truck })} · </b>}
              {p.loaded_by ? tr('Confirmé le {d} par {name}', { d: fmtDateTime(p.created_at), name: p.loaded_by }) : tr('Confirmé le {d}', { d: fmtDateTime(p.created_at) })}
            </div>
            {p.urls.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {p.urls.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt={tr('Camion chargé')} className="w-full h-40 object-cover rounded-lg border border-slate-200 hover:opacity-90" /></a>
                ))}
              </div>
            ) : <div className="text-xs text-slate-400">{tr('Confirmé sans photo.')}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
