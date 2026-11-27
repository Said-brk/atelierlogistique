// Espace connecté (/app) : barre de navigation à gauche (sections et sous-sections), pages de travail à droite.
//   Tableau de bord
//   OPÉRATIONS : Chargements · Palettisations · Regrouper · Contrôle transport
//   OUTILS : par famille (sous-sections repliables) — outils locaux du site
//   Paramètres (en bas) : Entreprise · Équipe · API et notifications · Mon compte
// Chargé à la demande : les visiteurs des outils publics ne téléchargent rien de tout ça.

import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation, useMatch } from 'react-router-dom';
import { LayoutDashboard, Truck, Boxes, KeyRound, Settings, Plus, LogOut, Menu, X, ExternalLink, Loader2, Building2, ArrowRight, PanelLeftClose, PanelLeftOpen, Mail, ChevronDown, ChevronRight, Wrench, Combine, Receipt } from 'lucide-react';
import { EspaceProvider, useEspace } from './useEspace';
import { I18nProvider, useT } from '../shared/i18n/I18nProvider.jsx';
import { N_ } from '../shared/i18n/core';
import { userLang, accountLang, storedLang, rememberLang } from '../shared/i18n/userLang';
import { saveAccountLang } from '../shared/account/supabase';
import { setUnits, prefsOf, defaultUnits } from '../shared/units/units';
import UnitsPicker from './UnitsPicker';
import { accountEnabled, passwordStep, usesSso } from '../shared/account/supabase';
import { hasPassword } from './PasswordForm';
import { createOrganization, signOut, setPassword, acceptInvitation, declineInvitation, ROLES } from './data';
import Dashboard from './pages/Dashboard';
import Shipments from './pages/Shipments';
import ShipmentEditor, { NewShipment } from './pages/ShipmentEditor';
import Palletizations from './pages/Palletizations';
import PalletizationEditor, { NewPalletization } from './pages/PalletizationEditor';
import SettingsPage from './pages/SettingsPage';
import ConsolidationPage from './pages/ConsolidationPage';
import TransportControlPage from './pages/TransportControlPage';
import { ToolsHome, ToolInApp } from './pages/ToolsPages';
import { TOOL_GROUPS } from './tools';

/** Sections de la barre de gauche (les outils et les paramètres sont ajoutés par Sidebar). */
const NAV = [
  { id: 'home', items: [{ to: '/app', end: true, icon: LayoutDashboard, label: N_('Tableau de bord') }] },
  { id: 'operations', label: N_('Opérations'), items: [
    { to: '/app/chargements', icon: Truck, label: N_('Chargements') },
    { to: '/app/palettisations', icon: Boxes, label: N_('Palettisations') },
    { to: '/app/regrouper', icon: Combine, label: N_('Regrouper') },
    { to: '/app/transport', icon: Receipt, label: N_('Contrôle transport') },
  ] },
];

// Sous-sections « Outils » ouvertes, mémorisées dans ce navigateur.
const GROUPS_KEY = 'al.espace.nav.groups';
const readGroups = () => { try { return JSON.parse(localStorage.getItem(GROUPS_KEY) ?? 'null'); } catch { return null; } };

const linkCls = (collapsed, sub = false) => ({ isActive }) => `flex items-center gap-3 rounded-lg ${sub ? 'py-1.5 text-[13px]' : 'py-2 text-sm'} transition ${collapsed ? 'justify-center px-0' : sub ? 'pl-9 pr-3' : 'px-3'} ${isActive ? 'bg-white/10 text-white font-medium' : 'hover:bg-white/5 hover:text-white'}`;

function SectionTitle({ label, collapsed }) {
  return collapsed
    ? <div className="mx-3 my-2 border-t border-white/10" />
    : <div className="px-3 pt-4 pb-1 font-jetbrains text-[10px] tracking-widest text-slate-500">{label.toUpperCase()}</div>;
}

/** OUTILS : « Tous les outils » + une sous-section repliable par famille. Barre réduite : une seule icône. */
function ToolsNav({ collapsed, onNavigate }) {
  const t = useT();
  const active = useMatch('/app/outils/:id');
  const activeGroup = TOOL_GROUPS.find((g) => g.tools.some((t) => t.id === active?.params.id))?.id;
  const [open, setOpen] = useState(() => readGroups() ?? []);
  const isOpen = (id) => open.includes(id) || id === activeGroup;
  const toggle = (id) => setOpen((o) => {
    const next = isOpen(id) ? o.filter((x) => x !== id) : [...o, id];
    try { localStorage.setItem(GROUPS_KEY, JSON.stringify(next)); } catch { /* indisponible */ }
    return next;
  });
  if (collapsed) {
    return (
      <NavLink to="/app/outils" onClick={onNavigate} title={t('Outils')} className={linkCls(true)}><Wrench size={17} /></NavLink>
    );
  }
  return (
    <>
      <NavLink to="/app/outils" end onClick={onNavigate} className={linkCls(false)}><Wrench size={17} /> {t('Tous les outils')}</NavLink>
      {TOOL_GROUPS.map((g) => (
        <div key={g.id}>
          <button type="button" onClick={() => toggle(g.id)} aria-expanded={isOpen(g.id)}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-left hover:bg-white/5 hover:text-white">
            <g.icon size={17} /> <span className="flex-1 truncate">{t(g.label)}</span>
            <ChevronRight size={14} className={`text-slate-500 transition-transform ${isOpen(g.id) ? 'rotate-90' : ''}`} />
          </button>
          {isOpen(g.id) && (
            <div className="space-y-0.5">
              {g.tools.map((tool) => (
                <NavLink key={tool.id} to={`/app/outils/${tool.id}`} onClick={onNavigate} className={linkCls(false, true)}>{tool.name}</NavLink>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 120 120" aria-hidden="true">
      <path d="M16 104 L60 16 L104 104" fill="none" stroke="#fff" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="104" r="11" fill="#60A5FA" /><circle cx="104" cy="104" r="11" fill="#60A5FA" /><circle cx="60" cy="16" r="11" fill="#F59E0B" />
    </svg>
  );
}

// Barre réduite : icônes seules (+ info-bulle), logo réduit au « A ». Choix mémorisé dans ce navigateur.
const COLLAPSE_KEY = 'al.espace.sidebar.collapsed';
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; } };

function Sidebar({ onNavigate, collapsed = false, onToggle = null }) {
  const { org, orgs, setOrgId, user } = useEspace();
  const t = useT();
  const navigate = useNavigate();
  const [newOpen, setNewOpen] = useState(false);
  const switchOrg = (id) => { setOrgId(id); navigate('/app'); onNavigate?.(); };
  const out = async () => { await signOut(); navigate('/', { replace: true }); };
  return (
    <div className="h-full flex flex-col text-slate-300" style={{ background: '#0F172A' }}>
      <div className={`pt-5 pb-4 flex items-center ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-5'}`} title={collapsed ? org?.name : undefined}>
        <Logo />
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-bricolage font-bold text-white text-[15px] leading-tight">Atelier <span style={{ color: '#60A5FA' }}>Logistique</span></div>
            {orgs?.length > 1 ? (
              // Plusieurs entreprises : choix de l'entreprise affichée.
              <label className="relative flex items-center text-[11px] text-slate-300 hover:text-white" title={t('Changer d’entreprise')}>
                <select value={org?.id} onChange={(e) => switchOrg(e.target.value)} className="appearance-none bg-transparent pr-4 truncate max-w-[150px] cursor-pointer focus:outline-none">
                  {orgs.map((o) => <option key={o.id} value={o.id} className="text-slate-900">{o.name}</option>)}
                </select>
                <ChevronDown size={11} className="absolute right-0 pointer-events-none" />
              </label>
            ) : <div className="text-[11px] text-slate-400 truncate">{org?.name ?? '—'}</div>}
          </div>
        )}
      </div>

      <div className={`pb-3 relative ${collapsed ? 'px-2' : 'px-3'}`}>
        <button onClick={() => setNewOpen((o) => !o)} title={collapsed ? t('Nouveau…') : undefined} aria-expanded={newOpen}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition hover:brightness-105"
          style={{ background: '#F59E0B', color: '#0F172A' }}>
          <Plus size={16} /> {!collapsed && t('Nouveau')}
        </button>
        {newOpen && (
          <div className={`absolute z-50 mt-1 rounded-lg bg-white shadow-xl border border-slate-200 py-1 text-slate-800 ${collapsed ? 'left-14 top-0 w-56' : 'left-3 right-3'}`}>
            {[[Truck, t('Chargement'), t('camion, conteneur, tournée'), '/app/chargements/nouveau'], [Boxes, t('Palettisation'), t('colis → palettes'), '/app/palettisations/nouveau']].map(([Icon, l, d, to]) => (
              <button key={to} onClick={() => { setNewOpen(false); navigate(to); onNavigate?.(); }} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50">
                <Icon size={16} className="text-blue-700" /><span><span className="block text-sm font-medium">{l}</span><span className="block text-[11px] text-slate-500">{d}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>

      <nav className={`flex-1 min-h-0 overflow-y-auto space-y-0.5 [scrollbar-width:thin] ${collapsed ? 'px-2' : 'px-3'}`}>
        {NAV.map((sec) => (
          <div key={sec.id} className="space-y-0.5">
            {sec.label && <SectionTitle label={t(sec.label)} collapsed={collapsed} />}
            {sec.items.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} onClick={onNavigate} title={collapsed ? t(n.label) : undefined} className={linkCls(collapsed)}>
                <n.icon size={17} /> {!collapsed && t(n.label)}
              </NavLink>
            ))}
          </div>
        ))}
        <SectionTitle label={t('Outils')} collapsed={collapsed} />
        <ToolsNav collapsed={collapsed} onNavigate={onNavigate} />
      </nav>

      <div className={`py-3 border-t border-white/10 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
        <NavLink to="/app/parametres" onClick={onNavigate} title={collapsed ? t('Paramètres') : undefined} className={linkCls(collapsed)}>
          <Settings size={17} /> {!collapsed && t('Paramètres')}
        </NavLink>
        {onToggle && (
          <button onClick={onToggle} title={collapsed ? t('Agrandir la barre') : t('Réduire la barre')}
            className={`w-full flex items-center gap-3 rounded-lg py-2 text-xs hover:bg-white/5 hover:text-white ${collapsed ? 'justify-center px-0' : 'px-3'}`}>
            {collapsed ? <PanelLeftOpen size={16} /> : <><PanelLeftClose size={15} /> {t('Réduire')}</>}
          </button>
        )}
        <a href="/" title={collapsed ? t('Retour au site') : undefined}
          className={`flex items-center gap-3 rounded-lg py-2 text-xs hover:bg-white/5 hover:text-white ${collapsed ? 'justify-center px-0' : 'px-3'}`}>
          <ExternalLink size={15} /> {!collapsed && t('Retour au site')}
        </a>
        {collapsed ? (
          <button onClick={out} title={t('Se déconnecter ({email})', { email: user?.email ?? '' })} className="w-full flex justify-center py-2 rounded-lg hover:bg-white/10 hover:text-white"><LogOut size={15} /></button>
        ) : (
          <div className="flex items-center gap-2 px-3 pt-2">
            <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-xs font-semibold uppercase">{user?.email?.[0] ?? '?'}</div>
            <div className="text-[11px] text-slate-400 truncate flex-1" title={user?.email}>{user?.email}</div>
            <button onClick={out} title={t('Se déconnecter')} className="p-1.5 rounded hover:bg-white/10 hover:text-white"><LogOut size={15} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

function Onboarding() {
  const { reloadOrgs, user } = useEspace();
  const t = useT();
  const [name, setName] = useState('');
  const [prefs, setPrefs] = useState(() => defaultUnits(t.lang));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await createOrganization(name, prefs); await reloadOrgs(); } catch (err) { setError(err.message); }
    setBusy(false);
  };
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'radial-gradient(120% 120% at 80% 0%, #1D4ED8 0%, #0F172A 55%, #020617 100%)' }}>
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl space-y-4">
        <div className="flex items-center gap-2 text-blue-700"><Building2 size={20} /><span className="font-jetbrains text-xs">{t('BIENVENUE')} {user?.email}</span></div>
        <h1 className="font-bricolage font-bold text-2xl text-slate-900">{t('Créez votre espace')}</h1>
        <p className="text-sm text-slate-500">{t('Le nom de votre entreprise. Vos chargements et vos clés d’API y seront rattachés ; vous pourrez inviter vos collègues.')}</p>
        <p className="text-xs text-slate-400">{t('Votre entreprise a déjà un espace ? Ne créez rien : demandez à un administrateur de vous inviter avec l’adresse {email}, puis reconnectez-vous.', { email: user?.email ?? '' })}</p>
        <input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Ex. Transports Martin')}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        <div className="space-y-1.5">
          <div className="text-xs text-slate-500">{t('Unités et devise')} <span className="text-slate-400">· {t('modifiables ensuite dans Paramètres › Entreprise')}</span></div>
          <UnitsPicker value={prefs} onChange={setPrefs} compact />
        </div>
        <button disabled={busy} className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#2563EB' }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} {t('Entrer dans mon espace')}
        </button>
        {error && <div className="text-sm text-red-700">{error}</div>}
      </form>
    </div>
  );
}

// Après le lien « Créer un compte » / « Mot de passe oublié » : choisir son mot de passe, puis se connecter avec.
function ChoosePassword() {
  const { user } = useEspace();
  const t = useT();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mismatch = pw2.length > 0 && pw !== pw2;
  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) { setError(t('8 caractères minimum.')); return; }
    if (pw !== pw2) { setError(t('Les deux mots de passe sont différents.')); return; }
    setBusy(true); setError('');
    try {
      await setPassword(pw);
      passwordStep.clear();
      const email = user?.email ?? '';
      await signOut();
      // Rechargement complet : la page de connexion repart sans session, avec l'adresse pré-remplie.
      window.location.replace(`/connexion?pret=1&email=${encodeURIComponent(email)}`);
    } catch (err) { setError(err.message); setBusy(false); }
  };
  const cls = 'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200';
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'radial-gradient(120% 120% at 80% 0%, #1D4ED8 0%, #0F172A 55%, #020617 100%)' }}>
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl space-y-3">
        <div className="flex items-center gap-2 text-blue-700"><KeyRound size={18} /><span className="font-jetbrains text-xs break-all">{user?.email}</span></div>
        <h1 className="font-bricolage font-bold text-2xl text-slate-900">{t('Choisissez votre mot de passe')}</h1>
        <p className="text-sm text-slate-500">{t('8 caractères minimum. Vous l’utiliserez ensuite pour vous connecter avec votre e-mail.')}</p>
        <input type="email" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
        <input type="password" required autoComplete="new-password" placeholder={t('Mot de passe')} value={pw} onChange={(e) => setPw(e.target.value)} className={cls} />
        <input type="password" required autoComplete="new-password" placeholder={t('Confirmer le mot de passe')} value={pw2} onChange={(e) => setPw2(e.target.value)} className={cls} />
        {mismatch && <div className="text-xs text-amber-700">{t('Les deux mots de passe sont différents.')}</div>}
        <button disabled={busy} className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#2563EB' }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} {t('Enregistrer')}
        </button>
        {error && <div className="text-sm text-red-700">{error}</div>}
      </form>
    </div>
  );
}

// Invitations en attente (adresse du compte) : à l'entrée de l'espace, avant de créer son entreprise.
function Invitations({ canSkip, onSkip }) {
  const { invitations, reloadOrgs, setOrgId, user } = useEspace();
  const t = useT();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const act = async (id, accept) => {
    setBusy(id); setError('');
    try {
      if (accept) setOrgId(await acceptInvitation(id)); else await declineInvitation(id);
      await reloadOrgs();
    } catch (e) { setError(e.message); }
    setBusy(null);
  };
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'radial-gradient(120% 120% at 80% 0%, #1D4ED8 0%, #0F172A 55%, #020617 100%)' }}>
      <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl space-y-4">
        <div className="flex items-center gap-2 text-blue-700"><Mail size={18} /><span className="font-jetbrains text-xs break-all">{user?.email}</span></div>
        <h1 className="font-bricolage font-bold text-2xl text-slate-900">{invitations.length > 1 ? t('Vous êtes invité') : t('Vous êtes invité à rejoindre une entreprise')}</h1>
        {invitations.map((i) => (
          <div key={i.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div>
              <div className="font-semibold text-slate-900">{i.org_name}</div>
              <div className="text-xs text-slate-500">{i.invited_by_email ? t('Invité par {email}', { email: i.invited_by_email }) : t('Invitation')} · {t('rôle')} {(ROLES[i.role] ?? i.role).toLowerCase()}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => act(i.id, true)} disabled={!!busy} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#2563EB' }}>
                {busy === i.id ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />} {t('Rejoindre')}</button>
              <button onClick={() => act(i.id, false)} disabled={!!busy} className="rounded-lg px-4 py-2 text-sm font-medium border border-slate-300 text-slate-600 hover:bg-slate-50">{t('Refuser')}</button>
            </div>
          </div>
        ))}
        {error && <div className="text-sm text-red-700">{error}</div>}
        {canSkip && <button onClick={onSkip} className="text-sm text-slate-500 hover:text-slate-800">{t('Plus tard')}</button>}
      </div>
    </div>
  );
}

function Gate({ children }) {
  const { session, orgs, invitations } = useEspace();
  const navigate = useNavigate();
  const [skipInvites, setSkipInvites] = useState(false);
  useEffect(() => { if (session === null) navigate('/connexion', { replace: true }); }, [session, navigate]);
  if (!accountEnabled) return <Navigate to="/" replace />;
  if (!session || orgs === null) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400"><Loader2 className="animate-spin" /></div>;
  }
  // Compte Microsoft / Google : pas de mot de passe exigé.
  if (!usesSso(session.user) && (passwordStep.pending() || !hasPassword(session.user))) return <ChoosePassword />;
  if (invitations.length > 0 && !skipInvites) return <Invitations canSkip={orgs.length > 0} onSkip={() => setSkipInvites(true)} />;
  if (orgs.length === 0) return <Onboarding />;
  return children;
}

function Shell() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* stockage indisponible */ } return !c; });
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const robots = document.querySelector('meta[name="robots"]') ?? document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'robots' }));
    robots.setAttribute('content', 'noindex, nofollow');
  }, []);
  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Ordinateur : barre fixe à gauche */}
      <aside className={`hidden lg:block fixed inset-y-0 left-0 z-30 print:hidden transition-[width] duration-200 ${collapsed ? 'w-16' : 'w-60'}`}>
        <Sidebar collapsed={collapsed} onToggle={toggle} />
      </aside>
      {/* Mobile : barre du haut + tiroir */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 print:hidden" style={{ background: '#0F172A' }}>
        <div className="flex items-center gap-2"><Logo /><span className="font-bricolage font-bold text-white">Atelier <span style={{ color: '#60A5FA' }}>Logistique</span></span></div>
        <button onClick={() => setOpen(true)} className="text-white p-1.5" aria-label={t('Ouvrir le menu')}><Menu size={22} /></button>
      </div>
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-72 max-w-[85%] h-full shadow-2xl"><Sidebar onNavigate={() => setOpen(false)} /></div>
          <button className="flex-1 bg-black/40" onClick={() => setOpen(false)} aria-label={t('Fermer le menu')}><X className="ml-auto mr-4 text-white" /></button>
        </div>
      )}
      <main className={`min-w-0 transition-[padding] duration-200 ${collapsed ? 'lg:pl-16' : 'lg:pl-60'}`}>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="chargements" element={<Shipments />} />
          <Route path="chargements/nouveau" element={<NewShipment />} />
          <Route path="chargements/:code" element={<ShipmentEditor />} />
          <Route path="palettisations" element={<Palletizations />} />
          <Route path="palettisations/nouveau" element={<NewPalletization />} />
          <Route path="palettisations/:code" element={<PalletizationEditor />} />
          <Route path="regrouper" element={<ConsolidationPage />} />
          <Route path="transport" element={<TransportControlPage />} />
          <Route path="palettisation" element={<Navigate to="/app/palettisations" replace />} />
          <Route path="outils" element={<ToolsHome />} />
          <Route path="outils/:id" element={<ToolInApp />} />
          <Route path="parametres/*" element={<SettingsPage />} />
          <Route path="equipe" element={<Navigate to="/app/parametres/equipe" replace />} />
          <Route path="api" element={<Navigate to="/app/parametres/api" replace />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </main>
    </div>
  );
}

// Langue de l'interface : celle du compte (Paramètres › Mon compte), sinon celle choisie sur la page
// de connexion (reportée sur le compte), sinon le français.
function LangRoot({ children }) {
  const { user, org } = useEspace();
  const lang = userLang(user);
  setUnits(prefsOf(org, lang)); // devise et unités de l'entreprise affichée (pour tout l'espace)
  const saved = accountLang(user);
  // Choix fait sur la page de connexion (avant tout enregistrement sur le compte) : reporté sur le compte.
  useEffect(() => {
    const chosen = storedLang();
    if (user && !saved && chosen) saveAccountLang(chosen).catch(() => { /* réessayé à la prochaine visite */ });
  }, [user?.id, saved]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (saved) rememberLang(saved); document.documentElement.lang = lang; }, [saved, lang]);
  return <I18nProvider lang={lang}>{children}</I18nProvider>;
}

export default function EspaceApp() {
  return (
    <EspaceProvider>
      <LangRoot>
        <Gate><Shell /></Gate>
      </LangRoot>
    </EspaceProvider>
  );
}
