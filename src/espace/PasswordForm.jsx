// Définir / changer le mot de passe (Paramètres, et bandeau du tableau de bord après une connexion par lien).
import { useState } from 'react';
import { Loader2, KeyRound, CheckCircle2 } from 'lucide-react';
import { setPassword } from './data';
import { Btn } from './ui';
import { useT } from '../shared/i18n/I18nProvider.jsx';

export const hasPassword = (user) => !!user?.user_metadata?.has_password;

export default function PasswordForm({ user, compact = false, onDone = null }) {
  const t = useT();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const ok = pw.length >= 8 && pw === pw2;
  const submit = async (e) => {
    e.preventDefault();
    if (!ok) return;
    setBusy(true); setMsg(null);
    try { await setPassword(pw); setPw(''); setPw2(''); setMsg({ ok: true, text: t('Mot de passe enregistré : connectez-vous désormais avec votre e-mail et ce mot de passe.') }); onDone?.(); } catch (err) { setMsg({ ok: false, text: err.message }); }
    setBusy(false);
  };
  const cls = 'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200';
  return (
    <form onSubmit={submit} className={compact ? 'flex flex-wrap items-center gap-2' : 'space-y-2'}>
      {/* Champ e-mail caché : le gestionnaire de mots de passe du navigateur associe le mot de passe au bon compte. */}
      <input type="email" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
      <input type="password" autoComplete="new-password" placeholder={hasPassword(user) ? t('Nouveau mot de passe') : t('Mot de passe (8 car. min.)')} value={pw} onChange={(e) => setPw(e.target.value)} className={`${cls} ${compact ? 'w-56' : 'w-full'}`} />
      <input type="password" autoComplete="new-password" placeholder={t('Confirmer')} value={pw2} onChange={(e) => setPw2(e.target.value)} className={`${cls} ${compact ? 'w-40' : 'w-full'}`} />
      <Btn type="submit" disabled={busy || !ok} title={pw && pw2 && pw !== pw2 ? t('Les deux mots de passe sont différents.') : ''}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} {hasPassword(user) ? t('Changer') : t('Enregistrer')}</Btn>
      {pw2 && pw !== pw2 && <span className="text-xs text-amber-700">{t('Les deux mots de passe sont différents.')}</span>}
      {msg && <span className={`text-sm flex items-center gap-1 ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{msg.ok && <CheckCircle2 size={14} />}{msg.text}</span>}
    </form>
  );
}
