// Contexte de l'espace connecté : session, entreprises (et celle choisie), invitations en attente, rechargement.
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSupabase } from '../shared/account/supabase';
import { myOrganizations, myInvitations } from './data';

const ORG_KEY = 'al.espace.org';
const readOrg = () => { try { return localStorage.getItem(ORG_KEY); } catch { return null; } };

const Ctx = createContext(null);
export const useEspace = () => useContext(Ctx);

export function EspaceProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = lecture en cours, null = déconnecté
  const [orgs, setOrgs] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [orgId, setOrgIdState] = useState(readOrg);
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
    // Invitations : sans effet bloquant si la base n'a pas encore la fonction (script pas encore exécuté).
    const [o, inv] = await Promise.all([
      myOrganizations(session.user.id).catch((e) => { setError(e.message); return []; }),
      myInvitations().catch(() => []),
    ]);
    setInvitations(inv);
    setOrgs(o);
  }, [session]);
  /** Choisir l'entreprise affichée (si l'utilisateur appartient à plusieurs entreprises). */
  const setOrgId = useCallback((id) => { setOrgIdState(id); try { localStorage.setItem(ORG_KEY, id); } catch { /* stockage indisponible */ } }, []);
  useEffect(() => { reloadOrgs(); }, [reloadOrgs]);

  const org = orgs?.find((o) => o.id === orgId) ?? orgs?.[0] ?? null;
  const value = { session, user: session?.user ?? null, orgs, org, setOrgId, invitations, reloadOrgs, error };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
