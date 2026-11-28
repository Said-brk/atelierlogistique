// Fiche transporteur : grille zones × tranches (src/shared/carriers/tariff.ts).
// Valeur de formulaire : { on, mode, zones: [{ code, match }], bands: [{ upTo, prices: [], flat }], min: [] } (textes saisis).

import { useState } from 'react';
import { Plus, X, ClipboardPaste, MapPin, AlertTriangle, ChevronDown } from 'lucide-react';
import { parseTariffTable, splitMatch, joinMatch, uncoveredDepts, DEPARTMENTS, REGION_GROUPS } from '../shared/carriers/tariff';
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

/** Sélection des départements d'une zone : par région ou un par un ; ceux d'une autre zone sont grisés. */
function DeptPicker({ zoneIdx, zones, onChange, onClose }) {
  const me = splitMatch(zones[zoneIdx].match);
  const owner = new Map();
  zones.forEach((z, i) => { if (i !== zoneIdx) splitMatch(z.match).depts.forEach((d) => owner.set(d, z.code)); });
  const restOwner = zones.findIndex((z, i) => i !== zoneIdx && splitMatch(z.match).rest);
  const sel = new Set(me.depts);
  const save = (patch) => onChange(joinMatch({ ...me, depts: [...sel], ...patch }));
  const toggle = (d) => { if (sel.has(d)) sel.delete(d); else sel.add(d); save({}); };
  const toggleRegion = (list) => {
    const free = list.filter((d) => !owner.has(d));
    const all = free.every((d) => sel.has(d));
    free.forEach((d) => (all ? sel.delete(d) : sel.add(d)));
    save({});
  };
  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-3xl max-h-[88vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
          <MapPin size={16} className="text-blue-700" />
          <div className="font-semibold text-slate-900 flex-1">{tr('Départements de {z}', { z: zones[zoneIdx].code })} <span className="text-slate-400 font-normal text-sm">· {sel.size}</span></div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700" aria-label={tr('Fermer')}><X size={18} /></button>
        </div>
        <div className="p-4 overflow-y-auto space-y-3">
          <label className={`flex items-center gap-2 text-sm ${restOwner >= 0 ? 'text-slate-400' : 'text-slate-800'}`}>
            <input type="checkbox" checked={me.rest} disabled={restOwner >= 0} onChange={(e) => save({ rest: e.target.checked })} />
            <b>{tr('Reste de la France')}</b>
            <span className="text-xs text-slate-500">{restOwner >= 0 ? tr('déjà dans {z}', { z: zones[restOwner].code }) : tr('tous les départements non choisis ailleurs')}</span>
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            {REGION_GROUPS.map((r) => {
              const free = r.depts.filter((d) => !owner.has(d));
              const n = free.filter((d) => sel.has(d)).length;
              return (
                <div key={r.name} className="rounded-lg border border-slate-200 p-2.5">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-1.5">
                    <input type="checkbox" checked={free.length > 0 && n === free.length} disabled={!free.length}
                      ref={(el) => { if (el) el.indeterminate = n > 0 && n < free.length; }} onChange={() => toggleRegion(r.depts)} />
                    {r.name}
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {r.depts.map((d) => {
                      const taken = owner.get(d);
                      const on = sel.has(d);
                      return (
                        <button key={d} type="button" disabled={!!taken} onClick={() => toggle(d)} title={`${d} · ${DEPARTMENTS[d] ?? ''}${taken ? ` (${taken})` : ''}`}
                          className={`font-jetbrains text-[11px] rounded px-1.5 py-1 border ${on ? 'bg-blue-600 border-blue-600 text-white' : taken ? 'bg-slate-100 border-slate-200 text-slate-300 line-through' : 'bg-white border-slate-300 text-slate-700 hover:border-blue-400'}`}>
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <label className="block text-xs text-slate-500">{tr('Codes postaux précis (facultatif)')}
            <input value={me.other.join(' ')} onChange={(e) => save({ other: e.target.value.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean) })}
              placeholder="69001-69009 13100" className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-jetbrains" />
            <span className="block mt-0.5 text-slate-400">{tr('Pour une partie de département : début de code postal ou plage. Prioritaire sur le département.')}</span>
          </label>
        </div>
        <div className="px-5 py-3 border-t border-slate-200 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-lg bg-blue-600 text-white text-sm font-semibold px-4 py-2">{tr('Valider')}</button>
        </div>
      </div>
    </div>
  );
}

/** Résumé d'une zone : pastilles (régions entières regroupées). */
function ZoneChips({ match }) {
  const p = splitMatch(match);
  const set = new Set(p.depts);
  const chips = [];
  for (const r of REGION_GROUPS) {
    if (r.depts.every((d) => set.has(d))) { chips.push(r.name); r.depts.forEach((d) => set.delete(d)); }
  }
  chips.push(...p.depts.filter((d) => set.has(d)), ...p.other);
  if (p.rest) chips.push(tr('Reste de la France'));
  if (!chips.length) return <span className="text-slate-400 text-sm">{tr('Aucun département')}</span>;
  return chips.map((c) => <span key={c} className="inline-block rounded bg-slate-100 text-slate-700 text-[11px] font-jetbrains px-1.5 py-0.5 mr-1 mb-1">{c}</span>);
}

export default function TariffEditor({ value, onChange, onFuel, billing, disabled, error }) {
  const v = value ?? EMPTY_TARIFF;
  const [picking, setPicking] = useState(null); // zone dont on choisit les départements
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
            <div className="text-xs text-slate-500">{tr('Zones')}</div>
            {v.zones.map((z, i) => (
              <div key={i} className="flex items-start gap-2">
                <input value={z.code} onChange={(e) => setZone(i, { code: e.target.value })} disabled={disabled} aria-label={tr('Nom de la zone')} className="w-24 shrink-0 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                <button type="button" disabled={disabled} onClick={() => setPicking(i)} data-zone-pick={i}
                  className="flex-1 min-w-0 text-left rounded-md border border-slate-300 px-2 pt-1.5 pb-0.5 hover:border-blue-400 disabled:bg-slate-50 flex items-start gap-1">
                  <span className="flex-1 min-w-0"><ZoneChips match={z.match} /></span>
                  {!disabled && <ChevronDown size={15} className="text-slate-400 mt-0.5 shrink-0" />}
                </button>
                {!disabled && n > 1 && <button type="button" onClick={() => delZone(i)} className="p-1 mt-1 text-slate-400 hover:text-red-700" aria-label={tr('Retirer')}><X size={15} /></button>}
              </div>
            ))}
            {!disabled && <button type="button" onClick={addZone} className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"><Plus size={14} /> {tr('Ajouter une zone')}</button>}
            {(() => {
              const miss = uncoveredDepts(v.zones);
              return miss.length > 0 && (
                <div className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5" title={miss.map((d) => `${d} ${DEPARTMENTS[d]}`).join('\n')}>
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span>{tr('{n} département(s) sans zone : {list}. Ajoutez-les ou cochez « Reste de la France » sur une zone.', { n: miss.length, list: miss.length > 8 ? `${miss.slice(0, 8).join(', ')}…` : miss.join(', ') })}</span>
                </div>
              );
            })()}
          </div>
          {picking != null && v.zones[picking] && (
            <DeptPicker zoneIdx={picking} zones={v.zones} onChange={(match) => setZone(picking, { match })} onClose={() => setPicking(null)} />
          )}

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
