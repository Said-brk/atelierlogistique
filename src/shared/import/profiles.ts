import type { ImportOptions, ImportProfile, Mapping, ProfileStore } from './types';

const STORAGE_KEY = 'al.import.profiles.v1';

/** Stockage minimal compatible localStorage (injectable pour les tests). */
export interface KeyValueStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function memoryStorage(): KeyValueStorage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } };
}

function defaultStorage(): KeyValueStorage {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.getItem(STORAGE_KEY);
      return localStorage;
    }
  } catch { /* navigation privée, iframe… */ }
  return memoryStorage();
}

/** Niveau 1 : profils dans le navigateur. Rien ne quitte le poste de l'utilisateur. */
export function createLocalProfileStore(storage: KeyValueStorage = defaultStorage()): ProfileStore {
  const readAll = (): ImportProfile[] => {
    try {
      const v = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  };
  const writeAll = (list: ImportProfile[]) => {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* quota */ }
  };
  return {
    list: (schemaId) => readAll().filter((p) => p.schemaId === schemaId).sort((a, b) => a.name.localeCompare(b.name)),
    get: (id) => readAll().find((p) => p.id === id) ?? null,
    save: (profile) => {
      const list = readAll().filter((p) => p.id !== profile.id);
      list.push(profile);
      writeAll(list);
    },
    remove: (id) => writeAll(readAll().filter((p) => p.id !== id)),
  };
}

export function newProfile(
  name: string, schemaId: string, schemaVersion: number, mapping: Mapping, options: ImportOptions,
): ImportProfile {
  const now = new Date().toISOString();
  const id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  return { id, name: name.trim() || 'Profil sans nom', schemaId, schemaVersion, mapping, options, createdAt: now, updatedAt: now };
}

/** Export JSON d'un profil : à partager entre postes / collègues. */
export function exportProfile(p: ImportProfile): string {
  return JSON.stringify({ format: 'atelier-logistique/import-profile', version: 1, profile: p }, null, 2);
}

/** Import d'un profil partagé ; nouvel identifiant pour éviter les collisions. */
export function importProfileJson(json: string, schemaId: string): ImportProfile {
  const data = JSON.parse(json);
  const p = data?.profile;
  if (data?.format !== 'atelier-logistique/import-profile' || !p?.mapping) {
    throw new Error("Ce fichier n'est pas un profil d'import Atelier Logistique.");
  }
  if (p.schemaId !== schemaId) throw new Error("Ce profil concerne un autre type de données.");
  return { ...newProfile(p.name, p.schemaId, p.schemaVersion ?? 1, p.mapping, p.options ?? {}) };
}
