// Tableau de saisie des colis (desktop) / cartes (mobile).
// Partagé par l'optimiseur de chargement et la palettisation 3D : même modèle de ligne
// (uiHelpers : emptyRow, validateRow, stackingOf…), même ergonomie.

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { imperial, cmToDim, dimToCm, kgToW, wToKg, dimUnit, weightUnit } from '../../../shared/units/units';
import { validateRow, refColor, ROTATION_OPTIONS, STACKING_OPTIONS, stackingOf } from '../uiHelpers';
import { t, tText } from '../../../shared/i18n/core';

export function Th({ children, className = '', title }) {
  return <th title={title} className={`font-normal text-slate-400 px-1 py-2 text-[10px] tracking-wider ${className}`}>{children}</th>;
}

/**
 * Saisie dans les unités de l'entreprise (kind : 'dim' cm ↔ in, 'weight' kg ↔ lb) ; la ligne reste en cm / kg.
 * En US, le texte tapé est gardé tel quel pendant la saisie (« 12. ») et converti à chaque frappe.
 */
function useUnitInput(value, onChange, kind) {
  const [text, setText] = useState(null);
  if (!kind || !imperial()) return { value, onChange, onBlur: undefined };
  const [toUi, fromUi] = kind === 'dim' ? [cmToDim, dimToCm] : [kgToW, wToKg];
  const shown = text ?? (value === '' || value == null ? '' : String(Math.round(toUi(Number(value)) * 100) / 100));
  return {
    value: shown,
    onChange: (v) => { setText(v); const n = parseFloat(String(v).replace(',', '.')); onChange(v === '' ? '' : Number.isFinite(n) ? fromUi(n) : v); },
    onBlur: () => setText(null),
  };
}

// Champ numérique libellé, version mobile (police 16 px : évite le zoom iOS).
export function MobileNum({ label, value: raw, onChange: change, error, step = '1', kind = null }) {
  const { value, onChange, onBlur } = useUnitInput(raw, change, kind);
  return (
    <label className="block min-w-0">
      <span className="block font-jetbrains text-[10px] text-slate-400 mb-0.5">{label}</span>
      <input type="number" inputMode="decimal" value={value} min="0" step={step}
        onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
        className="w-full px-2 py-2 bg-white border rounded-md outline-none font-jetbrains text-base text-center text-slate-800 focus:border-slate-400"
        style={{ borderColor: error ? '#FCA5A5' : '#E2E8F0' }} />
      {error && <span className="block text-[10px] text-red-500 mt-0.5 leading-tight">{error}</span>}
    </label>
  );
}

export function NumCell({ value: raw, onChange: change, error, width = 'w-14', step = '1', kind = null }) {
  const { value, onChange, onBlur } = useUnitInput(raw, change, kind);
  return (
    <div className={width}>
      <input
        type="number" value={value} min="0" step={step}
        onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
        className="w-full px-1 py-1.5 bg-white border rounded-md outline-none font-jetbrains text-xs text-center text-slate-800 focus:border-slate-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        style={{ borderColor: error ? '#FCA5A5' : '#E2E8F0' }}
      />
      {error && <div className="text-[9px] text-red-500 mt-0.5 leading-tight">{error}</div>}
    </div>
  );
}

/**
 * props : rows, updateRow(id, field, value), updateStacking(id, value), removeRow(id), addRow(),
 *         footerHint (texte à droite du bouton Ajouter)
 */
// extraSelect (facultatif) : colonne de choix propre à un outil,
//   { field, label, title, options: [{ value, label }] } — ex. « Support » en palettisation.
const AGENCY_LIST = 'al-agencies';
const norm = (v) => String(v ?? '').trim().toLowerCase();

/** Code d'agence correspondant à un texte saisi (code, description ou « code · description »), sinon le texte. */
export function resolveAgency(text, agencies) {
  const s = norm(text);
  if (!s) return '';
  const hit = agencies.find((a) => norm(a.code) === s) ?? agencies.find((a) => norm(`${a.code} · ${a.label}`) === s) ?? agencies.find((a) => norm(a.label) === s);
  return hit ? hit.code : String(text).trim();
}

/**
 * Destination d'une ligne. Espace (agences dans les tables de référence) : liste avec recherche par code ou
 * description, valeur = code de l'agence ; destination inconnue signalée en rouge. Site public : saisie libre.
 */
function DestinationField({ value, onChange, agencies, className, placeholder, mobile = false }) {
  if (!agencies?.length) return <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={className} />;
  const known = agencies.find((a) => a.code === value);
  const unknown = !!value && !known;
  return (
    <>
      <input list={AGENCY_LIST} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Agence…"
        onBlur={(e) => { const r = resolveAgency(e.target.value, agencies); if (r !== (value ?? '')) onChange(r); }}
        title={known ? `${known.code} · ${known.label}` : unknown ? 'Destination hors liste (inconnue ou hors tournée) : choisissez une agence de la liste' : 'Code ou description de l’agence'}
        className={className} style={unknown ? { borderColor: '#FCA5A5', background: '#FEF2F2' } : undefined} />
      {mobile && (known || unknown) && <span className={`block text-[10px] mt-0.5 ${unknown ? 'text-red-500' : 'text-slate-500'}`}>{known ? known.label : 'Hors liste'}</span>}
    </>
  );
}

/** Arrêt donné par le paramétrage : rang de l'agence dans sa tournée (null si agence inconnue ou hors tournée). */
export function agencyStop(code, agencies) {
  const a = agencies?.find((x) => x.code === code);
  return a?.tour && a.order > 0 ? Math.round(a.order) : null;
}

/** agencies (facultatif, espace) : [{ code, label, city, tour, order }] — liste des destinations. */
export default function ColisTable({ rows, updateRow, updateStacking, removeRow, addRow, footerHint = t('dimensions en {d} · poids en {w} · arrêt 1 = livré en premier', { d: dimUnit(), w: weightUnit() }), extraSelect = null, agencies = null }) {
  // Destination = agence d'une tournée : l'arrêt suit son rang dans la tournée (Paramètres › Tables de référence).
  const setDestination = (r, v) => {
    updateRow(r.id, 'destination', v);
    const stop = agencyStop(v, agencies);
    if (stop && stop !== (r.stop ?? 1)) updateRow(r.id, 'stop', stop);
  };
  return (
    <>
      {agencies?.length > 0 && (
        <datalist id={AGENCY_LIST}>
          {agencies.map((a) => <option key={a.code} value={a.code}>{`${a.label}${a.city ? ` · ${a.city}` : ''}`}</option>)}
        </datalist>
      )}
      {/* Mobile : une carte par référence */}
      <div className="md:hidden divide-y divide-slate-100">
        {rows.map((r, i) => {
          const err = validateRow(r);
          return (
            <div key={r.id} className="px-4 py-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: refColor(i).solid }} />
                <input value={r.reference} onChange={(e) => updateRow(r.id, 'reference', e.target.value)}
                  placeholder={t('Référence')} aria-label={t('Référence')}
                  className="flex-1 min-w-0 px-2.5 py-2 bg-white border rounded-md outline-none font-jetbrains text-base text-slate-800 focus:border-slate-400"
                  style={{ borderColor: err.reference ? '#FCA5A5' : '#E2E8F0' }} />
                <button onClick={() => removeRow(r.id)} aria-label={t('Supprimer la référence')}
                  className="w-10 h-10 shrink-0 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 bg-slate-50"><Trash2 size={15} /></button>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                <MobileNum label={t('Qté')} value={r.quantity} onChange={(v) => updateRow(r.id, 'quantity', v)} error={err.quantity} />
                <MobileNum label={`L ${dimUnit()}`} kind="dim" value={r.length} onChange={(v) => updateRow(r.id, 'length', v)} error={err.length} />
                <MobileNum label={`${t('l')} ${dimUnit()}`} kind="dim" value={r.width} onChange={(v) => updateRow(r.id, 'width', v)} error={err.width} />
                <MobileNum label={`H ${dimUnit()}`} kind="dim" value={r.height} onChange={(v) => updateRow(r.id, 'height', v)} error={err.height} />
                <MobileNum label={weightUnit()} kind="weight" value={r.weight} onChange={(v) => updateRow(r.id, 'weight', v)} error={err.weight} step="0.1" />
              </div>
              <div className="grid grid-cols-2 gap-1.5 items-end">
                <label className="block min-w-0">
                  <span className="block font-jetbrains text-[10px] text-slate-400 mb-0.5">{t('Rotation')}</span>
                  <select value={r.rotationMode} onChange={(e) => updateRow(r.id, 'rotationMode', e.target.value)}
                    className="w-full px-2 py-2 bg-white border border-slate-200 rounded-md outline-none font-jetbrains text-base text-slate-700">
                    {ROTATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{tText(o.label)}</option>)}
                  </select>
                </label>
                <label className="block min-w-0">
                  <span className="block font-jetbrains text-[10px] text-slate-400 mb-0.5">{t('Empilage')}</span>
                  <select value={stackingOf(r)} onChange={(e) => updateStacking(r.id, e.target.value)}
                    className="w-full px-2 py-2 bg-white border border-slate-200 rounded-md outline-none font-jetbrains text-base text-slate-700">
                    {STACKING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{tText(o.label)}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-[4.5rem_1fr] gap-1.5 items-end">
                <MobileNum label={t('Arrêt')} value={r.stop ?? 1} onChange={(v) => updateRow(r.id, 'stop', v)} error={err.stop} />
                <label className="block min-w-0">
                  <span className="block font-jetbrains text-[10px] text-slate-400 mb-0.5">{t('Destination (facultatif)')}</span>
                  <DestinationField value={r.destination} onChange={(v) => setDestination(r, v)} agencies={agencies} mobile
                    placeholder={t('Client, ville…')}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-md outline-none font-jetbrains text-base text-slate-800 focus:border-slate-400" />
                </label>
              </div>
              {extraSelect && (
                <label className="block min-w-0">
                  <span className="block font-jetbrains text-[10px] text-slate-400 mb-0.5">{extraSelect.label}</span>
                  <select value={r[extraSelect.field] ?? ''} onChange={(e) => updateRow(r.id, extraSelect.field, e.target.value)}
                    className="w-full px-2 py-2 bg-white border border-slate-200 rounded-md outline-none font-jetbrains text-base text-slate-700">
                    {extraSelect.options.map((o) => <option key={o.value} value={o.value}>{tText(o.label)}</option>)}
                  </select>
                </label>
              )}
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="text-center text-slate-400 py-6 text-sm px-4">{t('Aucune marchandise — ajoutez une référence ou chargez l\'exemple.')}</div>
        )}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <Th className="text-left">{t('Référence')}</Th>
              <Th>{t('Qté')}</Th><Th title={dimUnit()}>L</Th><Th title={dimUnit()}>{t('l')}</Th><Th title={dimUnit()}>H</Th><Th title={weightUnit()}>{t('Poids')}</Th>
              <Th>{t('Rotation')}</Th><Th title={t('Libre · Dessus uniquement (rien dessus) · Au sol · Au sol, rien dessus')}>{t('Empilage')}</Th>
              <Th title={t('1 = livré en premier')}>{t('Arrêt')}</Th><Th className="text-left">{t('Destination')}</Th>{extraSelect && <Th title={extraSelect.title}>{extraSelect.label}</Th>}<Th></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const err = validateRow(r);
              return (
                <tr key={r.id} className="border-b border-slate-50 align-top">
                  <td className="pl-2 pr-0.5 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0 mt-1" style={{ background: refColor(i).solid }} />
                      <div className="flex-1 min-w-[64px]">
                        <input value={r.reference} onChange={(e) => updateRow(r.id, 'reference', e.target.value)}
                          placeholder={t('Réf.')}
                          className="w-full px-2 py-1.5 bg-white border rounded-md outline-none font-jetbrains text-xs text-slate-800 focus:border-slate-400"
                          style={{ borderColor: err.reference ? '#FCA5A5' : '#E2E8F0' }} />
                        {err.reference && <div className="text-[9px] text-red-500 mt-0.5">{err.reference}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-0.5 py-1.5"><NumCell value={r.quantity} onChange={(v) => updateRow(r.id, 'quantity', v)} error={err.quantity} width="w-12" /></td>
                  <td className="px-0.5 py-1.5"><NumCell kind="dim" value={r.length} onChange={(v) => updateRow(r.id, 'length', v)} error={err.length} width="w-12" /></td>
                  <td className="px-0.5 py-1.5"><NumCell kind="dim" value={r.width} onChange={(v) => updateRow(r.id, 'width', v)} error={err.width} width="w-12" /></td>
                  <td className="px-0.5 py-1.5"><NumCell kind="dim" value={r.height} onChange={(v) => updateRow(r.id, 'height', v)} error={err.height} width="w-12" /></td>
                  <td className="px-0.5 py-1.5"><NumCell kind="weight" value={r.weight} onChange={(v) => updateRow(r.id, 'weight', v)} error={err.weight} step="0.1" width="w-12" /></td>
                  <td className="px-0.5 py-1.5">
                    <select value={r.rotationMode} onChange={(e) => updateRow(r.id, 'rotationMode', e.target.value)}
                      className="px-1.5 py-1.5 bg-white border border-slate-200 rounded-md outline-none font-jetbrains text-[11px] text-slate-700">
                      {ROTATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{tText(o.label)}</option>)}
                    </select>
                  </td>
                  <td className="px-0.5 py-1.5">
                    <select value={stackingOf(r)} onChange={(e) => updateStacking(r.id, e.target.value)}
                      title={tText(STACKING_OPTIONS.find((o) => o.value === stackingOf(r))?.hint ?? '')}
                      className="w-[7.5rem] px-1 py-1.5 bg-white border border-slate-200 rounded-md outline-none font-jetbrains text-[11px] text-slate-700">
                      {STACKING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{tText(o.label)}</option>)}
                    </select>
                  </td>
                  <td className="px-0.5 py-1.5"><NumCell value={r.stop ?? 1} onChange={(v) => updateRow(r.id, 'stop', v)} error={err.stop} width="w-10" /></td>
                  <td className="px-0.5 py-1.5">
                    <DestinationField value={r.destination} onChange={(v) => setDestination(r, v)} agencies={agencies}
                      placeholder={t('Client…')}
                      className="w-16 lg:w-32 px-2 py-1.5 bg-white border border-slate-200 rounded-md outline-none font-jetbrains text-xs text-slate-800 focus:border-slate-400" />
                  </td>
                  {extraSelect && (
                    <td className="px-0.5 py-1.5">
                      <select value={r[extraSelect.field] ?? ''} onChange={(e) => updateRow(r.id, extraSelect.field, e.target.value)}
                        className="w-24 px-1 py-1.5 bg-white border border-slate-200 rounded-md outline-none font-jetbrains text-[11px] text-slate-700">
                        {extraSelect.options.map((o) => <option key={o.value} value={o.value}>{tText(o.label)}</option>)}
                      </select>
                    </td>
                  )}
                  <td className="px-0.5 py-1.5 text-center">
                    <button onClick={() => removeRow(r.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={13} /></button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={extraSelect ? 12 : 11} className="text-center text-slate-400 py-6 text-sm">{t('Aucune marchandise — ajoutez une référence ou chargez l\'exemple.')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <button onClick={addRow} className="flex items-center justify-center gap-1.5 font-jetbrains text-xs px-3 py-2.5 sm:py-2 rounded-md" style={{ background: '#F1F5F9', color: '#475569' }}>
          <Plus size={13} />{' '}{t('Ajouter une référence')}</button>
        <span className="font-jetbrains text-[10px] text-slate-400 text-center sm:text-right">{footerHint}</span>
      </div>
    </>
  );
}
