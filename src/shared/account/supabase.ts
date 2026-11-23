// Accès à Supabase, chargé à la demande : les visiteurs sans compte ne téléchargent pas la librairie.
// Si les variables d'environnement manquent (développement local, panne), les fonctions de compte
// sont simplement désactivées : les outils publics ne dépendent jamais de ce module.

import type { SupabaseClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Les fonctions de compte sont-elles configurées sur ce déploiement ? */
export const accountEnabled = Boolean(URL && KEY);

let client: Promise<SupabaseClient> | null = null;

export function getSupabase(): Promise<SupabaseClient> {
  if (!accountEnabled) return Promise.reject(new Error('Comptes non configurés'));
  client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(URL!, KEY!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  }));
  return client;
}

/** Clé de stockage de la session Supabase (sb-<projet>-auth-token). */
const storageKey = () => {
  try { return `sb-${new globalThis.URL(URL!).hostname.split('.')[0]}-auth-token`; } catch { return ''; }
};

/**
 * Session présente dans ce navigateur ? Lecture synchrone du stockage, sans charger Supabase :
 * sert seulement à afficher « Mon compte » au lieu de « Se connecter » dans le menu.
 */
export function hasStoredSession(): boolean {
  if (!accountEnabled || typeof localStorage === 'undefined') return false;
  try { return Boolean(localStorage.getItem(storageKey())); } catch { return false; }
}

/**
 * Parcours « créer un compte » / « mot de passe oublié » : le lien reçu par e-mail ouvre l'espace,
 * qui affiche alors d'abord la page « Choisir mon mot de passe ». Mémorisé dans ce navigateur
 * (le lien doit de toute façon être ouvert dans le navigateur qui l'a demandé).
 */
const PASSWORD_STEP_KEY = 'al.auth.passwordStep';
export const passwordStep = {
  set: () => { try { localStorage.setItem(PASSWORD_STEP_KEY, '1'); } catch { /* stockage indisponible */ } },
  pending: (): boolean => { try { return localStorage.getItem(PASSWORD_STEP_KEY) === '1'; } catch { return false; } },
  clear: () => { try { localStorage.removeItem(PASSWORD_STEP_KEY); } catch { /* stockage indisponible */ } },
};
