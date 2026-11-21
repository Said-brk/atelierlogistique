// « Mes supports » : l'utilisateur coche les palettes dont il dispose et ajuste leurs caractéristiques.
// Le moteur choisit ensuite automatiquement parmi les supports cochés.

import { Plus, Trash2, Package } from 'lucide-react';
import { newCustomSupport } from './supportsStore';
import { t, tText, N_ } from '../../shared/i18n/core';

const BLUE = '#2563EB';
const cm = (mm) => Math.round(mm) / 10;

function Num({ value, onChange, step = '1', label, className = 'w-16' }) {
  return (
    <input type="number" inputMode="decimal" min="0" step={step} value={value} aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className={`${className} px-1.5 py-1.5 bg-white border border-slate-200 rounded-md outline-none font-jetbrains text-base sm:text-xs text-center text-slate-800 focus:border-slate-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`} />
  );
}

const FIELDS = [
  { key: 'length', label: 'L', unit: 'cm', mm: true },
  { key: 'width', label: 'l', unit: 'cm', mm: true },
  { key: 'deckHeight', label: N_('Plateau'), unit: 'cm', mm: true, step: '0.1' },
  { key: 'tare', label: N_('Tare'), unit: 'kg' },
  { key: 'maxTotalHeight', label: N_('H maxi'), unit: 'cm', mm: true },
  { key: 'maxLoad', label: N_('Charge'), unit: 'kg' },
  { key: 'cost', label: N_('Coût'), unit: '€', step: '0.5' },
];

/** props : supports (SupportItem[]), onChange(nextSupports) */
export default function SupportsPanel({ supports, onChange }) {
  const set = (id, patch) => onChange(supports.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const setField = (id, f, v) => {
    const n = Math.max(0, Number(v) || 0);
    set(id, { [f.key]: f.mm ? Math.round(n * 10) : n });
  };
  const value = (s, f) => (s[f.key] === undefined ? '' : f.mm ? cm(s[f.key]) : s[f.key]);
  const add = () => onChange([...supports, newCustomSupport(supports.filter((s) => s.custom).length + 1)]);
  const remove = (id) => onChange(supports.filter((s) => s.id !== id));
  const count = supports.filter((s) => s.available).length;

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
        <div className="font-jetbrains text-xs text-slate-600 flex items-center gap-2"><Package size={13} />{' '}{t('2 · MES SUPPORTS')}</div>
        <div className="font-jetbrains text-[10px] text-slate-500">{t('{count} disponible(s) · choix automatique', { count: count })}</div>
      </div>

      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-normal">
              <th className="font-normal text-left pl-4 py-2">{t('Dispo · support')}</th>
              {FIELDS.map((f) => <th key={f.key} className="font-normal px-1 py-2">{tText(f.label)} <span className="text-slate-300">{f.unit}</span></th>)}
              <th />
            </tr>
          </thead>
          <tbody>
            {supports.map((s) => (
              <tr key={s.id} className="border-b border-slate-50" style={{ opacity: s.available ? 1 : 0.55 }}>
                <td className="pl-4 pr-2 py-1.5">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={s.available} onChange={(e) => set(s.id, { available: e.target.checked })} />
                    {s.custom
                      ? <input value={s.label} onChange={(e) => set(s.id, { label: e.target.value })} className="w-40 px-2 py-1 border border-slate-200 rounded-md text-xs" />
                      : <span className="text-xs text-slate-800">{tText(s.label)}</span>}
                  </label>
                </td>
                {FIELDS.map((f) => (
                  <td key={f.key} className="px-0.5 py-1.5 text-center">
                    <Num value={value(s, f)} step={f.step} label={`${tText(f.label)} ${tText(s.label)}`} onChange={(v) => setField(s.id, f, v)} className="w-14" />
                  </td>
                ))}
                <td className="px-2 text-center">
                  {s.custom && <button onClick={() => remove(s.id)} aria-label={t('Supprimer le support')} className="text-slate-300 hover:text-red-500"><Trash2 size={13} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-slate-100">
        {supports.map((s) => (
          <div key={s.id} className="px-4 py-3 space-y-2" style={{ opacity: s.available ? 1 : 0.6 }}>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={s.available} onChange={(e) => set(s.id, { available: e.target.checked })} />
              {s.custom
                ? <input value={s.label} onChange={(e) => set(s.id, { label: e.target.value })} className="flex-1 px-2 py-1.5 border border-slate-200 rounded-md text-base" />
                : <span className="text-sm text-slate-800">{tText(s.label)}</span>}
              {s.custom && <button onClick={() => remove(s.id)} aria-label={t('Supprimer le support')} className="ml-auto text-slate-400"><Trash2 size={15} /></button>}
            </label>
            {s.available && (
              <div className="grid grid-cols-4 gap-1.5">
                {FIELDS.map((f) => (
                  <label key={f.key} className="block">
                    <span className="block font-jetbrains text-[10px] text-slate-400">{tText(f.label)} {f.unit}</span>
                    <Num value={value(s, f)} step={f.step} label={`${tText(f.label)} ${tText(s.label)}`} onChange={(v) => setField(s.id, f, v)} className="w-full" />
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <button onClick={add} className="flex items-center justify-center gap-1.5 font-jetbrains text-xs px-3 py-2 rounded-md" style={{ background: '#F1F5F9', color: '#475569' }}>
          <Plus size={13} />{' '}{t('Support personnalisé')}</button>
        <span className="font-jetbrains text-[10px] text-slate-400 sm:text-right">{t('Choix : moins de palettes, puis moins de place au sol, puis coût. Mémorisé dans ce navigateur.')}{count === 0 && <span style={{ color: BLUE }}>{' '}{t('Cochez au moins un support.')}</span>}
        </span>
      </div>
    </div>
  );
}
