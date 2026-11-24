// Tables de référence de l'entreprise courante, partagées par les pages (cache par entreprise).
// Les éditeurs (chargement, palettisation) les passent aux outils ; Paramètres les modifie puis invalide.
// Base sans la table (script SQL pas encore exécuté) : null → les outils gardent leurs valeurs par défaut.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEspace } from './useEspace';
import { listReferences } from './data';
import { toToolReferences } from '../shared/references/defaults';

const cache = new Map(); // orgId → Promise<items | null>
const listeners = new Set();

const fetchRefs = (orgId) => {
  if (!cache.has(orgId)) cache.set(orgId, listReferences(orgId).catch(() => null));
  return cache.get(orgId);
};

export function invalidateReferences(orgId) {
  cache.delete(orgId);
  listeners.forEach((l) => l(orgId));
}

/** { items, tools, reload } — items : lignes brutes ; tools : format des outils (null si indisponible). */
export default function useReferences() {
  const { org } = useEspace();
  const orgId = org?.id;
  const [items, setItems] = useState(undefined); // undefined = lecture en cours
  const load = useCallback(() => { if (orgId) fetchRefs(orgId).then(setItems); }, [orgId]);
  useEffect(() => {
    setItems(undefined); load();
    const l = (id) => { if (id === orgId) load(); };
    listeners.add(l);
    return () => listeners.delete(l);
  }, [orgId, load]);
  const tools = useMemo(() => (items?.length ? toToolReferences(items) : null), [items]);
  return { items, tools, reload: () => invalidateReferences(orgId) };
}
