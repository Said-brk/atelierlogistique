// Paramètres › Tables de référence : véhicules / contenants, supports de palettisation, agences, tournées,
// réglages (arrimage, regroupement).
// Une table = un schéma de champs (REF_TABLES) rendu par les mêmes composants : liste à colonnes
// redimensionnables, fiche d'édition, ajout, suppression, retour aux valeurs par défaut.
// Lecture pour tous les membres, modification par les administrateurs (règles de la base).

import { useMemo, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Truck, Package, Link2, Plus, Pencil, Trash2, RotateCcw, Loader2, X, Save, Check, MapPin, Route as RouteIcon, Combine, Receipt, Layers } from 'lucide-react';
import { useEspace } from '../useEspace';
import useReferences from '../useReferences';
import { saveReference, deleteReference, resetReferences } from '../data';
import { Btn } from '../ui';
import ResizableTable from '../ResizableTable';
import { defaultReferences } from '../../shared/references/defaults';
import { BILLING_LABELS, RATE_UNIT, SCOPE_LABELS, fuelFor } from '../../shared/carriers/pricing';
import TariffEditor, { tariffForm, tariffData } from '../TariffEditor';
import { t as tr, N_, numLocale } from '../../shared/i18n/core';
import { fmtMoney, fmtWeight, fmtDim, mToL, cmToDim, dimToCm, kgToW, wToKg, dimUnit, weightUnit, lengthUnit, currencySymbol } from '../../shared/units/units';

const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50';
const fmt = (v, d = 0) => (v == null || v === '' ? '—' : Number(v).toLocaleString(numLocale(), { maximumFractionDigits: d }));
const m = (mm) => fmt(mToL(mm / 1000), 2);
const w = (kg, d = 0) => fmtWeight(kg, d);
const dim = (mm) => fmt(cmToDim(mm / 10), 1);

// ---------------------------------------------------------------- Schémas des tables
// Champ : key (« code », « label », « active », « sort » = colonnes ; sinon dans data, « a.b » = sous-objet),
// type : text | cm (saisi en cm, stocké en mm) | num | bool | select (options : liste ou fonction des lignes) ;
// optional : vide autorisé (null).

const VEHICLE_FIELDS = [
  { key: 'code', label: N_('Code'), type: 'text', hint: N_('Identifiant utilisé par l’API (ex. semi, VUL12).') },
  { key: 'label', label: N_('Libellé'), type: 'text', wide: true },
  { key: 'length', label: N_('Longueur intérieure'), type: 'cm', unit: 'cm' },
  { key: 'width', label: N_('Largeur intérieure'), type: 'cm', unit: 'cm' },
  { key: 'height', label: N_('Hauteur intérieure'), type: 'cm', unit: 'cm' },
  { key: 'maxWeight', label: N_('Charge utile'), type: 'num', unit: 'kg', optional: true, hint: N_('Vide = non contrôlée.') },
  { key: 'cost', label: N_('Coût par voyage'), type: 'num', unit: '€', step: 10, hint: N_('Sert au choix de la flotte la moins chère.') },
  { key: 'sort', label: N_('Ordre d’affichage'), type: 'num' },
  { key: 'active', label: N_('Disponible (proposé dans les chargements)'), type: 'bool' },
  { key: 'inFleet', label: N_('Coché par défaut en « Flotte automatique »'), type: 'bool' },
  { key: 'axleMode', label: N_('Répartition des charges'), type: 'select', wide: true, options: [['container', N_('Conteneur : contrôle du centre de gravité (±5 %)')], ['axles', N_('Deux appuis : essieux ou sellette + essieux')]] },
  { key: 'axle.frontLabel', label: N_('Appui avant'), type: 'text', if: (v) => v.axleMode === 'axles' },
  { key: 'axle.rearLabel', label: N_('Appui arrière'), type: 'text', if: (v) => v.axleMode === 'axles' },
  { key: 'axle.frontPos', label: N_('Position appui avant'), type: 'cm', unit: 'cm', signed: true, hint: N_('Depuis la face avant de la caisse ; négatif = devant la caisse.'), if: (v) => v.axleMode === 'axles' },
  { key: 'axle.rearPos', label: N_('Position appui arrière'), type: 'cm', unit: 'cm', hint: N_('Centre du groupe d’essieux.'), if: (v) => v.axleMode === 'axles' },
  { key: 'axle.frontMax', label: N_('Charge utile maxi avant'), type: 'num', unit: 'kg', if: (v) => v.axleMode === 'axles' },
  { key: 'axle.rearMax', label: N_('Charge utile maxi arrière'), type: 'num', unit: 'kg', if: (v) => v.axleMode === 'axles' },
];

const PALLET_FIELDS = [
  { key: 'code', label: N_('Code'), type: 'text', hint: N_('Identifiant utilisé à l’import (ex. eur, eur3).') },
  { key: 'label', label: N_('Libellé'), type: 'text', wide: true },
  { key: 'length', label: N_('Longueur'), type: 'cm', unit: 'cm' },
  { key: 'width', label: N_('Largeur'), type: 'cm', unit: 'cm' },
  { key: 'deckHeight', label: N_('Hauteur du plateau'), type: 'cm', unit: 'cm', step: 0.1 },
  { key: 'tare', label: N_('Tare'), type: 'num', unit: 'kg', step: 0.5 },
  { key: 'maxTotalHeight', label: N_('Hauteur totale maxi'), type: 'cm', unit: 'cm', hint: N_('Support compris.') },
  { key: 'maxLoad', label: N_('Charge maxi'), type: 'num', unit: 'kg', hint: N_('Hors tare.') },
  { key: 'cost', label: N_('Coût unitaire'), type: 'num', unit: '€', step: 0.5, optional: true, hint: N_('Départage deux supports équivalents.') },
  { key: 'sort', label: N_('Ordre d’affichage'), type: 'num' },
  { key: 'active', label: N_('Coché par défaut (le moteur peut le choisir)'), type: 'bool' },
];

const toggle = (on, onClick, disabled, title) => (
  <button type="button" title={title} disabled={disabled} onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`w-5 h-5 rounded border inline-flex items-center justify-center ${on ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'} disabled:opacity-60`}>
    {on && <Check size={13} />}
  </button>
);

const VEHICLE_COLUMNS = (admin, patch) => [
  { key: 'code', h: N_('Code'), cell: (i) => <span className="font-jetbrains text-xs text-blue-700">{i.code}</span> },
  { key: 'label', h: N_('Libellé'), min: 120, cell: (i) => <span className="font-medium text-slate-900">{i.label}</span> },
  { key: 'dims', h: N_('L × l × H'), unit: lengthUnit, cell: (i) => <span className="font-jetbrains text-xs whitespace-nowrap">{m(i.data.length)} × {m(i.data.width)} × {m(i.data.height)}</span> },
  { key: 'load', h: N_('Charge utile'), cell: (i) => (i.data.maxWeight == null ? '—' : w(i.data.maxWeight)) },
  { key: 'cost', h: N_('Coût / voyage'), cell: (i) => fmtMoney(i.data.cost) },
  { key: 'axle', h: N_('Répartition'), cell: (i) => <span className="text-xs">{i.data.axle ? `${i.data.axle.frontLabel} / ${i.data.axle.rearLabel}` : tr('Conteneur')}</span> },
  { key: 'fleet', h: N_('Flotte'), cell: (i) => toggle(i.data.inFleet, () => patch(i, { data: { ...i.data, inFleet: !i.data.inFleet } }), !admin, tr('Coché par défaut en flotte automatique')) },
  { key: 'active', h: N_('Disponible'), cell: (i) => toggle(i.active, () => patch(i, { active: !i.active }), !admin, tr('Proposé dans les chargements')) },
];

const PALLET_COLUMNS = (admin, patch) => [
  { key: 'code', h: N_('Code'), cell: (i) => <span className="font-jetbrains text-xs text-blue-700">{i.code}</span> },
  { key: 'label', h: N_('Libellé'), min: 120, cell: (i) => <span className="font-medium text-slate-900">{i.label}</span> },
  { key: 'dims', h: N_('L × l'), unit: dimUnit, cell: (i) => <span className="font-jetbrains text-xs">{dim(i.data.length)} × {dim(i.data.width)}</span> },
  { key: 'deck', h: N_('Plateau'), cell: (i) => fmtDim(i.data.deckHeight / 10) },
  { key: 'tare', h: N_('Tare'), cell: (i) => w(i.data.tare, 1) },
  { key: 'hmax', h: N_('H maxi'), cell: (i) => fmtDim(i.data.maxTotalHeight / 10) },
  { key: 'load', h: N_('Charge maxi'), cell: (i) => w(i.data.maxLoad) },
  { key: 'cost', h: N_('Coût'), cell: (i) => (i.data.cost == null ? '—' : fmtMoney(i.data.cost)) },
  { key: 'active', h: N_('Coché'), cell: (i) => toggle(i.active, () => patch(i, { active: !i.active }), !admin, tr('Coché par défaut')) },
];

/** Zones proposées sur une agence : table des zones (et anciennes zones déjà saisies). */
function zoneOptions(items) {
  const zones = items.filter((i) => i.kind === 'zone').sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
  const known = new Set(zones.map((z) => z.code));
  const legacy = [...new Set(items.filter((i) => i.kind === 'agency' && i.data?.zone && !known.has(i.data.zone)).map((a) => String(a.data.zone)))];
  return [['', tr('— aucune')], ...zones.map((z) => [z.code, z.label]), ...legacy.map((z) => [z, `${z} (${tr('ancienne grille')})`])];
}

const ZONE_FIELDS = [
  { key: 'code', label: N_('Code'), type: 'text', hint: N_('Ex. Z1, IDF, SUD.') },
  { key: 'label', label: N_('Nom de la zone'), type: 'text', wide: true, hint: N_('Ex. Zone 1 · Île-de-France.') },
  { key: 'description', label: N_('Description'), type: 'text', optional: true, wide: true, hint: N_('Ex. 0–100 km de Rungis, départements couverts…') },
  { key: 'sort', label: N_('Ordre d’affichage'), type: 'num' },
  { key: 'active', label: N_('Active'), type: 'bool' },
];
const ZONE_COLUMNS = (admin, patch, items) => [
  { key: 'code', h: N_('Code'), cell: (i) => <span className="font-jetbrains text-xs text-blue-700">{i.code}</span> },
  { key: 'label', h: N_('Zone'), min: 120, cell: (i) => <span className="font-medium text-slate-900">{i.label}</span> },
  { key: 'description', h: N_('Description'), min: 140, cell: (i) => <span className="text-xs text-slate-600">{i.data.description || '—'}</span> },
  { key: 'agencies', h: N_('Agences'), cell: (i) => items.filter((a) => a.kind === 'agency' && a.data?.zone === i.code).length },
  { key: 'carriers', h: N_('Grilles'), cell: (i) => { const c = items.filter((x) => x.kind === 'carrier' && (x.data?.tariff?.zones ?? []).some((z) => z.code === i.code)); return c.length ? <span className="text-xs">{c.map((x) => x.code).join(', ')}</span> : <span className="text-xs text-slate-400">—</span>; } },
  { key: 'active', h: N_('Active'), cell: (i) => toggle(i.active, () => patch(i, { active: !i.active }), !admin, tr('Active')) },
];

const AGENCY_FIELDS = [
  { key: 'code', label: N_('Code agence / ville'), type: 'text', hint: N_('Valeur choisie dans la colonne Destination des lignes (ex. LYO01).') },
  { key: 'label', label: N_('Description'), type: 'text', wide: true },
  { key: 'city', label: N_('Ville'), type: 'text', optional: true },
  { key: 'zone', label: N_('Zone tarifaire'), type: 'select', optional: true, options: zoneOptions, hint: N_('Colonne des grilles transporteurs (Paramètres › Zones).') },
  { key: 'tour', label: N_('Tournée'), type: 'select', optional: true, options: (items) => [['', tr('— aucune')], ...items.filter((i) => i.kind === 'tour').map((t) => [t.code, `${t.code} · ${t.label}`])] },
  { key: 'order', label: N_('Rang dans la tournée'), type: 'num', hint: N_('1 = livrée en premier.') },
  { key: 'sort', label: N_('Ordre d’affichage'), type: 'num' },
  { key: 'active', label: N_('Proposée dans les listes de destinations'), type: 'bool' },
];

/** Jours (lundi → dimanche) abrégés dans la langue de l'utilisateur. */
const weekdays = () => Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(numLocale(), { weekday: 'short', timeZone: 'UTC' }).replace('.', ''));
const daysText = (days) => (days?.length ? [...days].sort().map((d) => weekdays()[d - 1]).join(', ') : '—');

const TOUR_FIELDS = [
  { key: 'code', label: N_('Code'), type: 'text', hint: N_('Ex. T-NORD, 69-01.') },
  { key: 'label', label: N_('Nom de la tournée'), type: 'text', wide: true },
  { key: 'days', label: N_('Jours de préparation / expédition'), type: 'days', wide: true, hint: N_('Affichés dans le calendrier des chargements.') },
  { key: 'carrier', label: N_('Transporteur par défaut'), type: 'select', optional: true, hint: N_('Proposé quand on choisit cette tournée sur un chargement.'),
    options: (items) => [['', tr('— aucun')], ...items.filter((i) => i.kind === 'carrier').map((c) => [c.code, `${c.code} · ${c.label}`])] },
  { key: 'sort', label: N_('Ordre d’affichage'), type: 'num' },
  { key: 'active', label: N_('Active'), type: 'bool' },
];

// ---------------------------------------------------------------- Transporteurs
const CARRIER_FIELDS = [
  { key: 'code', label: N_('Code'), type: 'text', hint: N_('Ex. GEODIS, TRANS-SUD.') },
  { key: 'label', label: N_('Raison sociale'), type: 'text', wide: true },
  { key: 'billing', label: N_('Mode de facturation'), type: 'select', wide: true, options: Object.entries(BILLING_LABELS) },
  { key: 'tariff', label: N_('Grille par zones et tranches'), type: 'tariff', wide: true, if: (f) => f.billing !== 'ftl' },
  { key: 'rate', label: N_('Tarif de base'), type: 'num', optional: true, if: (f) => f.billing !== 'ftl' && !f.tariff?.on, unitOf: (f) => RATE_UNIT[f.billing], hint: N_('Pour les destinations absentes de la grille (vide = grille seulement).') },
  { key: 'zones', label: N_('Tarifs par agence, tournée ou zone'), type: 'zones', if: (f) => f.billing !== 'ftl' && !f.tariff?.on, wide: true, unitOf: (f) => RATE_UNIT[f.billing],
    hint: N_('Par agence, par tournée ou par zone (Paramètres › Agences). Priorité : agence, puis tournée, puis zone. Plusieurs destinations : la plus chère s’applique.') },
  { key: 'kgPerM3', label: N_('Équivalence volume'), unit: 'kg/m³', type: 'num', if: (f) => f.billing === 'weight', hint: N_('Souvent 250 à 333.') },
  { key: 'kgPerLdm', label: N_('Équivalence plancher'), unit: 'kg/MPL', type: 'num', if: (f) => f.billing === 'weight', hint: N_('Souvent 1 500 à 1 850.') },

  { key: 'prices', label: N_('Forfait par véhicule'), type: 'prices', if: (f) => f.billing === 'ftl', wide: true, hint: N_('Laissez vide un véhicule que ce transporteur ne fournit pas.') },
  { key: 'minCharge', label: N_('Minimum de perception'), unit: '€', type: 'num', optional: true, hintOf: (f) => (f.tariff?.on ? N_('Pour les zones sans minimum dans la grille.') : null) },
  { key: 'stopFee', label: N_('Frais par arrêt supplémentaire'), unit: '€', type: 'num', optional: true, hint: N_('Au-delà de la première destination.'), if: (f) => !(f.tariff?.on && f.tariff.mode === 'per_dest') },
  { key: 'fuelPct', label: N_('Surcharge gazole par défaut'), unit: '%', type: 'num', optional: true },
  { key: 'fuelByMonth', label: N_('Surcharge gazole publiée chaque mois'), type: 'months', wide: true, hint: N_('Le taux du mois de départ s’applique (à défaut, le dernier mois publié, puis le taux par défaut).') },
  { key: 'sort', label: N_('Ordre d’affichage'), type: 'num' },
  { key: 'active', label: N_('Proposé sur les chargements'), type: 'bool' },
];

/** Unité affichée d'un champ (saisie convertie : cm → in, kg → lb ; devise de l'entreprise). */
const unitLabel = (u) => (u === 'cm' ? dimUnit() : u === 'kg' ? weightUnit() : u === '€' ? currencySymbol() : u);

const money = (v) => (v == null || v === '' ? '—' : fmtMoney(Number(v)));
const tariffText = (d) => {
  if (d.billing === 'ftl') {
    const p = Object.entries(d.prices ?? {}).filter(([, v]) => v != null && v !== '');
    return p.length ? tr('{n} forfait(s) véhicule', { n: p.length }) : tr('aucun forfait');
  }
  if (d.tariff?.zones?.length) return tr('{z} zones × {b} tranches · {m}', { z: d.tariff.zones.length, b: d.tariff.bands?.length ?? 0, m: d.tariff.mode === 'whole' ? tr('affrètement') : tr('messagerie') });
  const z = (d.zones ?? []).length;
  const baseTxt = d.rate == null ? '' : `${fmt(Number(d.rate), 2)} ${RATE_UNIT[d.billing] ?? ''}`;
  return [baseTxt, z ? tr('grille {n} ligne(s)', { n: z }) : ''].filter(Boolean).join(' · ') || '—';
};

const CARRIER_COLUMNS = (admin, patch) => [
  { key: 'code', h: N_('Code'), cell: (i) => <span className="font-jetbrains text-xs text-blue-700">{i.code}</span> },
  { key: 'label', h: N_('Transporteur'), min: 120, cell: (i) => <span className="font-medium text-slate-900">{i.label}</span> },
  { key: 'billing', h: N_('Facturation'), cell: (i) => <span className="text-xs">{BILLING_LABELS[i.data.billing] ?? '—'}</span> },
  { key: 'rate', h: N_('Tarif'), cell: (i) => <span className="text-xs whitespace-nowrap">{tariffText(i.data)}</span> },
  { key: 'min', h: N_('Minimum'), cell: (i) => money(i.data.minCharge) },
  { key: 'fuel', h: N_('Gazole'), cell: (i) => { const f = fuelFor(i.data, new Date().toISOString().slice(0, 7)); return f.pct ? `${fmt(f.pct, 1)} %${f.month ? '' : ` (${tr('défaut')})`}` : '—'; } },
  { key: 'active', h: N_('Proposé'), cell: (i) => toggle(i.active, () => patch(i, { active: !i.active }), !admin, tr('Proposé sur les chargements')) },
];

const agenciesOf = (items, tour) => items.filter((i) => i.kind === 'agency' && i.data?.tour === tour).sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));

const AGENCY_COLUMNS = (admin, patch, items) => [
  { key: 'code', h: N_('Code'), cell: (i) => <span className="font-jetbrains text-xs text-blue-700">{i.code}</span> },
  { key: 'label', h: N_('Description'), min: 120, cell: (i) => <span className="font-medium text-slate-900">{i.label}</span> },
  { key: 'city', h: N_('Ville'), cell: (i) => i.data.city || '—' },
  { key: 'zone', h: N_('Zone'), cell: (i) => { const z = items.find((x) => x.kind === 'zone' && x.code === i.data.zone); return <span className="text-xs">{z ? z.label : (i.data.zone || '—')}</span>; } },
  { key: 'tour', h: N_('Tournée'), cell: (i) => { const t = items.find((x) => x.kind === 'tour' && x.code === i.data.tour); return t ? <span className="text-xs">{t.code} · {t.label}</span> : <span className="text-xs text-slate-400">—</span>; } },
  { key: 'order', h: N_('Rang'), cell: (i) => (i.data.tour ? i.data.order ?? '—' : '—') },
  { key: 'active', h: N_('Proposée'), cell: (i) => toggle(i.active, () => patch(i, { active: !i.active }), !admin, tr('Proposée dans les listes')) },
];

const TOUR_COLUMNS = (admin, patch, items) => [
  { key: 'code', h: N_('Code'), cell: (i) => <span className="font-jetbrains text-xs text-blue-700">{i.code}</span> },
  { key: 'label', h: N_('Tournée'), min: 120, cell: (i) => <span className="font-medium text-slate-900">{i.label}</span> },
  { key: 'stops', h: N_('Agences, dans l’ordre de livraison'), min: 160, cell: (i) => { const a = agenciesOf(items, i.code); return a.length ? <span className="text-xs">{a.map((x) => x.code).join(' → ')}</span> : <span className="text-xs text-slate-400">{tr('aucune : rattachez des agences (onglet Agences)')}</span>; } },
  { key: 'days', h: N_('Jours'), cell: (i) => <span className="text-xs whitespace-nowrap">{daysText(i.data.days)}</span> },
  { key: 'carrier', h: N_('Transporteur'), cell: (i) => i.data.carrier || '—' },
  { key: 'n', h: N_('Agences'), cell: (i) => agenciesOf(items, i.code).length },
  { key: 'active', h: N_('Active'), cell: (i) => toggle(i.active, () => patch(i, { active: !i.active }), !admin, tr('Active')) },
];

const TABLES = {
  vehicle: {
    title: N_('Véhicules et contenants'), icon: Truck, fields: VEHICLE_FIELDS, columns: VEHICLE_COLUMNS, noun: N_('véhicule'),
    intro: N_('Proposés dans « Un véhicule » et la « Flotte automatique » des chargements, et reconnus par l’API (champ vehicle / fleet). Dimensions intérieures.'),
    blank: () => ({ kind: 'vehicle', code: '', label: '', active: true, sort: 100, data: { length: 13600, width: 2450, height: 2700, maxWeight: 24000, cost: 500, inFleet: false, axle: null } }),
  },
  pallet: {
    title: N_('Supports de palettisation'), icon: Package, fields: PALLET_FIELDS, columns: PALLET_COLUMNS, noun: N_('support'),
    intro: N_('Proposés dans « Mes supports » des palettisations ; le moteur choisit parmi les supports cochés.'),
    blank: () => ({ kind: 'pallet', code: '', label: '', active: true, sort: 100, data: { length: 1200, width: 800, deckHeight: 144, tare: 25, maxTotalHeight: 1800, maxLoad: 1000 } }),
  },
  agency: {
    title: N_('Agences et destinations'), icon: MapPin, fields: AGENCY_FIELDS, columns: AGENCY_COLUMNS, noun: N_('destination'), feminine: true, noReset: true,
    intro: N_('Les destinations de vos chargements et palettisations : choisies dans une liste (code ou description) au lieu d’une saisie libre. Une agence appartient au plus à une tournée.'),
    blank: () => ({ kind: 'agency', code: '', label: '', active: true, sort: 100, data: { city: '', tour: null, order: 1, zone: null } }),
  },
  tour: {
    title: N_('Tournées'), icon: RouteIcon, fields: TOUR_FIELDS, columns: TOUR_COLUMNS, noun: N_('tournée'), feminine: true, noReset: true,
    intro: N_('Vos tournées habituelles. Elles servent au regroupement des chargements (mode « par tournée ») et à l’ordre des arrêts ; la saisie reste libre ailleurs.'),
    blank: () => ({ kind: 'tour', code: '', label: '', active: true, sort: 100, data: {} }),
  },
  zone: {
    title: N_('Zones tarifaires'), icon: Layers, fields: ZONE_FIELDS, columns: ZONE_COLUMNS, noun: N_('zone'), feminine: true, noReset: true,
    intro: N_('Vos zones de tarification (comme les tournées) : colonnes des grilles transporteurs, choisies sur les agences et sur les chargements.'),
    blank: () => ({ kind: 'zone', code: '', label: '', active: true, sort: 100, data: { description: '' } }),
  },
  carrier: {
    title: N_('Transporteurs'), icon: Receipt, fields: CARRIER_FIELDS, columns: CARRIER_COLUMNS, noun: N_('transporteur'), noReset: true,
    intro: N_('Vos transporteurs et leur mode de facturation. Choisis sur un chargement, ils donnent son coût théorique (mètres plancher, palettes, poids taxable ou forfait).'),
    blank: () => ({ kind: 'carrier', code: '', label: '', active: true, sort: 100, data: { billing: 'ldm', rate: null, minCharge: null, kgPerM3: 333, kgPerLdm: 1750, prices: {}, fuelPct: null, fuelByMonth: {}, zones: [], stopFee: null } }),
  },
};

// ---------------------------------------------------------------- Lecture / écriture d'un champ
const AXLE_DEFAULT = { kind: 'TWO_SUPPORTS', frontLabel: tr('Essieu avant'), rearLabel: tr('Essieu arrière'), frontPos: -1200, rearPos: 4500, frontMax: 3000, rearMax: 7000 };
const TOP = ['code', 'label', 'active', 'sort'];

/** Valeurs de la fiche (texte saisi) à partir d'une ligne. */
function formOf(item, fields) {
  const v = { axleMode: item.data?.axle ? 'axles' : 'container' };
  const axle = item.data?.axle ?? AXLE_DEFAULT;
  for (const f of fields) {
    if (f.key === 'axleMode') continue;
    const raw = TOP.includes(f.key) ? item[f.key] : f.key.startsWith('axle.') ? axle[f.key.slice(5)] : item.data?.[f.key];
    if (f.type === 'tariff') { v[f.key] = tariffForm(raw); continue; }
    if (f.type === 'zones') { v[f.key] = (Array.isArray(raw) ? raw : []).map((z) => ({ scope: z.scope ?? 'zone', key: z.key ?? z.zone ?? '', rate: z.rate == null ? '' : String(z.rate) })); continue; }
    if (f.type === 'months') { v[f.key] = Object.entries(raw ?? {}).sort(([a], [b]) => b.localeCompare(a)).map(([month, x]) => ({ month, pct: x == null ? '' : String(x) })); continue; }
    if (f.type === 'prices') { v[f.key] = Object.fromEntries(Object.entries(raw ?? {}).map(([k, x]) => [k, x == null ? '' : String(x)])); continue; }
    v[f.key] = f.type === 'days' ? (Array.isArray(raw) ? raw : []) : f.type === 'bool' ? !!raw : raw == null ? '' : f.type === 'cm' ? String(cmToDim(Math.round(raw) / 10)) : f.unit === 'kg' ? String(Math.round(kgToW(Number(raw)) * 10) / 10) : String(raw);
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
    if (f.type === 'tariff') { const r = tariffData(val); if (r.error) errors[f.key] = r.error; val = r.value ?? null; if (r.create?.length) out.createZones = r.create; }
    if (f.type === 'zones') {
      const seen = new Set(); const list = [];
      for (const z of val ?? []) {
        const scope = z.scope || 'zone'; const key = String(z.key ?? '').trim(); const t = String(z.rate ?? '').trim().replace(',', '.');
        if (!key && !t) continue;
        const n = Number(t);
        if (!key || t === '' || !Number.isFinite(n) || n < 0) { errors[f.key] = tr('Chaque ligne : une agence, une tournée ou une zone, et un tarif'); continue; }
        const id = `${scope}:${key.toUpperCase()}`;
        if (seen.has(id)) { errors[f.key] = tr('{scope} {key} en double', { scope: SCOPE_LABELS[scope], key }); continue; }
        seen.add(id); list.push({ scope, key, rate: n });
      }
      val = list;
    }
    if (f.type === 'months') {
      const out3 = {};
      for (const r of val ?? []) {
        const m = String(r.month ?? '').trim(); const t = String(r.pct ?? '').trim().replace(',', '.');
        if (!m && !t) continue;
        const n = Number(t);
        if (!/^\d{4}-\d{2}$/.test(m) || t === '' || !Number.isFinite(n)) { errors[f.key] = tr('Chaque ligne : un mois et un taux'); continue; }
        out3[m] = n;
      }
      val = out3;
    }
    if (f.type === 'prices') {
      const out2 = {};
      for (const [k, x] of Object.entries(val ?? {})) {
        const t = String(x ?? '').trim().replace(',', '.');
        if (t === '') continue;
        const n = Number(t);
        if (!Number.isFinite(n) || n < 0) errors[f.key] = tr('Nombre invalide'); else out2[k] = n;
      }
      val = out2;
    }
    if (f.type === 'text') {
      val = String(val ?? '').trim();
      if (!val && !f.optional) errors[f.key] = tr('Obligatoire');
      else if (f.key === 'code' && !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$/.test(val)) errors[f.key] = tr('Lettres, chiffres, - _ . (40 max.)');
    } else if (f.type === 'cm' || f.type === 'num') {
      const s = String(val ?? '').trim().replace(',', '.');
      if (s === '') { if (f.optional) val = null; else errors[f.key] = tr('Obligatoire'); }
      else {
        const n = Number(s);
        if (!Number.isFinite(n) || (!f.signed && n < 0)) errors[f.key] = tr('Nombre invalide');
        else val = f.type === 'cm' ? Math.round(dimToCm(n) * 10) : f.unit === 'kg' ? Math.round(wToKg(n) * 1000) / 1000 : n;
      }
    }
    if (TOP.includes(f.key)) out[f.key] = val;
    else if (f.key.startsWith('axle.')) axle[f.key.slice(5)] = val;
    else out.data[f.key] = val;
  }
  if (out.kind === 'vehicle') out.data.axle = form.axleMode === 'axles' ? axle : null;
  if (out.kind === 'vehicle' && !(out.data.length > 0 && out.data.width > 0 && out.data.height > 0)) errors.length = errors.length ?? tr('Dimensions > 0');
  if (out.kind === 'pallet' && !(out.data.length > 0 && out.data.width > 0)) errors.length = errors.length ?? tr('Dimensions > 0');
  if (out.kind === 'carrier' && out.data.billing === 'ftl' && !Object.keys(out.data.prices ?? {}).length) errors.prices = tr('Au moins un forfait');
  if (out.kind === 'carrier' && out.data.billing === 'ftl') out.data.tariff = null;
  if (out.kind === 'carrier' && out.data.billing !== 'ftl' && !out.data.tariff && out.data.rate == null && !(out.data.zones ?? []).length) errors.rate = tr('Tarif de base ou grille par zone');
  return { item: out, errors };
}

function Field({ f, value, onChange, onPatch, error, disabled, items = [], form = {} }) {
  const unit = unitLabel(f.unitOf ? f.unitOf(form) : f.unit);
  const label = tr(f.label); const hintKey = f.hintOf?.(form) ?? f.hint; const hint = hintKey && tr(hintKey);
  if (f.type === 'tariff') {
    const zoneItems = items.filter((i) => i.kind === 'zone' && i.active).sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
    return <TariffEditor value={value} onChange={onChange} onFuel={(pct) => onPatch?.({ fuelPct: pct })} billing={form.billing} disabled={disabled} error={error} zoneItems={zoneItems} />;
  }
  const options = typeof f.options === 'function' ? f.options(items) : f.options;
  if (f.type === 'days') {
    const set = new Set(value ?? []);
    return (
      <div className="sm:col-span-2 text-xs text-slate-500">{label}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {weekdays().map((d, i) => {
            const on = set.has(i + 1);
            return (
              <button key={d} type="button" disabled={disabled}
                onClick={() => { const n = new Set(set); if (on) n.delete(i + 1); else n.add(i + 1); onChange([...n].sort()); }}
                className={`w-12 py-1.5 rounded-lg border text-sm ${on ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-slate-600'} disabled:opacity-60`}>{d}</button>
            );
          })}
        </div>
        {hint && <span className="block mt-0.5 text-slate-400">{hint}</span>}
      </div>
    );
  }
  if (f.type === 'zones') {
    const list = value ?? [];
    const set = (i, patch) => onChange(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const opts = {
      agency: items.filter((i) => i.kind === 'agency').sort((a, b) => a.code.localeCompare(b.code)).map((a) => [a.code, `${a.code} · ${a.label}`]),
      tour: items.filter((i) => i.kind === 'tour').sort((a, b) => a.sort - b.sort).map((t) => [t.code, `${t.code} · ${t.label}`]),
      zone: [...new Set(items.filter((i) => i.kind === 'agency' && i.data?.zone).map((a) => String(a.data.zone).trim()))].sort().map((z) => [z, z]),
    };
    return (
      <div className="sm:col-span-2 text-xs text-slate-500">{label}{unit && <span className="text-slate-400"> ({unit})</span>}
        <div className="mt-1 space-y-1.5">
          {list.map((r, i) => {
            const o = opts[r.scope] ?? [];
            const missing = r.key && !o.some(([v]) => v === r.key);
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="w-28 shrink-0"><select value={r.scope} onChange={(e) => set(i, { scope: e.target.value, key: '' })} disabled={disabled} className={inputCls}>
                  {Object.entries(SCOPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select></span>
                <select value={r.key} onChange={(e) => set(i, { key: e.target.value })} disabled={disabled} className={`${inputCls} min-w-0`}>
                  <option value="">{o.length ? tr('— choisir —') : r.scope === 'zone' ? tr('— aucune zone sur les agences —') : tr('— aucune —')}</option>
                  {o.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  {missing && <option value={r.key}>{r.key} ({tr('inconnue')})</option>}
                </select>
                <span className="w-28 shrink-0"><input value={r.rate} onChange={(e) => set(i, { rate: e.target.value })} disabled={disabled} inputMode="decimal"
                  placeholder={tr('Tarif')} className={`${inputCls} font-jetbrains text-right`} /></span>
                {!disabled && <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className="p-1 text-slate-400 hover:text-red-700" aria-label={tr('Retirer')}><X size={15} /></button>}
              </div>
            );
          })}
          {!disabled && <button type="button" onClick={() => onChange([...list, { scope: list.at(-1)?.scope ?? 'tour', key: '', rate: '' }])} className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"><Plus size={14} /> {tr('Ajouter une ligne')}</button>}
        </div>
        {error ? <span className="block mt-0.5 text-red-700">{error}</span> : hint && <span className="block mt-0.5 text-slate-400">{hint}</span>}
      </div>
    );
  }
  if (f.type === 'months') {
    const list = value ?? [];
    const set = (i, k, x) => onChange(list.map((r, j) => (j === i ? { ...r, [k]: x } : r)));
    return (
      <div className="sm:col-span-2 text-xs text-slate-500">{label}
        <div className="mt-1 space-y-1.5">
          {list.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="month" value={r.month} onChange={(e) => set(i, 'month', e.target.value)} disabled={disabled} className={inputCls} />
              <span className="w-32 shrink-0"><input value={r.pct} onChange={(e) => set(i, 'pct', e.target.value)} disabled={disabled} inputMode="decimal"
                placeholder="%" className={`${inputCls} font-jetbrains text-right`} /></span>
              {!disabled && <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className="p-1 text-slate-400 hover:text-red-700" aria-label={tr('Retirer')}><X size={15} /></button>}
            </div>
          ))}
          {!disabled && <button type="button" onClick={() => onChange([...list, { month: new Date().toISOString().slice(0, 7), pct: '' }])} className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"><Plus size={14} /> {tr('Ajouter un mois')}</button>}
        </div>
        {error ? <span className="block mt-0.5 text-red-700">{error}</span> : hint && <span className="block mt-0.5 text-slate-400">{hint}</span>}
      </div>
    );
  }
  if (f.type === 'prices') {
    const vehicles = items.filter((i) => i.kind === 'vehicle').sort((a, b) => a.sort - b.sort);
    const val = value ?? {};
    return (
      <div className="sm:col-span-2 text-xs text-slate-500">{label} <span className="text-slate-400">({currencySymbol()} {tr('par véhicule')})</span>
        <div className="mt-1 grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
          {vehicles.map((v) => (
            <label key={v.code} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-slate-700 truncate">{v.label}</span>
              <span className="w-28 shrink-0"><input value={val[v.code] ?? ''} onChange={(e) => onChange({ ...val, [v.code]: e.target.value })} disabled={disabled} inputMode="decimal"
                placeholder="—" className={`${inputCls} font-jetbrains text-right`} /></span>
            </label>
          ))}
        </div>
        {error ? <span className="block mt-0.5 text-red-700">{error}</span> : hint && <span className="block mt-0.5 text-slate-400">{hint}</span>}
      </div>
    );
  }
  if (f.type === 'bool') {
    return (
      <label className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} disabled={disabled} /> {label}
      </label>
    );
  }
  return (
    <label className={`block text-xs text-slate-500 ${f.wide ? 'sm:col-span-2' : ''}`}>
      {label}{unit && <span className="text-slate-400"> ({unit})</span>}
      {f.type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`mt-1 ${inputCls}`}>
          {options.map(([v, l]) => <option key={v} value={v}>{tr(l)}</option>)}
        </select>
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} inputMode={f.type === 'text' ? undefined : 'decimal'}
          className={`mt-1 ${inputCls} ${f.type === 'text' ? '' : 'font-jetbrains'} ${error ? 'border-red-400' : ''}`} />
      )}
      {error ? <span className="block mt-0.5 text-red-700">{error}</span> : hint && <span className="block mt-0.5 text-slate-400">{hint}</span>}
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
    try {
      // Grille collée avec des zones nouvelles : créées d'abord dans Paramètres › Zones.
      const { createZones, ...rest } = next;
      for (const [k, z] of (createZones ?? []).entries()) {
        await saveReference(org.id, { kind: 'zone', code: z.code, label: z.label.slice(0, 80), active: true, sort: 10 + k, data: { description: '' } });
      }
      await saveReference(org.id, rest); onSaved();
    } catch (err) { setMsg(err.message); setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <table.icon size={18} className="text-blue-700" />
          <div className="font-semibold text-slate-900 flex-1">{item.id ? `${item.label}` : table.feminine ? tr('Nouvelle {x}', { x: tr(table.noun) }) : tr('Nouveau {x}', { x: tr(table.noun) })}</div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700" aria-label={tr('Fermer')}><X size={18} /></button>
        </div>
        <div className="p-5 grid sm:grid-cols-2 gap-x-4 gap-y-3">
          {table.fields.filter((f) => !f.if || f.if(form)).map((f) => (
            <Field key={f.key} f={f} value={form[f.key]} error={errors[f.key]} disabled={!admin} items={items} form={form}
              onChange={(v) => setForm((x) => ({ ...x, [f.key]: v }))} onPatch={(p) => setForm((x) => ({ ...x, ...p }))} />
          ))}
        </div>
        <div className="sticky bottom-0 bg-white px-5 py-3 border-t border-slate-200 flex items-center gap-2">
          {msg && <span className="text-sm text-red-700 flex-1">{msg}</span>}
          <span className="flex-1" />
          <Btn type="button" variant="ghost" onClick={onClose}>{admin ? tr('Annuler') : tr('Fermer')}</Btn>
          {admin && <Btn type="submit" disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {tr('Enregistrer')}</Btn>}
        </div>
      </form>
    </div>
  );
}

function RefTable({ kind }) {
  const table = TABLES[kind];
  const { org } = useEspace();
  const admin = org.role === 'owner' || org.role === 'admin';
  const { items, reload, error: readError } = useReferences();
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const rows = useMemo(() => (items ?? []).filter((i) => i.kind === kind).sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label)), [items, kind]);
  const run = async (fn) => { setError(''); try { await fn(); reload(); } catch (e) { setError(e.message); } };
  const patch = (i, p) => run(() => saveReference(org.id, { ...i, ...p }));
  const columns = [
    ...table.columns(admin, patch, items ?? []).map((c) => ({ ...c, h: tr(c.h) + (c.unit ? ` (${c.unit()})` : '') })),
    { key: 'actions', h: '', tdClass: 'text-right whitespace-nowrap', cell: (i) => admin && (
      <span className="inline-flex gap-3">
        <button onClick={(e) => { e.stopPropagation(); setEditing(i); }} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-blue-700"><Pencil size={13} /> {tr('Modifier')}</button>
        <button onClick={(e) => { e.stopPropagation(); if (window.confirm(tr('Supprimer « {label} » ? Les documents déjà enregistrés ne changent pas.', { label: i.label }))) run(() => deleteReference(i.id)); }}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-700"><Trash2 size={13} /> {tr('Supprimer')}</button>
      </span>) },
  ];
  const reset = () => window.confirm(tr('Remplacer toute la table « {t} » par les valeurs par défaut ? Vos ajouts et modifications de cette table seront perdus.', { t: tr(table.title) }))
    && run(() => resetReferences(org.id, kind));

  return (
    <section className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center gap-2">
        <table.icon size={17} className="text-slate-700" />
        <span className="font-semibold text-slate-900">{tr(table.title)}</span>
        <span className="text-slate-400">· {rows.length}</span>
        <span className="flex-1" />
        {admin && !table.noReset && <Btn variant="ghost" onClick={reset}><RotateCcw size={14} /> {tr('Valeurs par défaut')}</Btn>}
        {admin && <Btn onClick={() => setEditing(table.blank())}><Plus size={15} /> {tr('Ajouter')}</Btn>}
      </div>
      <p className="px-4 py-2.5 text-sm text-slate-500 border-b border-slate-100">{tr(table.intro)}</p>
      {items === undefined ? <div className="p-6 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>
        : readError ? <div className="p-6 text-sm text-red-800 bg-red-50">{tr('Lecture impossible ({e}).', { e: readError })} <button onClick={reload} className="underline">{tr('Réessayer')}</button></div>
        : items === null ? <div className="p-6 text-sm text-amber-800 bg-amber-50">{tr('Tables de référence indisponibles : le script SQL {n} n’a pas encore été exécuté dans Supabase.', { n: '20261124000008' })}</div>
          : rows.length === 0 ? <div className="p-6 text-sm text-slate-500">{tr('Aucune ligne.')} {admin && (table.noReset ? tr('Ajoutez-en une.') : tr('Ajoutez-en une ou revenez aux valeurs par défaut.'))}</div>
            : <ResizableTable id={`ref-${kind}`} rows={rows} columns={columns} onRowClick={(i) => setEditing(i)} rowClass={(i) => (i.active ? '' : 'text-slate-400')}
              theadClass="bg-slate-50 text-left text-xs text-slate-500" thClass="px-4 py-2 font-medium" />}
      {error && <div className="px-4 py-3 text-sm text-red-700">{error}</div>}
      {editing && <EditDialog table={table} item={editing} admin={admin} items={items ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </section>
  );
}

// ---------------------------------------------------------------- Arrimage (réglage unique)
const LASHING_FIELDS = [
  { key: 'mu', label: N_('Coefficient de frottement µ'), type: 'num', step: 0.05, hint: N_('Charge / plancher : 0,3 bois sur bois sec, 0,6 avec tapis antiglisse.') },
  { key: 'stfDaN', label: N_('Tension standard d’une sangle (STF)'), type: 'num', unit: 'daN', hint: N_('Indiquée sur l’étiquette de la sangle (souvent 400 à 500 daN).') },
  { key: 'angleDeg', label: N_('Angle de la sangle / plancher'), type: 'num', unit: '°', hint: N_('90° = sangle verticale.') },
  { key: 'forwardBlocked', label: N_('Charge bloquée vers l’avant (contre la face avant)'), type: 'bool' },
];

const CONSOLIDATION_FIELDS = [
  { key: 'mode', label: N_('Regroupement des chargements'), type: 'select', wide: true, options: [
    ['free', N_('Libre : tous les chargements du même jour sont comparés')],
    ['tour', N_('Par tournée : seulement ceux dont toutes les destinations sont dans la même tournée')],
  ] },
];

const SETTINGS = {
  lashing: { title: N_('Arrimage'), icon: Link2, fields: LASHING_FIELDS,
    intro: N_('Réglages de départ du calcul du nombre de sangles (EN 12195-1) dans « Répartition des charges & arrimage » des chargements.') },
  consolidation: { title: N_('Regroupement'), icon: Combine, fields: CONSOLIDATION_FIELDS,
    intro: N_('Opérations › Regrouper : propose les chargements d’un même jour qui coûtent moins cher dans les mêmes véhicules. Ailleurs (palettisation, chargement), la tournée n’est jamais imposée : une simple alerte.') },
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
    try { await saveReference(org.id, next); setForm(null); reload(); setMsg(tr('Enregistré.')); } catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  const save = () => {
    const { item: next, errors } = itemOf(item, current, cfg.fields);
    if (Object.keys(errors).length) { setMsg(tr('Valeurs invalides.')); return; }
    persist(next);
  };
  return (
    <section className="rounded-xl bg-white border border-slate-200 overflow-hidden max-w-2xl">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
        <cfg.icon size={17} className="text-slate-700" /><span className="font-semibold text-slate-900 flex-1">{tr(cfg.title)}</span>
        {admin && item && <Btn variant="ghost" onClick={() => window.confirm(tr('Revenir au réglage « {t} » par défaut ?', { t: tr(cfg.title) })) && persist({ ...item, data: def.data })}><RotateCcw size={14} /> {tr('Valeurs par défaut')}</Btn>}
      </div>
      <p className="px-4 py-2.5 text-sm text-slate-500 border-b border-slate-100">{tr(cfg.intro)}</p>
      {!current ? <div className="p-6 flex justify-center text-slate-400">{items === undefined ? <Loader2 className="animate-spin" /> : tr('Indisponible.')}</div> : (
        <div className="p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
            {cfg.fields.map((f) => <Field key={f.key} f={f} value={current[f.key]} disabled={!admin} onChange={(v) => setForm({ ...current, [f.key]: v })} />)}
          </div>
          {admin && <div className="flex items-center gap-3"><Btn onClick={save} disabled={busy || !form}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {tr('Enregistrer')}</Btn>
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
  { to: `${BASE}/vehicules`, label: N_('Véhicules et contenants'), icon: Truck },
  { to: `${BASE}/supports`, label: N_('Supports de palettisation'), icon: Package },
  { to: `${BASE}/agences`, label: N_('Agences et destinations'), icon: MapPin },
  { to: `${BASE}/tournees`, label: N_('Tournées'), icon: RouteIcon },
  { to: `${BASE}/zones`, label: N_('Zones'), icon: Layers },
  { to: `${BASE}/transporteurs`, label: N_('Transporteurs'), icon: Receipt },
  { to: `${BASE}/regroupement`, label: N_('Regroupement'), icon: Combine },
  { to: `${BASE}/arrimage`, label: N_('Arrimage'), icon: Link2 },
];

export default function ReferencesPage() {
  return (
    <div className="px-5 sm:px-8 py-6 space-y-4">
      <p className="text-sm text-slate-600 max-w-3xl">{tr('Les données proposées dans vos chargements, palettisations et regroupements. Une modification vaut pour les nouveaux documents et ceux en cours ; un chargement envoyé au quai garde les valeurs du moment. Dans un document, vous pouvez encore ajuster une valeur pour ce document seulement.')}</p>
      <nav className="flex flex-wrap gap-1.5">
        {SUB.map((s) => (
          <NavLink key={s.to} to={s.to}
            className={({ isActive }) => `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border ${isActive ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
            <s.icon size={14} /> {tr(s.label)}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<Navigate to={`${BASE}/vehicules`} replace />} />
        <Route path="vehicules" element={<RefTable kind="vehicle" />} />
        <Route path="supports" element={<RefTable kind="pallet" />} />
        <Route path="agences" element={<RefTable kind="agency" />} />
        <Route path="tournees" element={<RefTable kind="tour" />} />
        <Route path="zones" element={<RefTable kind="zone" />} />
        <Route path="transporteurs" element={<RefTable kind="carrier" />} />
        <Route path="regroupement" element={<SettingSection key="consolidation" code="consolidation" />} />
        <Route path="arrimage" element={<SettingSection key="lashing" code="lashing" />} />
        <Route path="*" element={<Navigate to={`${BASE}/vehicules`} replace />} />
      </Routes>
    </div>
  );
}
