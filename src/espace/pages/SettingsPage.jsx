// /app/parametres : tout le paramétrage, en onglets.
//   Entreprise · Tables de référence · Équipe · API et notifications · Mon compte

import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Building2, UserRound, LogOut, Save, Loader2, Users, KeyRound, Database, Languages, CheckCircle2 } from 'lucide-react';
import { useEspace } from '../useEspace';
import { renameOrganization, saveOrganizationUnits, signOut, ROLES } from '../data';
import UnitsPicker from '../UnitsPicker';
import { prefsOf } from '../../shared/units/units';
import { PageHeader, Btn } from '../ui';
import PasswordForm, { hasPassword } from '../PasswordForm';
import { usesSso, saveAccountLang } from '../../shared/account/supabase';
import { useT, useLang } from '../../shared/i18n/I18nProvider.jsx';
import { N_ } from '../../shared/i18n/core';
import LangSwitch from '../../shared/i18n/LangSwitch';
import { rememberLang } from '../../shared/i18n/userLang';
import TeamPage from './TeamPage';
import ApiKeysPage from './ApiKeysPage';
import ReferencesPage from './ReferencesPage';

export const SETTINGS_TABS = [
  { to: '/app/parametres', end: true, icon: Building2, label: N_('Entreprise') },
  { to: '/app/parametres/references', icon: Database, label: N_('Tables de référence') },
  { to: '/app/parametres/equipe', icon: Users, label: N_('Équipe') },
  { to: '/app/parametres/api', icon: KeyRound, label: N_('API et notifications') },
  { to: '/app/parametres/compte', icon: UserRound, label: N_('Mon compte') },
];

function CompanyTab() {
  const { org, reloadOrgs } = useEspace();
  const t = useT();
  const [name, setName] = useState(org.name);
  const [prefs, setPrefs] = useState(() => prefsOf(org, t.lang));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const admin = org.role === 'owner' || org.role === 'admin';
  const save = async () => {
    setBusy(true); setMsg('');
    try {
      await renameOrganization(org.id, name);
      const before = prefsOf(org, t.lang);
      if (prefs.units !== before.units || prefs.currency !== before.currency || org.units == null) await saveOrganizationUnits(org.id, prefs);
      await reloadOrgs(); setMsg(t('Enregistré.'));
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  return (
    <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-3 max-w-xl">
      <div className="flex items-center gap-2 font-semibold text-slate-900"><Building2 size={17} /> {t('Entreprise')}</div>
      <label className="block text-xs text-slate-500">{t('Nom')}
        <input value={name} onChange={(e) => setName(e.target.value)} disabled={!admin}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50" /></label>
      <div className="space-y-1.5 pt-1">
        <div className="text-xs text-slate-500">{t('Unités et devise')}</div>
        <UnitsPicker value={prefs} onChange={setPrefs} disabled={!admin} />
        <div className="text-xs text-slate-400">{t('Saisie et affichage des dimensions, poids, volumes et montants. Les données enregistrées ne changent pas.')}</div>
      </div>
      <div className="text-sm text-slate-600">{t('Votre rôle :')} <b>{ROLES[org.role] ?? org.role}</b></div>
      <div className="text-sm text-slate-600">{t('Chargements conservés {n} jours, puis supprimés automatiquement.', { n: org.retention_days })}</div>
      {admin && <Btn onClick={save} disabled={busy || name.trim().length < 2}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {t('Enregistrer')}</Btn>}
      {msg && <div className="text-sm text-slate-600">{msg}</div>}
    </section>
  );
}

/** Langue de l'interface : enregistrée sur le compte, appliquée tout de suite. */
function LanguageSetting() {
  const t = useT();
  const lang = useLang();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const change = async (l) => {
    if (l === lang) return;
    setBusy(true); setMsg(null);
    try { await saveAccountLang(l); rememberLang(l); setMsg({ ok: true }); } catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  };
  return (
    <div className="space-y-2 pt-3 border-t border-slate-100">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-800"><Languages size={15} /> {t('Langue de l’interface')}</div>
      <div className="flex flex-wrap items-center gap-3">
        <LangSwitch value={lang} onChange={change} full disabled={busy} label={t('Langue de l’interface')} />
        {busy && <Loader2 size={15} className="animate-spin text-slate-400" />}
        {msg?.ok && <span className="text-sm text-emerald-700 flex items-center gap-1"><CheckCircle2 size={14} /> {t('Langue enregistrée.')}</span>}
        {msg && !msg.ok && <span className="text-sm text-red-700">{msg.text}</span>}
      </div>
      <div className="text-xs text-slate-500">{t('Tout l’espace, y compris le guide cariste (QR code). Les petits outils du catalogue (ZPL, DDMRP…) restent en français.')}</div>
    </div>
  );
}

function AccountTab() {
  const { user } = useEspace();
  const t = useT();
  const navigate = useNavigate();
  const provider = (user.app_metadata?.providers ?? []).includes('google') ? 'Google' : 'Microsoft';
  return (
    <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-3 max-w-xl">
      <div className="flex items-center gap-2 font-semibold text-slate-900"><UserRound size={17} /> {t('Mon compte')}</div>
      <div className="text-sm text-slate-600">{user.email}</div>
      <div className="text-xs text-slate-500">{usesSso(user)
        ? (hasPassword(user) ? t('Connexion avec {p}, ou par e-mail et mot de passe.', { p: provider }) : t('Connexion avec {p}. Vous pouvez aussi définir un mot de passe.', { p: provider }))
        : hasPassword(user) ? t('Connexion par e-mail et mot de passe.') : t('Pas encore de mot de passe : définissez-en un pour vous connecter sans attendre d’e-mail.')}</div>
      <PasswordForm user={user} />
      <LanguageSetting />
      <div className="pt-3 border-t border-slate-100">
        <Btn variant="ghost" onClick={async () => { await signOut(); navigate('/', { replace: true }); }}><LogOut size={15} /> {t('Se déconnecter')}</Btn>
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const t = useT();
  useEffect(() => { document.title = `${t('Paramètres')} | Atelier Logistique`; }, [t]);
  return (
    <>
      <PageHeader title={t('Paramètres')}>
        <nav className="px-5 sm:px-8 flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {SETTINGS_TABS.map((tab) => (
            <NavLink key={tab.to} to={tab.to} end={tab.end}
              className={({ isActive }) => `shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 -mb-px ${isActive ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              <tab.icon size={15} /> {t(tab.label)}
            </NavLink>
          ))}
        </nav>
      </PageHeader>
      <Routes>
        <Route index element={<div className="px-5 sm:px-8 py-6"><CompanyTab /></div>} />
        <Route path="references/*" element={<ReferencesPage />} />
        <Route path="equipe" element={<TeamPage inSettings />} />
        <Route path="api" element={<ApiKeysPage inSettings />} />
        <Route path="compte" element={<div className="px-5 sm:px-8 py-6"><AccountTab /></div>} />
        <Route path="*" element={<Navigate to="/app/parametres" replace />} />
      </Routes>
    </>
  );
}
