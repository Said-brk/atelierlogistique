// Paramètres › Tables de référence : véhicules / contenants, supports de palettisation, agences, tournées,
// réglages (arrimage, regroupement).
// Une table = un schéma de champs (REF_TABLES) rendu par les mêmes composants : liste à colonnes
// redimensionnables, fiche d'édition, ajout, suppression, retour aux valeurs par défaut.
// Lecture pour tous les membres, modification par les administrateurs (règles de la base).

import { useMemo, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Truck, Package, Link2, Plus, Pencil, Trash2, RotateCcw, Loader2, X, Save, Check, MapPin, Route as RouteIcon, Combine } from 'lucide-react';
import { useEspace } from '../useEspace';
import useReferences from '../useReferences';
import { saveReference, deleteReference, resetReferences } from '../data';
import { Btn } from '../ui';
import ResizableTable from '../ResizableTable';
import { defaultReferences } from '../../shared/references/defaults';

const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50';
const fmt = (v, d = 0) => (v == null || v === '' ? '—' : Number(v).toLocaleString('fr-FR', { maximumFractionDigits: d }));
const m = (mm) => fmt(mm / 1000, 2);

// ---------------------------------------------------------------- Schémas des tables
// Champ : key (« code », « label », « active », « sort » = colonnes ; sinon dans data, « a.b » = sous-objet),
// type : text | cm (saisi en cm, stocké en mm) | num | bool | select (options : liste ou fonction des lignes) ;
// optional : vide autorisé (null).

const VEHICLE_FIELDS = [
  { key: 'code', label: 'Code', type: 'text', hint: 'Identifiant utilisé par l’API (ex. semi, VUL12).' },
  { key: 'label', label: 'Libellé', type: 'text', wide: true },
  { key: 'length', label: 'Longueur intérieure', type: 'cm', unit: 'cm' },
  { key: 'width', label: 'Largeur intérieure', type: 'cm', unit: 'cm' },
  { key: 'height', label: 'Hauteur intérieure', type: 'cm', unit: 'cm' },
  { key: 'maxWeight', label: 'Charge utile', type: 'num', unit: 'kg', optional: true, hint: 'Vide = non contrôlée.' },
  { key: 'cost', label: 'Coût par voyage', type: 'num', unit: '€', step: 10, hint: 'Sert au choix de la flotte la moins chère.' },
  { key: 'sort', label: 'Ordre d’affichage', type: 'num' },
  { key: 'active', label: 'Disponible (proposé dans les chargements)', type: 'bool' },
  { key: 'inFleet', label: 'Coché par défaut en « Flotte automatique »', type: 'bool' },
  { key: 'axleMode', label: 'Répartition des charges', type: 'select', wide: true, options: [['container', 'Conteneur : contrôle du centre de gravité (±5 %)'], ['axles', 'Deux appuis : essieux ou sellette + essieux']] },
  { key: 'axle.frontLabel', label: 'Appui avant', type: 'text', if: (v) => v.axleMode === 'axles' },
  { key: 'axle.rearLabel', label: 'Appui arrière', type: 'text', if: (v) => v.axleMode === 'axles' },
  { key: 'axle.frontPos', label: 'Position appui avant', type: 'cm', unit: 'cm', signed: true, hint: 'Depuis la face avant de la caisse ; négatif = devant la caisse.', if: (v) => v.axleMode === 'axles' },
  { key: 'axle.rearPos', label: 'Position appui arrière', type: 'cm', unit: 'cm', hint: 'Centre du groupe d’essieux.', if: (v) => v.axleMode === 'axles' },
  { key: 'axle.frontMax', label: 'Charge utile maxi avant', type: 'num', unit: 'kg', if: (v) => v.axleMode === 'axles' },
  { key: 'axle.rearMax', label: 'Charge utile maxi arrière', type: 'num', unit: 'kg', if: (v) => v.axleMode === 'axles' },
];

const PALLET_FIELDS = [
  { key: 'code', label: 'Code', type: 'text', hint: 'Identifiant utilisé à l’import (ex. eur, eur3).' },
  { key: 'label', label: 'Libellé', type: 'text', wide: true },
  { key: 'length', label: 'Longueur', type: 'cm', unit: 'cm' },
  { key: 'width', label: 'Largeur', type: 'cm', unit: 'cm' },
  { key: 'deckHeight', label: 'Hauteur du plateau', type: 'cm', unit: 'cm', step: 0.1 },
  { key: 'tare', label: 'Tare', type: 'num', unit: 'kg', step: 0.5 },
  { key: 'maxTotalHeight', label: 'Hauteur totale maxi', type: 'cm', unit: 'cm', hint: 'Support compris.' },
  { key: 'maxLoad', label: 'Charge maxi', type: 'num', unit: 'kg', hint: 'Hors tare.' },
  { key: 'cost', label: 'Coût unitaire', type: 'num', unit: '€', step: 0.5, optional: true, hint: 'Départage deux supports équivalents.' },
  { key: 'sort', label: 'Ordre d’affichage', type: 'num' },
  { key: 'active', label: 'Coché par défaut (le moteur peut le choisir)', type: 'bool' },
];

const toggle = (on, onClick, disabled, title) => (
  <button type="button" title={title} disabled={disabled} onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`w-5 h-5 rounded border inline-flex items-center justify-center ${on ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'} disabled:opacity-60`}>
    {on && <Check size={13} />}
  </button>
);

const VEHICLE_COLUMNS = (admin, patch) => [
  { key: 'code', h: 'Code', cell: (i) => <span className="font-jetbrains text-xs text-blue-700">{i.code}</span> },
  { key: 'label', h: 'Libellé', min: 120, cell: (i) => <span className="font-medium text-slate-900">{i.label}</span> },
  { key: 'dims', h: 'L × l × H (m)', cell: (i) => <span className="font-jetbrains text-xs whitespace-nowrap">{m(i.data.length)} × {m(i.data.width)} × {m(i.data.height)}</span> },
  { key: 'load', h: 'Charge utile', cell: (i) => (i.data.maxWeight == null ? '—' : `${fmt(i.data.maxWeight)} kg`) },
  { key: 'cost', h: 'Coût / voyage', cell: (i) => `${fmt(i.data.cost)} €` },
  { key: 'axle', h: 'Répartition', cell: (i) => <span className="text-xs">{i.data.axle ? `${i.data.axle.frontLabel} / ${i.data.axle.rearLabel}` : 'Conteneur'}</span> },
  { key: 'fleet', h: 'Flotte', cell: (i) => toggle(i.data.inFleet, () => patch(i, { data: { ...i.data, inFleet: !i.data.inFleet } }), !admin, 'Coché par défaut en flotte automatique') },
  { key: 'active', h: 'Disponible', cell: (i) => toggle(i.active, () => patch(i, { active: !i.active }), !admin, 'Proposé dans les chargements') },
];

const PALLET_COLUMNS = (admin, patch) => [
  { key: 'code', h: 'Code', cell: (i) => <span className="font-jetbrains text-xs text-blue-700">{i.code}</span> },
  { key: 'label', h: 'Libellé', min: 120, cell: (i) => <span className="font-medium text-slate-900">{i.label}</span> },
  { key: 'dims', h: 'L × l (cm)', cell: (i) => <span className="font-jetbrains text-xs">{fmt(i.data.length / 10, 1)} × {fmt(i.data.width / 10, 1)}</span> },
  { key: 'deck', h: 'Plateau', cell: (i) => `${fmt(i.data.deckHeight / 10, 1)} cm` },
  { key: 'tare', h: 'Tare', cell: (i) => `${fmt(i.data.tare, 1)} kg` },
  { key: 'hmax', h: 'H maxi', cell: (i) => `${fmt(i.data.maxTotalHeight / 10, 1)} cm` },
  { key: 'load', h: 'Charge maxi', cell: (i) => `${fmt(i.data.maxLoad)} kg` },
  { key: 'cost', h: 'Coût', cell: (i) => (i.data.cost == null ? '—' : `${fmt(i.data.cost, 2)} €`) },
  { key: 'active', h: 'Coché', cell: (i) => toggle(i.active, () => patch(i, { active: !i.active }), !admin, 'Coché par défaut') },
];

const AGENCY_FIELDS = [
  { key: 'code', label: 'Code agence / ville', type: 'text', hint: 'Valeur choisie dans la colonne Destination des lignes (ex. LYO01).' },
  { key: 'label', label: 'Description', type: 'text', wide: true },
  { key: 'city', label: 'Ville', type: 'text', optional: true },
  { key: 'tour', label: 'Tournée', type: 'select', optional: true, options: (items) => [['', '— aucune'], ...items.filter((i) => i.kind === 'tour').map((t) => [t.code, `${t.code} · ${t.label}`])] },
  { key: 'order', label: 'Rang dans la tournée', type: 'num', hint: '1 = livrée en premier.' },
  { key: 'sort', label: 'Ordre d’affichage', type: 'num' },
  { key: 'active', label: 'Proposée dans les listes de destinations', type: 'bool' },
];

const TOUR_FIELDS = [
  { key: 'code', label: 'Code', type: 'text', hint: 'Ex. T-NORD, 69-01.' },
  { key: 'label', label: 'Nom de la tournée', type: 'text', wide: true },
  { key: 'sort', label: 'Ordre d’affichage', type: 'num' },
  { key: 'active', label: 'Active', type: 'bool' },
];

const agenciesOf = (items, tour) => items.filter((i) => i.kind === 'agency' && i.data?.tour === tour).sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));

const AGENCY_COLUMNS = (admin, patch, items) => [
  { key: 'code', h: 'Code', cell: (i) => <span className="font-jetbrains text-xs text-blue-700">{i.code}</span> },
  { key: 'label', h: 'Description', min: 120, cell: (i) => <span className="font-medium text-slate-900">{i.label}</span> },
  { key: 'city', h: 'Ville', cell: (i) => i.data.city || '—' },
  { key: 'tour', h: 'Tournée', cell: (i) => { const t = items.find((x) => x.kind === 'tour' && x.code === i.data.tour); return t ? <span className="text-xs">{t.code} · {t.label}</span> : <span className="text-xs text-slate-400">—</span>; } },
  { key: 'order', h: 'Rang', cell: (i) => (i.data.tour ? i.data.order ?? '—' : '—') },
  { key: 'active', h: 'Proposée', cell: (i) => toggle(i.active, () => patch(i, { active: !i.active }), !admin, 'Proposée dans les listes') },
];

const TOUR_COLUMNS = (admin, patch, items) => [
  { key: 'code', h: 'Code', cell: (i) => <span className="font-jetbrains text-xs text-blue-700">{i.code}</span> },
  { key: 'label', h: 'Tournée', min: 120, cell: (i) => <span className="font-medium text-slate-900">{i.label}</span> },
  { key: 'stops', h: 'Agences, dans l’ordre de livraison', min: 160, cell: (i) => { const a = agenciesOf(items, i.code); return a.length ? <span className="text-xs">{a.map((x) => x.code).join(' → ')}</span> : <span className="text-xs text-slate-400">aucune : rattachez des agences (onglet Agences)</span>; } },
  { key: 'n', h: 'Agences', cell: (i) => agenciesOf(items, i.code).length },
  { key: 'active', h: 'Active', cell: (i) => toggle(i.active, () => patch(i, { active: !i.active }), !admin, 'Active') },
];

const TABLES = {
  vehicle: {
    title: 'Véhicules et contenants', icon: Truck, fields: VEHICLE_FIELDS, columns: VEHICLE_COLUMNS, noun: 'véhicule',
    intro: 'Proposés dans « Un véhicule » et la « Flotte automatique » des chargements, et reconnus par l’API (champ vehicle / fleet). Dimensions intérieures.',
    blank: () => ({ kind: 'vehicle', code: '', label: '', active: true, sort: 100, data: { length: 13600, width: 2450, height: 2700, maxWeight: 24000, cost: 500, inFleet: false, axle: null } }),
  },
  pallet: {
    title: 'Supports de palettisation', icon: Package, fields: PALLET_FIELDS, columns: PALLET_COLUMNS, noun: 'support',
    intro: 'Proposés dans « Mes supports » des palettisations ; le moteur choisit parmi les supports cochés.',
    blank: () => ({ kind: 'pallet', code: '', label: '', active: true, sort: 100, data: { length: 1200, width: 800, deckHeight: 144, tare: 25, maxTotalHeight: 1800, maxLoad: 1000 } }),
  },
  agency: {
    title: 'Agences et destinations', icon: MapPin, fields: AGENCY_FIELDS, columns: AGENCY_COLUMNS, noun: 'destination', feminine: true, noReset: true,
    intro: 'Les destinations de vos chargements et palettisations : choisies dans une liste (code ou description) au lieu d’une saisie libre. Une agence appartient au plus à une tournée.',
    blank: () => ({ kind: 'agency', code: '', label: '', active: true, sort: 100, data: { city: '', tour: null, order: 1 } }),
  },
  tour: {
    title: 'Tournées', icon: RouteIcon, fields: TOUR_FIELDS, columns: TOUR_COLUMNS, noun: 'tournée', feminine: true, noReset: true,
    intro: 'Vos tournées habituelles. Elles servent au regroupement des chargements (mode « par tournée ») et à l’ordre des arrêts ; la saisie reste libre ailleurs.',
    blank: () => ({ kind: 'tour', code: '', label: '', active: true, sort: 100, data: {} }),
  },
};

// ---------------------------------------------------------------- Lecture / écriture d'un champ
const AXLE_DEFAULT = { kind: 'TWO_SUPPORTS', frontLabel: 'Essieu avant', rearLabel: 'Essieu arrière', frontPos: -1200, rearPos: 4500, frontMax: 3000, rearMax: 7000 };
const TOP = ['code', 'label', 'active', 'sort'];

/** Valeurs de la fiche (texte saisi) à partir d'une ligne. */
function formOf(item, fields) {
  const v = { axleMode: item.data?.axle ? 'axles' : 'container' };
  const axle = item.data?.axle ?? AXLE_DEFAULT;
  for (const f of fields) {
    if (f.key === 'axleMode') continue;
    const raw = TOP.includes(f.key) ? item[f.key] : f.key.startsWith('axle.') ? axle[f.key.slice(5)] : item.data?.[f.key];
    v[f.key] = f.type === 'bool' ? !!raw : raw == null ? '' : f.type === 'cm' ? String(Math.round(raw) / 10) : String(raw);
  }
  return v;
}

/** Ligne à enregistrer à partir de la fiche ; erreurs par champ. */
function itemOf(base, form, fields) {
  const errors = {};
  const out = { ...base, data: { ...base.data } };
  const axle = { kind: 'TWO_SUPPORTS' };
  for (const f of fields) {
    if (f.key === 'axleMode' || (f.if && !f.if(form))) continue;
    let val = form[f.key];
    if (f.type === 'select') val = val === '' ? null : val;
    if (f.type === 'text') {
      val = String(val ?? '').trim();
      if (!val && !f.optional) errors[f.key] = 'Obligatoire';
      else if (f.key === 'code' && !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$/.test(val)) errors[f.key] = 'Lettres, chiffres, - _ . (40 max.)';
    } else if (f.type === 'cm' || f.type === 'num') {
      const s = String(val ?? '').trim().replace(',', '.');
      if (s === '') { if (f.optional) val = null; else errors[f.key] = 'Obligatoire'; }
      else {
        const n = Number(s);
        if (!Number.isFinite(n) || (!f.signed && n < 0)) errors[f.key] = 'Nombre invalide';
        else val = f.type === 'cm' ? Math.round(n * 10) : n;
      }
    }
    if (TOP.includes(f.key)) out[f.key] = val;
    else if (f.key.startsWith('axle.')) axle[f.key.slice(5)] = val;
    else out.data[f.key] = val;
  }
  if (out.kind === 'vehicle') out.data.axle = form.axleMode === 'axles' ? axle : null;
  if (out.kind === 'vehicle' && !(out.data.length > 0 && out.data.width > 0 && out.data.height > 0)) errors.length = errors.length ?? 'Dimensions > 0';
  if (out.kind === 'pallet' && !(out.data.length > 0 && out.data.width > 0)) errors.length = errors.length ?? 'Dimensions > 0';
  return { item: out, errors };
}

function Field({ f, value, onChange, error, disabled, items = [] }) {
  const options = typeof f.options === 'function' ? f.options(items) : f.options;
  if (f.type === 'bool') {
    return (
      <label className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} disabled={disabled} /> {f.label}
      </label>
    );
  }
  return (
    <label className={`block text-xs text-slate-500 ${f.wide ? 'sm:col-span-2' : ''}`}>
      {f.label}{f.unit && <span className="text-slate-400"> ({f.unit})</span>}
      {f.type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`mt-1 ${inputCls}`}>
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} inputMode={f.type === 'text' ? undefined : 'decimal'}
          className={`mt-1 ${inputCls} ${f.type === 'text' ? '' : 'font-jetbrains'} ${error ? 'border-red-400' : ''}`} />
      )}
      {error ? <span className="block mt-0.5 text-red-700">{error}</span> : f.hint && <span className="block mt-0.5 text-slate-400">{f.hint}</span>}
    </label>
  );
}

function EditDialog({ table, item, admin, onClose, onSaved, items }) {
  const { org } = useEspace();
  const [form, setForm] = useState(() => formOf(item, table.fields));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const { item: next, errors: errs } = itemOf(item, form, table.fields);
    setErrors(errs); setMsg('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    try { await saveReference(org.id, next); onSaved(); } catch (err) { setMsg(err.message); setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <table.icon size={18} className="text-blue-700" />
          <div className="font-semibold text-slate-900 flex-1">{item.id ? `${item.label}` : `${table.feminine ? 'Nouvelle' : 'Nouveau'} ${table.noun}`}</div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="p-5 grid sm:grid-cols-2 gap-x-4 gap-y-3">
          {table.fields.filter((f) => !f.if || f.if(form)).map((f) => (
            <Field key={f.key} f={f} value={form[f.key]} error={errors[f.key]} disabled={!admin} items={items}
              onChange={(v) => setForm((x) => ({ ...x, [f.key]: v }))} />
          ))}
        </div>
        <div className="sticky bottom-0 bg-white px-5 py-3 border-t border-slate-200 flex items-center gap-2">
          {msg && <span className="text-sm text-red-700 flex-1">{msg}</span>}
          <span className="flex-1" />
          <Btn type="button" variant="ghost" onClick={onClose}>{admin ? 'Annuler' : 'Fermer'}</Btn>
          {admin && <Btn type="submit" disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer</Btn>}
        </div>
      </form>
    </div>
  );
}

function RefTable({ kind }) {
  const table = TABLES[kind];
  const { org } = useEspace();
  const admin = org.role === 'owner' || org.role === 'admin';
  const { items, reload } = useReferences();
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const rows = useMemo(() => (items ?? []).filter((i) => i.kind === kind).sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label)), [items, kind]);
  const run = async (fn) => { setError(''); try { await fn(); reload(); } catch (e) { setError(e.message); } };
  const patch = (i, p) => run(() => saveReference(org.id, { ...i, ...p }));
  const columns = [
    ...table.columns(admin, patch, items ?? []),
    { key: 'actions', h: '', tdClass: 'text-right whitespace-nowrap', cell: (i) => admin && (
      <span className="inline-flex gap-3">
        <button onClick={(e) => { e.stopPropagation(); setEditing(i); }} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-blue-700"><Pencil size={13} /> Modifier</button>
        <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Supprimer « ${i.label} » ? Les documents déjà enregistrés ne changent pas.`)) run(() => deleteReference(i.id)); }}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-700"><Trash2 size={13} /> Supprimer</button>
      </span>) },
  ];
  const reset = () => window.confirm(`Remplacer toute la table « ${table.title} » par les valeurs par défaut ? Vos ajouts et modifications de cette table seront perdus.`)
    && run(() => resetReferences(org.id, kind));

  return (
    <section className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center gap-2">
        <table.icon size={17} className="text-slate-700" />
        <span className="font-semibold text-slate-900">{table.title}</span>
        <span className="text-slate-400">· {rows.length}</span>
        <span className="flex-1" />
        {admin && !table.noReset && <Btn variant="ghost" onClick={reset}><RotateCcw size={14} /> Valeurs par défaut</Btn>}
        {admin && <Btn onClick={() => setEditing(table.blank())}><Plus size={15} /> Ajouter</Btn>}
      </div>
      <p className="px-4 py-2.5 text-sm text-slate-500 border-b border-slate-100">{table.intro}</p>
      {items === undefined ? <div className="p-6 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>
        : items === null ? <div className="p-6 text-sm text-amber-800 bg-amber-50">Tables de référence indisponibles : le script SQL 20261124000008 n’a pas encore été exécuté dans Supabase.</div>
          : rows.length === 0 ? <div className="p-6 text-sm text-slate-500">Aucune ligne. {admin && (table.noReset ? 'Ajoutez-en une.' : 'Ajoutez-en une ou revenez aux valeurs par défaut.')}</div>
            : <ResizableTable id={`ref-${kind}`} rows={rows} columns={columns} onRowClick={(i) => setEditing(i)} rowClass={(i) => (i.active ? '' : 'text-slate-400')}
              theadClass="bg-slate-50 text-left text-xs text-slate-500" thClass="px-4 py-2 font-medium" />}
      {error && <div className="px-4 py-3 text-sm text-red-700">{error}</div>}
      {editing && <EditDialog table={table} item={editing} admin={admin} items={items ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </section>
  );
}

// ---------------------------------------------------------------- Arrimage (réglage unique)
const LASHING_FIELDS = [
  { key: 'mu', label: 'Coefficient de frottement µ', type: 'num', step: 0.05, hint: 'Charge / plancher : 0,3 bois sur bois sec, 0,6 avec tapis antiglisse.' },
  { key: 'stfDaN', label: 'Tension standard d’une sangle (STF)', type: 'num', unit: 'daN', hint: 'Indiquée sur l’étiquette de la sangle (souvent 400 à 500 daN).' },
  { key: 'angleDeg', label: 'Angle de la sangle / plancher', type: 'num', unit: '°', hint: '90° = sangle verticale.' },
  { key: 'forwardBlocked', label: 'Charge bloquée vers l’avant (contre la face avant)', type: 'bool' },
];

const CONSOLIDATION_FIELDS = [
  { key: 'mode', label: 'Regroupement des chargements', type: 'select', wide: true, options: [
    ['free', 'Libre : tous les chargements du même jour sont comparés'],
    ['tour', 'Par tournée : seulement ceux dont toutes les destinations sont dans la même tournée'],
  ] },
];

const SETTINGS = {
  lashing: { title: 'Arrimage', icon: Link2, fields: LASHING_FIELDS,
    intro: 'Réglages de départ du calcul du nombre de sangles (EN 12195-1) dans « Répartition des charges & arrimage » des chargements.' },
  consolidation: { title: 'Regroupement', icon: Combine, fields: CONSOLIDATION_FIELDS,
    intro: 'Opérations › Regrouper : propose les chargements d’un même jour qui coûtent moins cher dans les mêmes véhicules. Ailleurs (palettisation, chargement), la tournée n’est jamais imposée : une simple alerte.' },
};

/** Réglage unique (une ligne « setting ») : fiche + enregistrer + valeurs par défaut de ce réglage seulement. */
function SettingSection({ code }) {
  const cfg = SETTINGS[code];
  const { org } = useEspace();
  const admin = org.role === 'owner' || org.role === 'admin';
  const { items, reload } = useReferences();
  const def = defaultReferences().find((i) => i.kind === 'setting' && i.code === code);
  const item = items?.find((i) => i.kind === 'setting' && i.code === code) ?? (items ? def : null);
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const current = form ?? (item ? formOf(item, cfg.fields) : null);
  const persist = async (next) => {
    setBusy(true); setMsg('');
    try { await saveReference(org.id, next); setForm(null); reload(); setMsg('Enregistré.'); } catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  const save = () => {
    const { item: next, errors } = itemOf(item, current, cfg.fields);
    if (Object.keys(errors).length) { setMsg('Valeurs invalides.'); return; }
    persist(next);
  };
  return (
    <section className="rounded-xl bg-white border border-slate-200 overflow-hidden max-w-2xl">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
        <cfg.icon size={17} className="text-slate-700" /><span className="font-semibold text-slate-900 flex-1">{cfg.title}</span>
        {admin && item && <Btn variant="ghost" onClick={() => window.confirm(`Revenir au réglage « ${cfg.title} » par défaut ?`) && persist({ ...item, data: def.data })}><RotateCcw size={14} /> Valeurs par défaut</Btn>}
      </div>
      <p className="px-4 py-2.5 text-sm text-slate-500 border-b border-slate-100">{cfg.intro}</p>
      {!current ? <div className="p-6 flex justify-center text-slate-400">{items === undefined ? <Loader2 className="animate-spin" /> : 'Indisponible.'}</div> : (
        <div className="p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
            {cfg.fields.map((f) => <Field key={f.key} f={f} value={current[f.key]} disabled={!admin} onChange={(v) => setForm({ ...current, [f.key]: v })} />)}
          </div>
          {admin && <div className="flex items-center gap-3"><Btn onClick={save} disabled={busy || !form}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer</Btn>
            {msg && <span className="text-sm text-slate-600">{msg}</span>}</div>}
        </div>
      )}
    </section>
  );
}

// Chemins absolus : dans une route « references/* », un lien relatif part de l'adresse complète
// (…/vehicules + « supports » = …/vehicules/supports → boucle de redirections).
const BASE = '/app/parametres/references';
const SUB = [
  { to: `${BASE}/vehicules`, label: 'Véhicules et contenants', icon: Truck },
  { to: `${BASE}/supports`, label: 'Supports de palettisation', icon: Package },
  { to: `${BASE}/agences`, label: 'Agences et destinations', icon: MapPin },
  { to: `${BASE}/tournees`, label: 'Tournées', icon: RouteIcon },
  { to: `${BASE}/regroupement`, label: 'Regroupement', icon: Combine },
  { to: `${BASE}/arrimage`, label: 'Arrimage', icon: Link2 },
];

export default function ReferencesPage() {
  return (
    <div className="px-5 sm:px-8 py-6 space-y-4">
      <p className="text-sm text-slate-600 max-w-3xl">Les données proposées dans vos chargements, palettisations et regroupements. Une modification vaut pour les nouveaux documents et ceux en cours ;
        un chargement envoyé au quai garde les valeurs du moment. Dans un document, vous pouvez encore ajuster une valeur pour ce document seulement.</p>
      <nav className="flex flex-wrap gap-1.5">
        {SUB.map((s) => (
          <NavLink key={s.to} to={s.to}
            className={({ isActive }) => `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border ${isActive ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
            <s.icon size={14} /> {s.label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<Navigate to={`${BASE}/vehicules`} replace />} />
        <Route path="vehicules" element={<RefTable kind="vehicle" />} />
        <Route path="supports" element={<RefTable kind="pallet" />} />
        <Route path="agences" element={<RefTable kind="agency" />} />
        <Route path="tournees" element={<RefTable kind="tour" />} />
        <Route path="regroupement" element={<SettingSection key="consolidation" code="consolidation" />} />
        <Route path="arrimage" element={<SettingSection key="lashing" code="lashing" />} />
        <Route path="*" element={<Navigate to={`${BASE}/vehicules`} replace />} />
      </Routes>
    </div>
  );
}
