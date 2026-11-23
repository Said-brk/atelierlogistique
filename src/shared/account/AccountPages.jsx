// Pages de compte (chargées à la demande) : /connexion et /compte.
//   Connexion : lien magique par e-mail (pas de mot de passe). Supabase crée le compte au premier lien.
//   Compte : création de son entreprise, membres, déconnexion ; « Mes chargements » et clés d'API arrivent ensuite.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, LogOut, Building2, Loader2, CheckCircle2, Truck, KeyRound, ArrowRight } from 'lucide-react';
import { getSupabase, accountEnabled } from './supabase';

const BLUE = '#2563EB';

function useNoIndex(title) {
  useEffect(() => {
    document.title = `${title} | Atelier Logistique`;
    let m = document.querySelector('meta[name="robots"]');
    const prev = m?.getAttribute('content');
    if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'robots'); document.head.appendChild(m); }
    m.setAttribute('content', 'noindex, nofollow');
    return () => { if (prev) m.setAttribute('content', prev); else m.remove(); };
  }, [title]);
}

function Shell({ children }) {
  return (
    <div className="min-h-[70vh] bg-slate-50 flex items-start justify-center px-4 py-12 sm:py-20">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

function Card({ children }) {
  return <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">{children}</div>;
}

function Disabled() {
  return <Shell><Card><p className="text-slate-600 text-sm">Les comptes ne sont pas encore activés sur ce site. Les outils restent utilisables sans compte.</p></Card></Shell>;
}

/** Session Supabase courante (null = pas connecté, undefined = en cours de lecture). */
function useSession() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    let sub;
    getSupabase().then((sb) => {
      sb.auth.getSession().then(({ data }) => setSession(data.session ?? null));
      sub = sb.auth.onAuthStateChange((_e, s) => setSession(s ?? null)).data.subscription;
    }).catch(() => setSession(null));
    return () => sub?.unsubscribe();
  }, []);
  return session;
}

export function LoginPage() {
  useNoIndex('Connexion');
  const navigate = useNavigate();
  const session = useSession();
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');

  useEffect(() => { if (session) navigate('/compte', { replace: true }); }, [session, navigate]);
  if (!accountEnabled) return <Disabled />;

  const send = async (e) => {
    e.preventDefault();
    setState('sending'); setError('');
    try {
      const sb = await getSupabase();
      const { error: err } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/compte` } });
      if (err) throw err;
      setState('sent');
    } catch (err) {
      setState('error');
      setError(/rate|limit/i.test(err?.message ?? '') ? 'Trop de demandes : réessayez dans quelques minutes.' : 'Envoi impossible. Vérifiez l’adresse et réessayez.');
    }
  };

  return (
    <Shell>
      <Card>
        <h1 className="font-bricolage font-bold text-2xl text-slate-900 mb-1">Se connecter</h1>
        <p className="text-sm text-slate-500 mb-6">Pour retrouver vos chargements et connecter votre ERP ou WMS. Les outils restent utilisables sans compte.</p>
        {state === 'sent' ? (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex gap-2">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            <div>Lien envoyé à <b>{email}</b>. Ouvrez l’e-mail et cliquez sur le lien pour vous connecter (pensez aux indésirables).</div>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-3">
            <label className="block text-xs font-jetbrains text-slate-500" htmlFor="email">ADRESSE E-MAIL PROFESSIONNELLE</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@entreprise.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            <button type="submit" disabled={state === 'sending'}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: BLUE }}>
              {state === 'sending' ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />} Recevoir un lien de connexion
            </button>
            {error && <div className="text-sm text-red-700">{error}</div>}
            <p className="text-[11px] text-slate-400">Pas de mot de passe : un lien de connexion vous est envoyé par e-mail. Premier lien = création du compte.</p>
          </form>
        )}
      </Card>
    </Shell>
  );
}

export function AccountPage() {
  useNoIndex('Mon compte');
  const navigate = useNavigate();
  const session = useSession();
  const [orgs, setOrgs] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (session === null) navigate('/connexion', { replace: true }); }, [session, navigate]);

  const loadOrgs = async () => {
    const sb = await getSupabase();
    const { data, error: err } = await sb.from('organization_members')
      .select('role, organizations(id, name, retention_days, created_at)').eq('user_id', session.user.id);
    if (err) { setError('Lecture du compte impossible.'); setOrgs([]); return; }
    setOrgs(data.map((m) => ({ ...m.organizations, role: m.role })));
  };
  useEffect(() => { if (session) loadOrgs(); }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!accountEnabled) return <Disabled />;
  if (!session || orgs === null) return <Shell><div className="flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div></Shell>;

  const createOrg = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    const sb = await getSupabase();
    const { error: err } = await sb.rpc('create_organization', { p_name: name.trim() });
    setBusy(false);
    if (err) { setError('Création impossible : ' + err.message); return; }
    await loadOrgs();
  };
  const signOut = async () => { const sb = await getSupabase(); await sb.auth.signOut(); navigate('/', { replace: true }); };
  const ROLE = { owner: 'Propriétaire', admin: 'Administrateur', member: 'Membre' };

  return (
    <Shell>
      <Card>
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="font-bricolage font-bold text-2xl text-slate-900">Mon compte</h1>
            <p className="text-sm text-slate-500 break-all">{session.user.email}</p>
          </div>
          <button onClick={signOut} className="inline-flex items-center gap-1.5 text-xs font-jetbrains text-slate-500 hover:text-slate-900 shrink-0">
            <LogOut size={13} /> Se déconnecter
          </button>
        </div>

        {orgs.length === 0 ? (
          <form onSubmit={createOrg} className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Building2 size={16} /> Créez votre entreprise</div>
            <p className="text-sm text-slate-500">Vos chargements et vos clés d’API seront rattachés à votre entreprise. Vous pourrez inviter vos collègues ensuite.</p>
            <input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l’entreprise"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            <button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: BLUE }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Créer
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            {orgs.map((o) => (
              <div key={o.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-slate-900"><Building2 size={16} /> {o.name}</div>
                  <span className="font-jetbrains text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{ROLE[o.role] ?? o.role}</span>
                </div>
                <div className="font-jetbrains text-[11px] text-slate-500 mt-1">Chargements conservés {o.retention_days} jours</div>
              </div>
            ))}
            <div className="grid gap-2">
              {[[Truck, 'Mes chargements', 'arrivés de votre WMS / ERP ou d’un fichier'], [KeyRound, 'Clés d’API', 'pour connecter votre WMS / ERP']].map(([Icon, t, d]) => (
                <div key={t} className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-slate-500">
                  <Icon size={16} />
                  <div className="text-sm"><b className="text-slate-700">{t}</b> — {d}</div>
                  <span className="ml-auto font-jetbrains text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">bientôt</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {error && <div className="text-sm text-red-700 mt-3">{error}</div>}
      </Card>
    </Shell>
  );
}
