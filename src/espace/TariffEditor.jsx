// Fiche transporteur : grille zones × tranches (src/shared/carriers/tariff.ts).
// Valeur de formulaire : { on, mode, zones: [{ code, match }], bands: [{ upTo, prices: [], flat }], min: [] } (textes saisis).

import { useState } from 'react';
import { Plus, X, ClipboardPaste } from 'lucide-react';
import { parseTariffTable } from '../shared/carriers/tariff';
import { t as tr } from '../shared/i18n/core';
import { currencySymbol } from '../shared/units/units';

const cell = 'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-jetbrains text-right focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50';
const txt = (v) => (v == null ? '' : String(v));

export const EMPTY_TARIFF = { on: false, mode: 'per_dest', zones: [], bands: [], min: [] };

/** Donnée enregistrée → valeur de formulaire. */
export function tariffForm(t) {
  if (!t) return EMPTY_TARIFF;
  const n = t.zones?.length ?? 0;
  const pad = (a) => Array.from({ length: n }, (_, i) => txt(a?.[i]));
  return {
    on: true, mode: t.mode === 'whole' ? 'whole' : 'per_dest',
    zones: (t.zones ?? []).map((z) => ({ code: z.code ?? '', match: z.match ?? '' })),
    bands: (t.bands ?? []).map((b) => ({ upTo: txt(b.upTo), prices: pad(b.prices), flat: !!b.flat })),
    min: pad(t.min),
  };
}

const parseNum = (s) => { const v = String(s ?? '').trim().replace(/\s/g, '').replace(',', '.'); return v === '' ? null : Number(v); };

/** Valeur de formulaire → donnée enregistrée (ou erreur). */
export function tariffData(f) {
  if (!f?.on) return { value: null };
  const zones = f.zones.map((z) => ({ code: z.code.trim(), match: z.match.trim() }));
  if (!zones.length) return { error: tr('Ajoutez au moins une zone.') };
  const codes = new Set();
  for (const z of zones) {
    if (!z.code) return { error: tr('Chaque zone : un nom (ex. Zone 1).') };
    if (codes.has(z.code.toUpperCase())) return { error: tr('Zone {z} en double', { z: z.code }) };
    codes.add(z.code.toUpperCase());
  }
  const bands = [];
  let prev = -Infinity;
  for (const [i, b] of f.bands.entries()) {
    const upTo = parseNum(b.upTo);
    const prices = b.prices.map(parseNum);
    if (upTo == null && prices.every((p) => p == null)) continue; // ligne vide
    if (upTo != null && (!Number.isFinite(upTo) || upTo <= prev)) return { error: tr('Tranche {n} : bornes croissantes attendues.', { n: i + 1 }) };
    if (upTo == null && i < f.bands.length - 1 && f.bands.slice(i + 1).some((x) => parseNum(x.upTo) != null || x.prices.some((p) => parseNum(p) != null))) {
      return { error: tr('Tranche {n} sans borne : seule la dernière peut être « au-delà ».', { n: i + 1 }) };
    }
    if (prices.some((p) => p != null && (!Number.isFinite(p) || p < 0))) return { error: tr('Tranche {n} : prix invalide.', { n: i + 1 }) };
    bands.push({ upTo, prices, ...(b.flat ? { flat: true } : {}) });
    if (upTo != null) prev = upTo;
  }
  if (!bands.length) return { error: tr('Ajoutez au moins une tranche avec ses prix.') };
  const min = f.min.map(parseNum);
  if (min.some((p) => p != null && (!Number.isFinite(p) || p < 0))) return { error: tr('Minimum invalide.') };
  return { value: { mode: f.mode, zones, bands, min } };
}

const UNIT = { weight: 'kg', pallet: 'palettes', ldm: 'MPL' };
const PRICE_UNIT = { weight: '/100 kg', pallet: '/palette', ldm: '/MPL' };

export default function TariffEditor({ value, onChange, onFuel, billing, disabled, error }) {
  const v = value ?? EMPTY_TARIFF;
  const [paste, setPaste] = useState(null);
  const [pasteErr, setPasteErr] = useState('');
  const set = (patch) => onChange({ ...v, ...patch });
  const n = v.zones.length;
  const unit = tr(UNIT[billing] ?? 'kg');

  const addZone = () => set({
    zones: [...v.zones, { code: tr('Zone {n}', { n: n + 1 }), match: '' }],
    bands: v.bands.map((b) => ({ ...b, prices: [...b.prices, ''] })), min: [...v.min, ''],
  });
  const delZone = (i) => set({
    zones: v.zones.filter((_, j) => j !== i),
    bands: v.bands.map((b) => ({ ...b, prices: b.prices.filter((_, j) => j !== i) })), min: v.min.filter((_, j) => j !== i),
  });
  const setZone = (i, p) => set({ zones: v.zones.map((z, j) => (j === i ? { ...z, ...p } : z)) });
  const setBand = (i, p) => set({ bands: v.bands.map((b, j) => (j === i ? { ...b, ...p } : b)) });
  const setPrice = (i, z, x) => setBand(i, { prices: v.bands[i].prices.map((p, j) => (j === z ? x : p)) });
  const addBand = () => set({ bands: [...v.bands, { upTo: '', prices: Array(n).fill(''), flat: false }] });

  const importPaste = () => {
    const r = parseTariffTable(paste);
    if ('error' in r) { setPasteErr(r.error); return; }
    // Zones gardées par nom (leurs départements restent), nouvelles zones vides.
    const old = new Map(v.zones.map((z) => [z.code.trim().toUpperCase(), z.match]));
    set({
      on: true,
      zones: r.zones.map((c) => ({ code: c, match: old.get(c.trim().toUpperCase()) ?? '' })),
      bands: r.bands.map((b) => ({ upTo: txt(b.upTo), prices: b.prices.map(txt), flat: !!b.flat })),
      min: r.min ? r.min.map(txt) : r.zones.map(() => ''),
    });
    if (r.fuelPct != null) onFuel?.(String(r.fuelPct));
    setPaste(null); setPasteErr('');
  };

  return (
    <div className="sm:col-span-2 rounded-xl border border-slate-200 p-3 space-y-3">
      <label className="flex items-start gap-2 text-sm text-slate-800">
        <input type="checkbox" checked={v.on} disabled={disabled} className="mt-0.5"
          onChange={(e) => onChange(e.target.checked ? { ...v, on: true, ...(n ? {} : { zones: [{ code: tr('Zone 1'), match: '' }], bands: [{ upTo: '', prices: [''], flat: false }], min: [''] }) } : { ...v, on: false })} />
        <span><b>{tr('Grille par zones et tranches')}</b>
          <span className="block text-xs text-slate-500">{tr('Messagerie, groupage : un prix par zone et par tranche ({u}), un minimum par zone. Remplace le tarif de base.', { u: unit })}</span></span>
      </label>
      {v.on && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{tr('Calcul')}</span>
            {[['per_dest', tr('Par destination (messagerie)')], ['whole', tr('Chargement entier (affrètement)')]].map(([k, l]) => (
              <button key={k} type="button" disabled={disabled} onClick={() => set({ mode: k })}
                className={`px-2.5 py-1 rounded-md border text-xs ${v.mode === k ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-slate-600'}`}>{l}</button>
            ))}
            {!disabled && (
              <button type="button" onClick={() => setPaste(paste == null ? '' : null)} className="ml-auto inline-flex items-center gap-1 text-blue-700 hover:underline">
                <ClipboardPaste size={13} /> {tr('Coller depuis Excel')}
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-400">{v.mode === 'whole'
            ? tr('Tout le chargement au tarif de la zone la plus chère de ses destinations.')
            : tr('Chaque destination facturée à part avec son poids, sa tranche et son minimum, puis additionnée.')}</p>

          {paste != null && (
            <div className="space-y-1.5">
              <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={6} className="w-full rounded-md border border-slate-300 p-2 text-xs font-jetbrains"
                placeholder={tr('Copiez le tableau (Excel, Google Sheets, PDF ou tableau Markdown) : 1re ligne = zones, puis une ligne par tranche (« 0–99 kg », « 100–299 kg »…). Lignes « Minimum » et « Surcharge gazole » reconnues.')} />
              {pasteErr && <div className="text-xs text-red-700">{pasteErr}</div>}
              <button type="button" onClick={importPaste} disabled={!paste.trim()} className="rounded-md bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-50">{tr('Remplir la grille')}</button>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="text-xs text-slate-500">{tr('Zones')} <span className="text-slate-400">· {tr('départements, codes postaux, plages (91-95), régions, ou * pour le reste')}</span></div>
            {v.zones.map((z, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={z.code} onChange={(e) => setZone(i, { code: e.target.value })} disabled={disabled} className="w-24 shrink-0 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                <input value={z.match} onChange={(e) => setZone(i, { match: e.target.value })} disabled={disabled}
                  placeholder={i === 0 ? 'Île-de-France, 28, 60' : '59 62 80, Normandie'} className="flex-1 min-w-0 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                {!disabled && n > 1 && <button type="button" onClick={() => delZone(i)} className="p-1 text-slate-400 hover:text-red-700" aria-label={tr('Retirer')}><X size={15} /></button>}
              </div>
            ))}
            {!disabled && <button type="button" onClick={addZone} className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"><Plus size={14} /> {tr('Ajouter une zone')}</button>}
          </div>

          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr className="text-slate-500">
                  <th className="text-left font-normal pr-2 pb-1 whitespace-nowrap">{tr('Jusqu’à ({u})', { u: unit })}</th>
                  {v.zones.map((z, i) => <th key={i} className="font-medium text-slate-700 px-1 pb-1 min-w-[5rem]">{z.code || '—'}</th>)}
                  <th className="font-normal px-1 pb-1" title={tr('Prix fixe pour toute la tranche (sinon prix {u})', { u: PRICE_UNIT[billing] ?? '' })}>{tr('Forfait')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {v.bands.map((b, i) => (
                  <tr key={i}>
                    <td className="pr-2 py-0.5 w-24"><input value={b.upTo} onChange={(e) => setBand(i, { upTo: e.target.value })} disabled={disabled} inputMode="decimal"
                      placeholder={i === v.bands.length - 1 ? tr('au-delà') : ''} className={cell} /></td>
                    {v.zones.map((_, z) => (
                      <td key={z} className="px-1 py-0.5"><input value={b.prices[z] ?? ''} onChange={(e) => setPrice(i, z, e.target.value)} disabled={disabled} inputMode="decimal" placeholder="—" className={cell} /></td>
                    ))}
                    <td className="px-1 py-0.5 text-center"><input type="checkbox" checked={!!b.flat} onChange={(e) => setBand(i, { flat: e.target.checked })} disabled={disabled} /></td>
                    <td>{!disabled && <button type="button" onClick={() => set({ bands: v.bands.filter((_, j) => j !== i) })} className="p-1 text-slate-400 hover:text-red-700" aria-label={tr('Retirer')}><X size={14} /></button>}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200">
                  <td className="pr-2 pt-1.5 text-slate-600 whitespace-nowrap">{tr('Minimum')} ({currencySymbol()})</td>
                  {v.zones.map((_, z) => (
                    <td key={z} className="px-1 pt-1.5"><input value={v.min[z] ?? ''} onChange={(e) => set({ min: v.min.map((p, j) => (j === z ? e.target.value : p)) })} disabled={disabled} inputMode="decimal" placeholder="—" className={cell} /></td>
                  ))}
                  <td /><td />
                </tr>
              </tbody>
            </table>
          </div>
          {!disabled && <button type="button" onClick={addBand} className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"><Plus size={14} /> {tr('Ajouter une tranche')}</button>}
          <p className="text-[11px] text-slate-400">{tr('Prix en {c}{u}, sauf tranches « Forfait ». La zone d’une destination se déduit du code postal de l’agence (Paramètres › Agences), ou de la zone indiquée sur l’agence.', { c: currencySymbol(), u: PRICE_UNIT[billing] ?? '' })}</p>
        </>
      )}
      {error && <div className="text-xs text-red-700">{error}</div>}
    </div>
  );
}
