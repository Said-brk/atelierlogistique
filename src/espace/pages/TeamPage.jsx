// /app/equipe : membres de l'entreprise, invitations en attente, inviter un collègue.
// L'invitation n'envoie pas d'e-mail toute seule (pas de serveur d'e-mails pendant le POC) :
// l'administrateur envoie le message préparé (e-mail, WhatsApp, copier), le collègue crée son compte
// avec l'adresse invitée et accepte l'invitation à l'entrée de l'espace.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Users, Mail, Copy, Check, Trash2, Loader2, MessageCircle, Clock, LogOut } from 'lucide-react';
import { useEspace } from '../useEspace';
import {
  ROLES, orgMembers, setMemberRole, removeMember, listInvitations, inviteMember, revokeInvitation, invitationMessage,
} from '../data';
import { PageHeader, Btn, fmtDate } from '../ui';

const cell = 'px-4 py-3';
const selectCls = 'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm';

/** Envoyer l'invitation : e-mail, WhatsApp, copier le message. */
function SendInvite({ orgName, email, compact = false }) {
  const [copied, setCopied] = useState(false);
  const m = invitationMessage(orgName, email);
  const copy = async () => { try { await navigator.clipboard.writeText(m.text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* presse-papiers indisponible */ } };
  const btn = 'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700';
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <a className={btn} href={`mailto:${email}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.text)}`}><Mail size={13} /> {compact ? 'E-mail' : 'Envoyer par e-mail'}</a>
      <a className={btn} href={`https://wa.me/?text=${encodeURIComponent(m.text)}`} target="_blank" rel="noreferrer"><MessageCircle size={13} /> WhatsApp</a>
      <button type="button" className={btn} onClick={copy}>{copied ? <><Check size={13} /> Copié</> : <><Copy size={13} /> {compact ? 'Copier' : 'Copier le message'}</>}</button>
    </div>
  );
}

export default function TeamPage() {
  const { org, user, reloadOrgs } = useEspace();
  const navigate = useNavigate();
  const admin = org.role === 'owner' || org.role === 'admin';
  const [members, setMembers] = useState(null);
  const [invites, setInvites] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [justInvited, setJustInvited] = useState(null);

  useEffect(() => { document.title = 'Équipe | Atelier Logistique'; }, []);
  const load = useCallback(async () => {
    try {
      setMembers(await orgMembers(org.id));
      setInvites(admin ? await listInvitations(org.id) : []);
    } catch (e) {
      setError(/function|does not exist|schema cache/i.test(e.message) ? 'La base n’a pas encore la gestion d’équipe : exécutez le script 20261123000003_invitations.sql dans Supabase.' : e.message);
      setMembers([]);
    }
  }, [org.id, admin]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn) => { setError(''); try { await fn(); await load(); } catch (e) { setError(e.message); } };
  const invite = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await inviteMember(org.id, email, role); setJustInvited(email.trim().toLowerCase()); setEmail(''); await load(); } catch (err) { setError(err.message); }
    setBusy(false);
  };
  const leave = async () => {
    if (!window.confirm(`Quitter « ${org.name} » ? Vous n’aurez plus accès à ses chargements.`)) return;
    await run(async () => { await removeMember(org.id, user.id); await reloadOrgs(); navigate('/app', { replace: true }); });
  };

  return (
    <>
      <PageHeader title="Équipe" subtitle={`Les personnes qui travaillent dans « ${org.name} » : elles voient et modifient les mêmes chargements et palettisations.`} />
      <div className="px-5 sm:px-8 py-6 space-y-5 max-w-5xl">
        {admin && (
          <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-slate-900"><UserPlus size={17} /> Inviter un collègue</div>
            <form onSubmit={invite} className="flex flex-wrap items-center gap-2">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@entreprise.com"
                className="flex-1 min-w-[220px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              <select value={role} onChange={(e) => setRole(e.target.value)} className={`${selectCls} py-2`} title="Administrateur : peut aussi inviter, gérer l'équipe et les paramètres">
                <option value="member">Membre</option><option value="admin">Administrateur</option>
              </select>
              <Btn type="submit" disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Inviter</Btn>
            </form>
            {justInvited && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 space-y-2">
                <div className="text-sm text-emerald-800"><b>Invitation créée pour {justInvited}.</b> Envoyez-lui le message : il crée son compte avec cette adresse et rejoint l’entreprise.</div>
                <SendInvite orgName={org.name} email={justInvited} />
              </div>
            )}
            <p className="text-xs text-slate-400">Membre : chargements et palettisations. Administrateur : en plus, l’équipe et les paramètres. Invitation valable 14 jours.</p>
          </section>
        )}

        {error && <div className="text-sm text-red-700">{error}</div>}

        <section className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 font-semibold text-slate-900"><Users size={17} /> Membres {members && <span className="text-slate-400 font-normal">· {members.length}</span>}</div>
          {members === null ? <div className="p-6 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div> : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => {
                  const me = m.user_id === user.id;
                  const editable = admin && !me && m.role !== 'owner';
                  return (
                    <tr key={m.user_id}>
                      <td className={cell}>
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-semibold uppercase">{m.email?.[0]}</span>
                          <span className="text-slate-900 break-all">{m.email}{me && <span className="text-slate-400"> (vous)</span>}</span>
                        </div>
                      </td>
                      <td className={`${cell} w-44`}>
                        {editable
                          ? <select value={m.role} onChange={(e) => run(() => setMemberRole(org.id, m.user_id, e.target.value))} className={selectCls}>
                            <option value="member">Membre</option><option value="admin">Administrateur</option></select>
                          : <span className="text-slate-600">{ROLES[m.role]}</span>}
                      </td>
                      <td className={`${cell} hidden sm:table-cell text-slate-400 text-xs w-32`}>depuis le {fmtDate(m.created_at)}</td>
                      <td className={`${cell} w-28 text-right`}>
                        {editable && <button onClick={() => window.confirm(`Retirer ${m.email} de l’entreprise ?`) && run(() => removeMember(org.id, m.user_id))}
                          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-700"><Trash2 size={13} /> Retirer</button>}
                        {me && m.role !== 'owner' && <button onClick={leave} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-700"><LogOut size={13} /> Quitter</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {admin && invites.length > 0 && (
          <section className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 font-semibold text-slate-900"><Clock size={17} /> Invitations en attente <span className="text-slate-400 font-normal">· {invites.length}</span></div>
            <div className="divide-y divide-slate-100">
              {invites.map((i) => {
                const expired = new Date(i.expires_at) < new Date();
                return (
                  <div key={i.id} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <span className="text-slate-900 break-all flex-1 min-w-[180px]">{i.email}</span>
                    <span className="text-slate-500">{ROLES[i.role]}</span>
                    <span className={`text-xs ${expired ? 'text-red-700' : 'text-slate-400'}`}>{expired ? 'expirée' : `jusqu’au ${fmtDate(i.expires_at)}`}</span>
                    {expired
                      ? <button onClick={() => run(() => inviteMember(org.id, i.email, i.role))} className="text-xs font-medium text-blue-700 hover:underline">Renouveler</button>
                      : <SendInvite orgName={org.name} email={i.email} compact />}
                    <button onClick={() => run(() => revokeInvitation(i.id))} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-700"><Trash2 size={13} /> Annuler</button>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
