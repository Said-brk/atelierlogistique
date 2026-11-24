// Fin de chargement (lien quai de l'espace) : le cariste prend une ou plusieurs photos du camion chargé,
// indique son nom s'il le souhaite et confirme. Les photos sont réduites sur le téléphone avant l'envoi.
// onConfirm({ files, name }) est fourni par la page (envoi au stockage + confirmation dans la base).

import { useState } from 'react';
import { Camera, Check, Loader2, X } from 'lucide-react';
import { t } from '../../../shared/i18n/core';

const MAX_PHOTOS = 4;

/** Réduit une photo (1 600 px, JPEG 80 %) : envoi rapide en 4G, ~300 Ko. */
export async function shrinkPhoto(file, max = 1600) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b ?? file), 'image/jpeg', 0.8));
}

export default function ConfirmLoading({ onConfirm, confirmedAt = null }) {
  const [photos, setPhotos] = useState([]); // { file, url }
  const [name, setName] = useState(() => { try { return localStorage.getItem('al.cariste.nom') ?? ''; } catch { return ''; } });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(confirmedAt);

  const add = (list) => setPhotos((p) => [...p, ...[...list].map((f) => ({ file: f, url: URL.createObjectURL(f) }))].slice(0, MAX_PHOTOS));
  const submit = async () => {
    setBusy(true); setError('');
    try {
      try { localStorage.setItem('al.cariste.nom', name.trim()); } catch { /* indisponible */ }
      setDone(await onConfirm({ files: photos.map((p) => p.file), name: name.trim() }));
    } catch (e) { setError(e.message || t('Envoi impossible. Vérifiez la connexion et réessayez.')); }
    setBusy(false);
  };

  if (done) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800 flex items-center gap-2">
        <Check size={18} /> {t('Chargement confirmé au bureau')} · {new Date(done).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-600">{t('Prenez une photo du camion chargé, portes ouvertes : elle sert de preuve de chargement au bureau.')}</div>
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((p, i) => (
            <div key={p.url} className="relative">
              <img src={p.url} alt={t('Camion chargé')} className="w-full h-32 object-cover rounded-lg border border-slate-200" />
              <button onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} aria-label={t('Retirer')} className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      {photos.length < MAX_PHOTOS && (
        <label className="flex items-center justify-center gap-2 py-3 rounded-lg font-semibold border-2 border-dashed border-slate-300 text-slate-700 cursor-pointer">
          <Camera size={18} /> {photos.length ? t('Ajouter une photo') : t('Prendre une photo')}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { if (e.target.files?.length) add(e.target.files); e.target.value = ''; }} />
        </label>
      )}
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={t('Votre nom (facultatif)')}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
      <button onClick={submit} disabled={busy || photos.length === 0}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-white font-bold text-lg disabled:opacity-50" style={{ background: '#10B981' }}>
        {busy ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />} {t('Confirmer : camion chargé')}
      </button>
      {photos.length === 0 && <button onClick={submit} disabled={busy} className="w-full text-xs text-slate-400 underline">{t('Confirmer sans photo')}</button>}
      {error && <div className="text-sm text-red-700">{error}</div>}
    </div>
  );
}
