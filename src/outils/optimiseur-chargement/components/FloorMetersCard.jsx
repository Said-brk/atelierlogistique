// Mètres plancher (MPL) et poids taxable du chargement affiché (camion seul ou camion de la flotte).
// Facteurs de conversion modifiables (ceux du transporteur), mémorisés par l'écran qui les fournit.

import { Ruler, Scale, RotateCcw } from 'lucide-react';
import { t as tr, numLocale } from '../../../shared/i18n/core';
import { floorMeters, taxableWeight, DEFAULT_TAXABLE } from '../engine/floorMeters';

const n1 = (v) => v.toLocaleString(numLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const kg = (v) => `${Math.round(v).toLocaleString(numLocale())} kg`;

function FactorInput({ label, value, onChange }) {
  return (
    <label className="flex items-center gap-1.5 font-jetbrains text-[10px] text-slate-500">
      {label}
      <input type="number" min="1" step="10" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-16 px-1.5 py-1 border border-slate-200 rounded text-[11px] text-slate-800 bg-white" />
    </label>
  );
}

/** props : placed (PlacedItem[]), container, weightKg, volumeM3, factors, onFactorsChange */
export default function FloorMetersCard({ placed, container, weightKg, volumeM3, factors, onFactorsChange }) {
  const f = floorMeters(placed, container);
  const tw = taxableWeight({ weightKg, volumeM3, ldm: f.ldm }, factors);
  const occRatio = f.containerLength > 0 ? Math.min(1, f.occupiedLength / f.containerLength) : 0;
  const rows = [
    ['real', tr('Poids réel'), tw.real, ''],
    ['volume', tr('Poids volumique'), tw.volumetric, tr('{v1} m³ × {v2} kg', { v1: n1(volumeM3), v2: factors.kgPerM3 })],
    ['floor', tr('Poids plancher'), tw.floor, tr('{v1} MPL × {v2} kg', { v1: n1(f.ldm), v2: factors.kgPerLdm })],
  ];
  const custom = factors.kgPerM3 !== DEFAULT_TAXABLE.kgPerM3 || factors.kgPerLdm !== DEFAULT_TAXABLE.kgPerLdm;

  return (
    <div className="rounded-xl border border-slate-200 p-4 bg-white space-y-4">
      <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider flex items-center gap-1.5"><Ruler size={12} /> {tr('MÈTRES PLANCHER & POIDS TAXABLE')}</div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="font-jetbrains text-[10px] text-slate-500">{tr('Mètres plancher')}</div>
          <div className="font-bricolage font-bold text-xl text-slate-900">{n1(f.ldm)} <span className="text-sm font-semibold text-slate-500">MPL</span></div>
          <div className="font-jetbrains text-[10px] text-slate-500 mt-0.5">
            {tr('surface au sol ÷ 2,4 m')}{f.stackedItems > 0 ? tr(' · {n} colis gerbé(s) non comptés', { n: f.stackedItems }) : ''}
          </div>
        </div>
        <div>
          <div className="font-jetbrains text-[10px] text-slate-500">{tr('Plancher occupé')}</div>
          <div className="font-bricolage font-bold text-xl text-slate-900">{n1(f.occupiedLength)} <span className="text-sm font-semibold text-slate-500">/ {n1(f.containerLength)} m</span></div>
          <div className="mt-1.5 h-1.5 rounded bg-slate-100 overflow-hidden"><div className="h-full rounded" style={{ width: `${occRatio * 100}%`, background: '#2563EB' }} /></div>
          <div className="font-jetbrains text-[10px] text-slate-500 mt-0.5">{tr('longueur à réserver pour un lot partiel')}</div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-100 overflow-hidden">
        {rows.map(([key, label, value, how]) => {
          const win = tw.basis === key;
          return (
            <div key={key} className={`flex items-baseline justify-between gap-2 px-3 py-2 text-[12px] ${win ? 'bg-blue-50' : ''} border-b border-slate-100 last:border-b-0`}>
              <span className={win ? 'font-semibold text-blue-800' : 'text-slate-600'}>{label}{how && <span className="font-jetbrains text-[10px] text-slate-400"> · {how}</span>}</span>
              <span className={`font-jetbrains ${win ? 'font-bold text-blue-800' : 'text-slate-700'}`}>{kg(value)}{win ? ` ← ${tr('facturé')}` : ''}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-start gap-1.5 text-[11px] text-slate-600">
        <Scale size={13} className="mt-0.5 shrink-0 text-slate-400" />
        <span>
          {tr('Poids taxable : {v1} — le plus élevé des trois, base de la facturation en groupage ou lot partiel.', { v1: kg(tw.taxable) })}
          {tw.basis === 'floor' && f.stackedItems === 0 && placed.length > 1 ? ` ${tr('Rendre des colis gerbables réduirait les mètres plancher facturés.')}` : ''}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-100">
        <span className="font-jetbrains text-[10px] text-slate-500">{tr('Facteurs du transporteur :')}</span>
        <FactorInput label={tr('kg / m³')} value={factors.kgPerM3} onChange={(v) => onFactorsChange({ ...factors, kgPerM3: v })} />
        <FactorInput label={tr('kg / MPL')} value={factors.kgPerLdm} onChange={(v) => onFactorsChange({ ...factors, kgPerLdm: v })} />
        {custom && (
          <button type="button" onClick={() => onFactorsChange({ ...DEFAULT_TAXABLE })} className="inline-flex items-center gap-1 font-jetbrains text-[10px] text-slate-500 hover:text-slate-800">
            <RotateCcw size={11} /> {tr('330 / 1 750 par défaut')}
          </button>
        )}
      </div>
    </div>
  );
}
