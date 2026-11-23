import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, UserRound, LogOut, Save, Loader2 } from 'lucide-react';
import { useEspace } from '../useEspace';
import { renameOrganization, signOut } from '../data';
import { PageHeader, Btn } from '../ui';
import PasswordForm, { hasPassword } from '../PasswordForm';

const ROLE = { owner: 'Propriétaire', admin: 'Administrateur', member: 'Membre' };

export default function SettingsPage() {
  const { org, user, reloadOrgs } = useEspace();
  const navigate = useNavigate();
  const [name, setName] = useState(org.name);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { document.title = 'Paramètres | Atelier Logistique'; }, []);
  const admin = org.role === 'owner' || org.role === 'admin';
  const save = async () => {
    setBusy(true); setMsg('');
    try { await renameOrganization(org.id, name); await reloadOrgs(); setMsg('Enregistré.'); } catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  return (
    <>
      <PageHeader title="Paramètres" />
      <div className="px-5 sm:px-8 py-6 grid lg:grid-cols-2 gap-5 max-w-5xl">
        <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-slate-900"><Building2 size={17} /> Entreprise</div>
          <label className="block text-xs text-slate-500">Nom
            <input value={name} onChange={(e) => setName(e.target.value)} disabled={!admin}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50" /></label>
          <div className="text-sm text-slate-600">Votre rôle : <b>{ROLE[org.role] ?? org.role}</b></div>
          <div className="text-sm text-slate-600">Chargements conservés <b>{org.retention_days} jours</b>, puis supprimés automatiquement.</div>
          {admin && <Btn onClick={save} disabled={busy || name.trim().length < 2}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer</Btn>}
          {msg && <div className="text-sm text-slate-600">{msg}</div>}
        </section>
        <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-slate-900"><UserRound size={17} /> Mon compte</div>
          <div className="text-sm text-slate-600">{user.email}</div>
          <div className="text-xs text-slate-500">{hasPassword(user) ? 'Connexion par e-mail et mot de passe (ou par lien envoyé par e-mail).' : 'Pas encore de mot de passe : définissez-en un pour vous connecter sans attendre d’e-mail.'}</div>
          <PasswordForm user={user} />
          <Btn variant="ghost" onClick={async () => { await signOut(); navigate('/', { replace: true }); }}><LogOut size={15} /> Se déconnecter</Btn>
        </section>
      </div>
    </>
  );
}
