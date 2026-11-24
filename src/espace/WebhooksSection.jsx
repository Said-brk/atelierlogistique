// Notifications automatiques (webhooks) : l'entreprise déclare l'adresse de son WMS / ERP, qui reçoit un
// POST JSON signé à chaque changement de statut d'un chargement. Page « Clés d'API », administrateurs.

import { useCallback, useEffect, useState } from 'react';
import { Bell, Plus, Loader2, Send, Trash2, Eye, EyeOff, Copy, Check, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import {
  WEBHOOK_EVENTS, listWebhooks, createWebhook, updateWebhook, deleteWebhook, testWebhook, listDeliveries,
} from './data';
import { Btn, fmtDateTime } from './ui';

const EVENT_LABEL = Object.fromEntries([...WEBHOOK_EVENTS.map((e) => [e.id, e.label]), ['ping', 'Test']]);

function Secret({ value }) {
  const [show, setShow] = useState(false);
  const [ok, setOk] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1800); } catch { /* indisponible */ } };
  return (
    <span className="inline-flex items-center gap-1.5">
      <code className="font-jetbrains text-xs text-slate-700">{show ? value : `${value.slice(0, 6)}••••••••`}</code>
      <button type="button" onClick={() => setShow(!show)} title={show ? 'Masquer' : 'Afficher'} className="text-slate-400 hover:text-slate-700">{show ? <EyeOff size={13} /> : <Eye size={13} />}</button>
      <button type="button" onClick={copy} title="Copier le secret" className="text-slate-400 hover:text-slate-700">{ok ? <Check size={13} /> : <Copy size={13} />}</button>
    </span>
  );
}

const StatusIcon = ({ d }) => (d.status === 'ok' ? <CheckCircle2 size={14} className="text-emerald-600" />
  : d.status === 'failed' ? <XCircle size={14} className="text-red-600" /> : <Clock size={14} className="text-amber-600" />);

export default function WebhooksSection({ orgId }) {
  const [hooks, setHooks] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState(WEBHOOK_EVENTS.map((e) => e.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [h, d] = await Promise.all([listWebhooks(orgId), listDeliveries(orgId)]);
      setHooks(h); setDeliveries(d);
    } catch (e) {
      setHooks([]);
      setError(/does not exist|schema cache/i.test(e.message) ? 'La base n’a pas encore les notifications : exécutez le script 20261124000005_webhooks.sql dans Supabase.' : e.message);
    }
  }, [orgId]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn) => { setError(''); try { await fn(); await load(); } catch (e) { setError(e.message); } };
  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    await run(async () => { await createWebhook(orgId, url, events); setUrl(''); });
    setBusy(false);
  };
  const toggleEvent = (id) => setEvents((ev) => (ev.includes(id) ? ev.filter((x) => x !== id) : [...ev, id]));

  return (
    <section className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 font-semibold text-slate-900">
        <Bell size={17} /> Notifications automatiques (webhooks)
        <button onClick={load} title="Actualiser" className="ml-auto text-slate-400 hover:text-slate-700"><RefreshCw size={15} /></button>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-sm text-slate-600">Votre WMS / ERP est prévenu tout de suite quand un chargement est validé, envoyé au quai, annulé ou rouvert : plus besoin d’interroger l’API. Chaque envoi est signé avec le secret du webhook (voir la <a href="/api#notifications" target="_blank" rel="noreferrer" className="text-blue-700 underline">documentation</a>).</p>

        <form onSubmit={add} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://wms.mon-entreprise.fr/atelier-logistique"
              className="flex-1 min-w-[260px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            <Btn type="submit" disabled={busy || events.length === 0}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Ajouter</Btn>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            {WEBHOOK_EVENTS.map((ev) => (
              <label key={ev.id} className="inline-flex items-center gap-1.5"><input type="checkbox" checked={events.includes(ev.id)} onChange={() => toggleEvent(ev.id)} /> {ev.label}</label>
            ))}
          </div>
        </form>
        {error && <div className="text-sm text-red-700">{error}</div>}

        {hooks === null ? <div className="flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div> : hooks.map((h) => (
          <div key={h.id} className={`rounded-lg border p-3 space-y-2 ${h.active ? 'border-slate-200' : 'border-slate-200 bg-slate-50 opacity-70'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-jetbrains text-sm text-slate-900 break-all flex-1 min-w-[200px]">{h.url}</span>
              {h.last_status != null && (
                <span className={`text-xs rounded-full px-2 py-0.5 ${h.last_status >= 200 && h.last_status < 300 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {h.last_status || 'sans réponse'} · {fmtDateTime(h.last_delivery_at)}
                </span>
              )}
              {h.failure_count >= 3 && <span className="text-xs text-red-700">{h.failure_count} échecs de suite</span>}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>Évènements : {h.events.map((e) => EVENT_LABEL[e] ?? e).join(', ')}</span>
              <span>Secret : <Secret value={h.secret} /></span>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <button onClick={() => run(() => testWebhook(h.id))} disabled={!h.active} className="inline-flex items-center gap-1 text-blue-700 hover:underline disabled:opacity-40"><Send size={13} /> Envoyer un test</button>
              <button onClick={() => run(() => updateWebhook(h.id, { active: !h.active }))} className="text-slate-600 hover:underline">{h.active ? 'Désactiver' : 'Réactiver'}</button>
              <button onClick={() => window.confirm('Supprimer ce webhook ?') && run(() => deleteWebhook(h.id))} className="inline-flex items-center gap-1 text-slate-500 hover:text-red-700"><Trash2 size={13} /> Supprimer</button>
            </div>
          </div>
        ))}

        {deliveries.length > 0 && (
          <div>
            <div className="text-xs font-jetbrains text-slate-400 mb-1.5">DERNIERS ENVOIS</div>
            <div className="divide-y divide-slate-100 text-sm">
              {deliveries.map((d) => (
                <div key={d.id} className="py-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <StatusIcon d={d} />
                  <span className="text-slate-800">{EVENT_LABEL[d.event] ?? d.event}</span>
                  {d.shipment_code && <span className="font-jetbrains text-xs text-slate-500">{d.shipment_code}</span>}
                  <span className="text-xs text-slate-400">{fmtDateTime(d.created_at)}</span>
                  <span className="ml-auto text-xs text-slate-500">
                    {d.status === 'ok' ? `HTTP ${d.http_status}` : d.status === 'failed' ? `échec : ${d.error ?? ''}` : d.status === 'pending' ? `nouvel essai ${fmtDateTime(d.next_attempt_at)} (${d.error ?? ''})` : 'envoyé, réponse attendue'}
                    {d.attempt > 1 && ` · ${d.attempt} essais`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
