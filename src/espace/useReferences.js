// Tables de référence de l'entreprise courante, partagées par les pages (cache par entreprise).
// Les éditeurs (chargement, palettisation) les passent aux outils ; Paramètres les modifie puis invalide.
// Base sans la table (script SQL pas encore exécuté) : null → les outils gardent leurs valeurs par défaut.
// Toute autre erreur (réseau…) : error — les éditeurs ne calculent pas avec des valeurs par défaut à la place.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEspace } from './useEspace';
import { listReferences } from './data';
import { toToolReferences } from '../shared/references/defaults';
import { t as tr } from '../shared/i18n/core';

const cache = new Map(); // orgId → Promise<items | null | { error }>
const missingTable = (e) => /reference_items/.test(e?.message ?? '') && /does not exist|schema cache|not find/i.test(e.message);
const listeners = new Set();

const fetchRefs = (orgId) => {
  if (!cache.has(orgId)) {
    cache.set(orgId, listReferences(orgId).catch((e) => {
      if (missingTable(e)) return null;
      cache.delete(orgId); // nouvel essai au prochain affichage
      return { error: e.message || tr('Erreur réseau') };
    }));
  }
  return cache.get(orgId);
};

export function invalidateReferences(orgId) {
  cache.delete(orgId);
  listeners.forEach((l) => l(orgId));
}

/**
 * { items, tools, error, reload } — items : lignes brutes (undefined pendant la lecture, null si la table
 * n'existe pas) ; tools : format des outils (null si indisponible) ; error : lecture impossible.
 */
export default function useReferences() {
  const { org } = useEspace();
  const orgId = org?.id;
  const [items, setItems] = useState(undefined); // undefined = lecture en cours
  const [error, setError] = useState('');
  const load = useCallback(() => {
    if (!orgId) return;
    fetchRefs(orgId).then((r) => { if (r && !Array.isArray(r)) { setError(r.error); setItems(null); } else { setError(''); setItems(r); } });
  }, [orgId]);
  useEffect(() => {
    setItems(undefined); load();
    const l = (id) => { if (id === orgId) load(); };
    listeners.add(l);
    return () => listeners.delete(l);
  }, [orgId, load]);
  const tools = useMemo(() => (items?.length ? toToolReferences(items) : null), [items]);
  return { items, tools, error, reload: () => invalidateReferences(orgId) };
}
