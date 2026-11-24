// Mode « Flotte automatique » : choix des véhicules disponibles (avant calcul) et résultat (après).
// Composants autonomes : le mode standard (un véhicule choisi) ne les utilise pas.

import { Truck, Eye, AlertCircle, Check, Camera, Lock } from 'lucide-react';
import { t as tr, tText, numLocale } from '../../../shared/i18n/core';

const BLUE = '#2563EB';
const fmtEur = (n) => `${Math.round(n).toLocaleString(numLocale())} €`;
const fmtPct = (r) => `${Math.round((r ?? 0) * 100)} %`;
const dims = (c) => `${(c.length / 1000).toFixed(1)}×${(c.width / 1000).toFixed(2)}×${(c.height / 1000).toFixed(2)} m`;

/** Véhicules proposés : case à cocher + coût par voyage. props : vehicles, onChange */
export function FleetVehicles({ vehicles, onChange, note = null }) {
  const set = (id, patch) => onChange(vehicles.map((v) => (v.container.id === id ? { ...v, ...patch } : v)));
  return (
    <div className="p-4 space-y-2">
      <p className="text-[11px] text-slate-500">{tr('Cochez les véhicules dont vous disposez et leur coût par voyage : l’outil choisit la combinaison la moins chère qui charge tout, en gardant les arrêts de la tournée dans l’ordre.')}</p>
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {vehicles.map((v) => (
          <label key={v.container.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer" style={{ opacity: v.enabled ? 1 : 0.55 }}>
            <input type="checkbox" checked={v.enabled} onChange={(e) => set(v.container.id, { enabled: e.target.checked })} />
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-medium text-slate-800">{tText(v.container.label)}</span>
              <span className="block font-jetbrains text-[10px] text-slate-500">{dims(v.container)} · {Math.round(v.container.maxWeight ?? 0).toLocaleString(numLocale())} kg</span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <input type="number" min="0" step="10" value={v.cost} onChange={(e) => set(v.container.id, { cost: Math.max(0, Number(e.target.value) || 0) })}
                onClick={(e) => e.preventDefault()}
                className="w-20 px-2 py-1.5 border border-slate-200 rounded-md text-right font-jetbrains text-base sm:text-xs" aria-label={tr('Coût {label}', { label: v.container.label })} />
              <span className="font-jetbrains text-[10px] text-slate-400">€</span>
            </span>
          </label>
        ))}
      </div>
      <p className="font-jetbrains text-[10px] text-slate-400">{note ?? tr('Dimensions, charges utiles et coûts indicatifs : ajustez-les à vos tarifs. Mémorisé dans ce navigateur.')}</p>
    </div>
  );
}

/**
 * Résultat : véhicules retenus, coût, comparaisons. props : plan, viewing (index), onView(truck)
 * trucks (espace) : { [index]: { loadedAt, by, photos, onProof } } — camions confirmés chargés par le cariste.
 * locked : flotte figée (chargement envoyé au quai / chargé).
 * truckPhase : statut des camions non confirmés — 'todo' (au quai : À charger) ou 'plan' (En préparation) ; absent = pas de statut.
 */
export function FleetResult({ plan, viewing, onView, trucks = null, locked = false, truckPhase = null }) {
  const alt = plan.alternatives.filter((a) => a.cost > plan.totalCost + 0.5).slice(0, 3);
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
        <span className="font-jetbrains text-xs text-slate-600 flex items-center gap-2"><Truck size={13} />{' '}{tr('FLOTTE PROPOSÉE')}
          {locked && <span className="inline-flex items-center gap-1 text-[10px] text-violet-700"><Lock size={11} />{' '}{tr('figée')}</span>}</span>
        <span className="font-jetbrains text-[10px] text-slate-500">{tr('calcul {v1} s', { v1: Math.max(1, Math.round(plan.computationTimeMs / 100) / 10) })}</span>
      </div>
      <div className="p-4 space-y-3">
        {plan.trucks.length > 0 && (
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div><div className="font-jetbrains text-[10px] text-slate-500">{tr('VÉHICULES')}</div><div className="font-bricolage font-bold text-3xl text-slate-900">{plan.trucks.length}</div></div>
            <div><div className="font-jetbrains text-[10px] text-slate-500">{tr('COÛT TOTAL')}</div><div className="font-bricolage font-bold text-3xl" style={{ color: BLUE }}>{fmtEur(plan.totalCost)}</div></div>
            {alt.length > 0 && (
              <div className="text-[11px] text-slate-600 space-y-0.5">
                {alt.map((a) => (
                  <div key={a.vehicleId}>{tr('au lieu de')}{' '}<b>{a.count} × {tText(a.label)}</b> : {fmtEur(a.cost)} <span className="text-green-700 font-semibold">(−{fmtEur(a.cost - plan.totalCost)})</span></div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-2">
          {plan.trucks.map((t) => {
            const ld = trucks?.[t.index];
            return (
            <div key={t.index} className="rounded-lg border px-3 py-2.5" style={viewing === t.index ? { borderColor: BLUE, background: '#EFF6FF' } : { borderColor: '#E2E8F0' }}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-800 flex items-center gap-2">{t.index}. {tText(t.container.label)}
                  {ld ? <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: '#F5F3FF', color: '#6D28D9' }}>
                    <Check size={10} />{' '}{tr('Chargé')}{' '}{new Date(ld.loadedAt).toLocaleTimeString(numLocale(), { hour: '2-digit', minute: '2-digit' })}</span>
                    : truckPhase === 'todo' ? <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: '#FFFBEB', color: '#B45309' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#F59E0B' }} />{' '}{tr('À charger')}</span>
                      : truckPhase === 'plan' ? <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: '#F1F5F9', color: '#64748B' }}>{tr('En préparation')}</span> : null}
                </div>
                <div className="font-jetbrains text-[11px] text-slate-600">{fmtEur(t.cost)}</div>
              </div>
              <div className="font-jetbrains text-[10px] text-slate-500 mt-0.5">
                {t.stops.length > 1 ? tr('Arrêts {v1} à {v2}', { v1: t.stops[0], v2: t.stops[t.stops.length - 1] }) : tr('Arrêt {v1}', { v1: t.stops[0] })}{t.destinations.length ? ` · ${t.destinations.slice(0, 3).join(', ')}${t.destinations.length > 3 ? '…' : ''}` : ''}{t.split ? tr(' · arrêt partagé') : ''}
              </div>
              <div className="font-jetbrains text-[10px] text-slate-500">{tr('{units} colis · {v1} kg · volume {v2}{v3}', { units: t.units, v1: t.weight.toLocaleString(numLocale()), v2: fmtPct(t.volumeUtilization), v3: t.weightUtilization != null ? tr(' · poids {v1}', { v1: fmtPct(t.weightUtilization) }) : '' })}</div>
              <button onClick={() => onView(t)} className="mt-2 inline-flex items-center gap-1.5 font-jetbrains text-[11px] px-2.5 py-1.5 rounded-md"
                style={viewing === t.index ? { background: BLUE, color: '#fff' } : { background: '#F1F5F9', color: '#475569' }}>
                {viewing === t.index ? <><Check size={11} />{' '}{tr('Plan affiché')}</> : <><Eye size={11} />{' '}{tr('Voir le plan 3D')}</>}
              </button>
              {ld?.onProof && (
                <button onClick={ld.onProof} title={tr('Preuve de chargement')} className="ml-3 inline-flex items-center gap-1 font-jetbrains text-[10px] text-slate-400 hover:text-violet-700">
                  <Camera size={11} />{' '}{tr('Preuve')}{ld.photos > 1 ? ` (${ld.photos})` : ''}</button>
              )}
            </div>
            );
          })}
        </div>
        {plan.unplaced.length > 0 && (
          <div className="flex items-start gap-2 text-[11px] px-3 py-2 rounded-md" style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            <div>{plan.unplaced.map((u) => <div key={u.definitionId}>{u.reference} ×{u.quantity} : {tText(u.reason)}</div>)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
