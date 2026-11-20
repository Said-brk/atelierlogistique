// « Mes supports » : palettes dont l'utilisateur dispose réellement, mémorisées dans le navigateur.
// Niveau 2 : même interface avec un stockage serveur (supports partagés par site / entrepôt).

import { PALLET_PRESETS } from './engine/presets';
import type { PalletSpec } from './engine/types';

export interface SupportItem extends PalletSpec {
  available: boolean;
  custom?: boolean;
}

const KEY = 'al.pallet.supports.v1';
const DEFAULT_AVAILABLE = new Set(['eur', 'eur3']);

export function defaultSupports(): SupportItem[] {
  return PALLET_PRESETS.map((p) => ({ ...p, available: DEFAULT_AVAILABLE.has(p.id) }));
}

export function loadSupports(): SupportItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSupports();
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !Array.isArray(data.items)) return defaultSupports();
    // Les supports standard ajoutés depuis la dernière visite apparaissent (non cochés).
    const items: SupportItem[] = data.items;
    for (const p of PALLET_PRESETS) if (!items.some((i) => i.id === p.id)) items.push({ ...p, available: false });
    return items;
  } catch {
    return defaultSupports();
  }
}

export function saveSupports(items: SupportItem[]): void {
  try { localStorage.setItem(KEY, JSON.stringify({ version: 1, items })); } catch { /* navigation privée */ }
}

export function newCustomSupport(n: number): SupportItem {
  return {
    id: `custom-${Date.now().toString(36)}`, label: `Support perso ${n}`, length: 1200, width: 800, deckHeight: 144,
    tare: 25, maxTotalHeight: 1800, maxLoad: 1000, available: true, custom: true,
  };
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Retrouve un support à partir d'un texte saisi ou importé : identifiant (« eur3 »),
 * libellé (« EUR3 », « Demi-palette ») ou dimensions en cm (« 120x100 », « 120 × 100 »).
 */
export function matchSupport(text: unknown, supports: readonly PalletSpec[]): PalletSpec | null {
  const t = norm(String(text ?? ''));
  if (!t || t === 'auto') return null;
  const byId = supports.find((s) => s.id === t);
  if (byId) return byId;
  const dims = /(\d{2,4})\s*[x×*]\s*(\d{2,4})/.exec(t);
  if (dims) {
    let a = Number(dims[1]); let b = Number(dims[2]);
    if (a < 300) { a *= 10; b *= 10; } // saisi en cm
    const hit = supports.find((s) => (s.length === a && s.width === b) || (s.length === b && s.width === a));
    if (hit) return hit;
  }
  // Libellé : premier mot exact (« eur » ≠ « eur3 »), puis début du libellé.
  const first = (s: PalletSpec) => norm(s.label).split(/[\s/]+/)[0];
  return supports.find((s) => first(s) === t) ?? supports.find((s) => norm(s.label).startsWith(t)) ?? null;
}
