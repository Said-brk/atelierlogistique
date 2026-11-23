// Espace connecté (/app) : barre de navigation à gauche, pages de travail à droite.
//   Tableau de bord · Chargements (liste, nouveau, éditeur) · Palettisation · Clés d'API (bientôt) · Paramètres
// Chargé à la demande : les visiteurs des outils publics ne téléchargent rien de tout ça.

import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Truck, Boxes, KeyRound, Settings, Plus, LogOut, Menu, X, ExternalLink, Loader2, Building2, ArrowRight } from 'lucide-react';
import { EspaceProvider, useEspace } from './useEspace';
import { I18nProvider } from '../shared/i18n/I18nProvider.jsx';
import { accountEnabled } from '../shared/account/supabase';
import { createOrganization, signOut } from './data';
import Dashboard from './pages/Dashboard';
import Shipments from './pages/Shipments';
import ShipmentEditor, { NewShipment } from './pages/ShipmentEditor';
import PalletPage from './pages/PalletPage';
import SettingsPage from './pages/SettingsPage';

const NAV = [
  { to: '/app', end: true, icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/app/chargements', icon: Truck, label: 'Chargements' },
  { to: '/app/palettisation', icon: Boxes, label: 'Palettisation' },
  { to: null, icon: KeyRound, label: 'Clés d’API', soon: true },
  { to: '/app/parametres', icon: Settings, label: 'Paramètres' },
];

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 120 120" aria-hidden="true">
      <path d="M16 104 L60 16 L104 104" fill="none" stroke="#fff" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="104" r="11" fill="#60A5FA" /><circle cx="104" cy="104" r="11" fill="#60A5FA" /><circle cx="60" cy="16" r="11" fill="#F59E0B" />
    </svg>
  );
}

function Sidebar({ onNavigate }) {
  const { org, user } = useEspace();
  const navigate = useNavigate();
  const out = async () => { await signOut(); navigate('/', { replace: true }); };
  return (
    <div className="h-full flex flex-col text-slate-300" style={{ background: '#0F172A' }}>
      <div className="px-5 pt-5 pb-4 flex items-center gap-2.5">
        <Logo />
        <div className="min-w-0">
          <div className="font-bricolage font-bold text-white text-[15px] leading-tight">Atelier <span style={{ color: '#60A5FA' }}>Logistique</span></div>
          <div className="text-[11px] text-slate-400 truncate">{org?.name ?? '—'}</div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <button onClick={() => { navigate('/app/chargements/nouveau'); onNavigate?.(); }}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition hover:brightness-105"
          style={{ background: '#F59E0B', color: '#0F172A' }}>
          <Plus size={16} /> Nouveau chargement
        </button>
      </div>

      <nav className="px-3 flex-1 space-y-0.5">
        {NAV.map((n) => (n.to ? (
          <NavLink key={n.label} to={n.to} end={n.end} onClick={onNavigate}
            className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${isActive ? 'bg-white/10 text-white font-medium' : 'hover:bg-white/5 hover:text-white'}`}>
            <n.icon size={17} /> {n.label}
          </NavLink>
        ) : (
          <div key={n.label} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-default">
            <n.icon size={17} /> {n.label}
            <span className="ml-auto text-[10px] font-jetbrains rounded px-1.5 py-0.5 bg-white/5 text-amber-400">bientôt</span>
          </div>
        )))}
      </nav>

      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <a href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs hover:bg-white/5 hover:text-white"><ExternalLink size={15} /> Retour au site</a>
        <div className="flex items-center gap-2 px-3 pt-2">
          <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-xs font-semibold uppercase">{user?.email?.[0] ?? '?'}</div>
          <div className="text-[11px] text-slate-400 truncate flex-1" title={user?.email}>{user?.email}</div>
          <button onClick={out} title="Se déconnecter" className="p-1.5 rounded hover:bg-white/10 hover:text-white"><LogOut size={15} /></button>
        </div>
      </div>
    </div>
  );
}

function Onboarding() {
  const { reloadOrgs, user } = useEspace();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await createOrganization(name); await reloadOrgs(); } catch (err) { setError(err.message); }
    setBusy(false);
  };
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'radial-gradient(120% 120% at 80% 0%, #1D4ED8 0%, #0F172A 55%, #020617 100%)' }}>
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl space-y-4">
        <div className="flex items-center gap-2 text-blue-700"><Building2 size={20} /><span className="font-jetbrains text-xs">BIENVENUE {user?.email}</span></div>
        <h1 className="font-bricolage font-bold text-2xl text-slate-900">Créez votre espace</h1>
        <p className="text-sm text-slate-500">Le nom de votre entreprise. Vos chargements et vos clés d’API y seront rattachés ; vous pourrez inviter vos collègues.</p>
        <input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Transports Martin"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        <button disabled={busy} className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#2563EB' }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Entrer dans mon espace
        </button>
        {error && <div className="text-sm text-red-700">{error}</div>}
      </form>
    </div>
  );
}

function Gate({ children }) {
  const { session, orgs } = useEspace();
  const navigate = useNavigate();
  useEffect(() => { if (session === null) navigate('/connexion', { replace: true }); }, [session, navigate]);
  if (!accountEnabled) return <Navigate to="/" replace />;
  if (!session || orgs === null) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400"><Loader2 className="animate-spin" /></div>;
  }
  if (orgs.length === 0) return <Onboarding />;
  return children;
}

function Shell() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const robots = document.querySelector('meta[name="robots"]') ?? document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'robots' }));
    robots.setAttribute('content', 'noindex, nofollow');
  }, []);
  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Ordinateur : barre fixe à gauche */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-60 z-30 print:hidden"><Sidebar /></aside>
      {/* Mobile : barre du haut + tiroir */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 print:hidden" style={{ background: '#0F172A' }}>
        <div className="flex items-center gap-2"><Logo /><span className="font-bricolage font-bold text-white">Atelier <span style={{ color: '#60A5FA' }}>Logistique</span></span></div>
        <button onClick={() => setOpen(true)} className="text-white p-1.5" aria-label="Ouvrir le menu"><Menu size={22} /></button>
      </div>
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-72 max-w-[85%] h-full shadow-2xl"><Sidebar onNavigate={() => setOpen(false)} /></div>
          <button className="flex-1 bg-black/40" onClick={() => setOpen(false)} aria-label="Fermer le menu"><X className="ml-auto mr-4 text-white" /></button>
        </div>
      )}
      <main className="lg:pl-60 min-w-0">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="chargements" element={<Shipments />} />
          <Route path="chargements/nouveau" element={<NewShipment />} />
          <Route path="chargements/:code" element={<ShipmentEditor />} />
          <Route path="palettisation" element={<PalletPage />} />
          <Route path="parametres" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function EspaceApp() {
  return (
    <I18nProvider lang="fr">
      <EspaceProvider>
        <Gate><Shell /></Gate>
      </EspaceProvider>
    </I18nProvider>
  );
}
