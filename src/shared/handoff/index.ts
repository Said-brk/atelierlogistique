// Transfert de données entre outils du site (ex. palettisation → optimiseur de chargement).
//
// Le message suit le même contrat que l'import : un schéma versionné + des
// enregistrements canoniques. L'outil destinataire le lit une seule fois à
// l'ouverture. Stockage de session : rien ne quitte le navigateur, rien ne
// persiste après fermeture de l'onglet.
// Niveau 2 : la même enveloppe pourra être postée vers une API (TMS, WMS).

import type { CanonicalRecord } from '../import/types';

export interface HandoffEnvelope {
  format: 'atelier-logistique/handoff';
  version: 1;
  schemaId: string;
  schemaVersion: number;
  /** Outil émetteur, pour le message d'accueil (« 12 palettes reçues de la palettisation »). */
  source: { tool: string; label: string };
  records: CanonicalRecord[];
  /** Données propres au destinataire (ex. contenant suggéré). */
  extra?: Record<string, unknown>;
  createdAt: string;
}

interface SessionLike { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void; }

const key = (target: string) => `al.handoff.${target}`;
export const HANDOFF_TTL_MS = 15 * 60 * 1000;

function session(): SessionLike | null {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch { return null; }
}

// Repli mémoire (navigation privée stricte, tests).
const memory = new Map<string, string>();
const fallback: SessionLike = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => { memory.set(k, v); },
  removeItem: (k) => { memory.delete(k); },
};

export function sendHandoff(
  target: string,
  data: Omit<HandoffEnvelope, 'format' | 'version' | 'createdAt'>,
  store: SessionLike = session() ?? fallback,
): void {
  const env: HandoffEnvelope = { format: 'atelier-logistique/handoff', version: 1, createdAt: new Date().toISOString(), ...data };
  try { store.setItem(key(target), JSON.stringify(env)); } catch { fallback.setItem(key(target), JSON.stringify(env)); }
}

/** Lit et efface le message destiné à `target` (lecture unique). null si rien ou invalide. */
export function consumeHandoff(
  target: string, schemaId: string, store: SessionLike = session() ?? fallback,
): HandoffEnvelope | null {
  const raw = store.getItem(key(target)) ?? fallback.getItem(key(target));
  store.removeItem(key(target));
  fallback.removeItem(key(target));
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as HandoffEnvelope;
    if (env.format !== 'atelier-logistique/handoff' || env.schemaId !== schemaId || !Array.isArray(env.records)) return null;
    // Envoi oublié (onglet laissé ouvert, envoi annulé) : ignoré au-delà de 15 minutes.
    if (Date.now() - new Date(env.createdAt).getTime() > HANDOFF_TTL_MS) return null;
    return env;
  } catch {
    return null;
  }
}
