// Contexte de l'espace connecté : session, entreprise courante, rechargement.
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSupabase } from '../shared/account/supabase';
import { myOrganizations } from './data';

const Ctx = createContext(null);
export const useEspace = () => useContext(Ctx);

export function EspaceProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = lecture en cours, null = déconnecté
  const [orgs, setOrgs] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let sub;
    getSupabase().then((sb) => {
      sb.auth.getSession().then(({ data }) => setSession(data.session ?? null));
      sub = sb.auth.onAuthStateChange((_e, s) => setSession(s ?? null)).data.subscription;
    }).catch(() => setSession(null));
    return () => sub?.unsubscribe();
  }, []);

  const reloadOrgs = useCallback(async () => {
    if (!session) return;
    try { setOrgs(await myOrganizations(session.user.id)); } catch (e) { setError(e.message); setOrgs([]); }
  }, [session]);
  useEffect(() => { reloadOrgs(); }, [reloadOrgs]);

  const value = { session, user: session?.user ?? null, orgs, org: orgs?.[0] ?? null, reloadOrgs, error };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
