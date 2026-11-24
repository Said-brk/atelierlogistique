// Paramètres → API et notifications (/app/parametres/api) : clés d'API (créer, révoquer), consommation, webhooks.
// La clé n'est affichée qu'une fois, à la création : la base n'en garde que l'empreinte.

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Plus, Copy, Check, Loader2, Ban, BookOpen, Activity, AlertTriangle } from 'lucide-react';
import { useEspace } from '../useEspace';
import { listApiKeys, createApiKey, revokeApiKey, apiUsage } from '../data';
import { PageHeader, Btn, fmtDate, fmtDateTime } from '../ui';
import ExampleTabs from '../../shared/api/ExampleTabs';
import WebhooksSection from '../WebhooksSection';
import { createExamples } from '../../shared/api/examples';

function CopyBtn({ text, label = 'Copier' }) {
  const [ok, setOk] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); } catch { /* presse-papiers indisponible */ } };
  return (
    <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
      {ok ? <><Check size={13} /> Copié</> : <><Copy size={13} /> {label}</>}
    </button>
  );
}

export default function ApiKeysPage({ inSettings = false }) {
  const { org } = useEspace();
  const admin = org.role === 'owner' || org.role === 'admin';
  const [keys, setKeys] = useState(null);
  const [usage, setUsage] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null); // { key, prefix, name } — affichée une seule fois

  useEffect(() => { document.title = 'Clés d’API | Atelier Logistique'; }, []);
  const load = useCallback(async () => {
    try {
      const [k, u] = await Promise.all([admin ? listApiKeys(org.id) : Promise.resolve([]), apiUsage(org.id).catch(() => null)]);
      setKeys(k); setUsage(u);
    } catch (e) { setError(e.message); setKeys([]); }
  }, [org.id, admin]);
  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { const k = await createApiKey(org.id, name.trim() || 'WMS'); setCreated({ ...k, name: name.trim() || 'WMS' }); setName(''); await load(); } catch (err) { setError(err.message); }
    setBusy(false);
  };
  const revoke = async (k) => {
    if (!window.confirm(`Révoquer la clé « ${k.name} » (${k.prefix}…) ? Les systèmes qui l’utilisent seront refusés immédiatement.`)) return;
    try { await revokeApiKey(k.id); await load(); } catch (e) { setError(e.message); }
  };

  const active = (keys ?? []).filter((k) => !k.revoked_at);
  return (
    <>
      {!inSettings && <PageHeader title="Clés d’API" />}
      <div className="px-5 sm:px-8 py-6 space-y-5 max-w-5xl">
        <p className="text-sm text-slate-500">Connectez votre WMS ou votre ERP : il envoie ses chargements, Atelier Logistique renvoie le plan et le prévient à chaque étape.</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-white border border-slate-200 p-4"><div className="text-xs text-slate-500 flex items-center gap-1.5"><KeyRound size={13} /> Clés actives</div><div className="text-2xl font-bold text-slate-900 mt-1">{keys ? active.length : '…'}</div></div>
          <div className="rounded-xl bg-white border border-slate-200 p-4"><div className="text-xs text-slate-500 flex items-center gap-1.5"><Activity size={13} /> Appels (30 jours)</div><div className="text-2xl font-bold text-slate-900 mt-1">{usage ? usage.calls : '…'}</div></div>
          <div className="rounded-xl bg-white border border-slate-200 p-4"><div className="text-xs text-slate-500 flex items-center gap-1.5"><AlertTriangle size={13} /> Erreurs (30 jours)</div><div className="text-2xl font-bold text-slate-900 mt-1">{usage ? usage.errors : '…'}</div></div>
        </div>

        {created && (
          <section className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-5 space-y-3">
            <div className="font-semibold text-emerald-900">Clé « {created.name} » créée : copiez-la maintenant.</div>
            <p className="text-sm text-emerald-800">Elle ne sera <b>plus jamais affichée</b>. Gardez-la dans le coffre de votre WMS / ERP (jamais dans un e-mail ni dans le code d’une page web).</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 min-w-0 break-all rounded-lg bg-white border border-emerald-200 px-3 py-2 font-jetbrains text-sm text-slate-900">{created.key}</code>
              <CopyBtn text={created.key} label="Copier la clé" />
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-emerald-900 font-medium">Premier appel (exemple prêt à copier)</summary>
              <ExampleTabs examples={createExamples(created.key)} />
            </details>
            <button onClick={() => setCreated(null)} className="text-sm text-emerald-800 hover:underline">J’ai copié la clé</button>
          </section>
        )}

        {admin ? (
          <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-slate-900"><Plus size={17} /> Nouvelle clé</div>
            <form onSubmit={create} className="flex flex-wrap items-center gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Nom : Reflex WMS, ERP production, test…"
                className="flex-1 min-w-[220px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              <Btn type="submit" disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Créer la clé</Btn>
            </form>
            <p className="text-xs text-slate-400">Une clé par système connecté : vous pourrez en révoquer une sans couper les autres.</p>
          </section>
        ) : (
          <div className="rounded-xl bg-white border border-slate-200 p-5 text-sm text-slate-600">Les clés d’API sont gérées par les administrateurs de l’entreprise.</div>
        )}

        {error && <div className="text-sm text-red-700">{error}</div>}

        {admin && (
          <section className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Clés</div>
            {keys === null ? <div className="p-6 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>
              : keys.length === 0 ? <div className="p-6 text-sm text-slate-500">Aucune clé pour le moment.</div> : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500"><tr>
                    <th className="text-left font-medium px-4 py-2">Nom</th><th className="text-left font-medium px-4 py-2">Clé</th>
                    <th className="text-left font-medium px-4 py-2 hidden sm:table-cell">Créée</th><th className="text-left font-medium px-4 py-2">Dernier appel</th><th />
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {keys.map((k) => (
                      <tr key={k.id} className={k.revoked_at ? 'text-slate-400' : ''}>
                        <td className="px-4 py-3 font-medium">{k.name}</td>
                        <td className="px-4 py-3 font-jetbrains text-xs">{k.prefix}…</td>
                        <td className="px-4 py-3 hidden sm:table-cell">{fmtDate(k.created_at)}</td>
                        <td className="px-4 py-3">{k.last_used_at ? fmtDateTime(k.last_used_at) : 'jamais'}</td>
                        <td className="px-4 py-3 text-right">
                          {k.revoked_at ? <span className="text-xs">révoquée le {fmtDate(k.revoked_at)}</span>
                            : <button onClick={() => revoke(k)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-700"><Ban size={13} /> Révoquer</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </section>
        )}

        {admin && <WebhooksSection orgId={org.id} />}

        <a href="/api" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 p-4 hover:border-blue-300">
          <BookOpen size={20} className="text-blue-700" />
          <span className="flex-1"><span className="block font-semibold text-slate-900">Documentation de l’API</span>
            <span className="block text-sm text-slate-500">Format des lignes, véhicules, flotte, plan renvoyé, erreurs, exemples.</span></span>
        </a>
      </div>
    </>
  );
}
