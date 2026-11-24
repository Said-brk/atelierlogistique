// /app/parametres : tout le paramétrage, en onglets.
//   Entreprise · Équipe · API et notifications · Mon compte

import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Building2, UserRound, LogOut, Save, Loader2, Users, KeyRound } from 'lucide-react';
import { useEspace } from '../useEspace';
import { renameOrganization, signOut, ROLES } from '../data';
import { PageHeader, Btn } from '../ui';
import PasswordForm, { hasPassword } from '../PasswordForm';
import TeamPage from './TeamPage';
import ApiKeysPage from './ApiKeysPage';

export const SETTINGS_TABS = [
  { to: '/app/parametres', end: true, icon: Building2, label: 'Entreprise' },
  { to: '/app/parametres/equipe', icon: Users, label: 'Équipe' },
  { to: '/app/parametres/api', icon: KeyRound, label: 'API et notifications' },
  { to: '/app/parametres/compte', icon: UserRound, label: 'Mon compte' },
];

function CompanyTab() {
  const { org, reloadOrgs } = useEspace();
  const [name, setName] = useState(org.name);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const admin = org.role === 'owner' || org.role === 'admin';
  const save = async () => {
    setBusy(true); setMsg('');
    try { await renameOrganization(org.id, name); await reloadOrgs(); setMsg('Enregistré.'); } catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  return (
    <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-3 max-w-xl">
      <div className="flex items-center gap-2 font-semibold text-slate-900"><Building2 size={17} /> Entreprise</div>
      <label className="block text-xs text-slate-500">Nom
        <input value={name} onChange={(e) => setName(e.target.value)} disabled={!admin}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50" /></label>
      <div className="text-sm text-slate-600">Votre rôle : <b>{ROLES[org.role] ?? org.role}</b></div>
      <div className="text-sm text-slate-600">Chargements conservés <b>{org.retention_days} jours</b>, puis supprimés automatiquement.</div>
      {admin && <Btn onClick={save} disabled={busy || name.trim().length < 2}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer</Btn>}
      {msg && <div className="text-sm text-slate-600">{msg}</div>}
    </section>
  );
}

function AccountTab() {
  const { user } = useEspace();
  const navigate = useNavigate();
  return (
    <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-3 max-w-xl">
      <div className="flex items-center gap-2 font-semibold text-slate-900"><UserRound size={17} /> Mon compte</div>
      <div className="text-sm text-slate-600">{user.email}</div>
      <div className="text-xs text-slate-500">{hasPassword(user) ? 'Connexion par e-mail et mot de passe.' : 'Pas encore de mot de passe : définissez-en un pour vous connecter sans attendre d’e-mail.'}</div>
      <PasswordForm user={user} />
      <Btn variant="ghost" onClick={async () => { await signOut(); navigate('/', { replace: true }); }}><LogOut size={15} /> Se déconnecter</Btn>
    </section>
  );
}

export default function SettingsPage() {
  useEffect(() => { document.title = 'Paramètres | Atelier Logistique'; }, []);
  return (
    <>
      <PageHeader title="Paramètres">
        <nav className="px-5 sm:px-8 flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {SETTINGS_TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end}
              className={({ isActive }) => `shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 -mb-px ${isActive ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              <t.icon size={15} /> {t.label}
            </NavLink>
          ))}
        </nav>
      </PageHeader>
      <Routes>
        <Route index element={<div className="px-5 sm:px-8 py-6"><CompanyTab /></div>} />
        <Route path="equipe" element={<TeamPage inSettings />} />
        <Route path="api" element={<ApiKeysPage inSettings />} />
        <Route path="compte" element={<div className="px-5 sm:px-8 py-6"><AccountTab /></div>} />
        <Route path="*" element={<Navigate to="/app/parametres" replace />} />
      </Routes>
    </>
  );
}
