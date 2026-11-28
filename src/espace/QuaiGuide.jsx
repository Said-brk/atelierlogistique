// /q/:token : plan de chargement enregistré, ouvert par le cariste sans compte (QR code de la fiche,
// lien envoyé par SMS / WhatsApp). Affiche toujours la dernière version enregistrée du chargement.
// Flotte : le cariste choisit son camion (ou ?camion=N, QR de la fiche de ce camion).

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2, Truck, ChevronRight, ChevronLeft, AlertTriangle, RefreshCw } from 'lucide-react';
import LoadingGuide from '../outils/optimiseur-chargement/guide/LoadingGuide.jsx';
import { payloadLang } from '../outils/optimiseur-chargement/guide/planLink';
import { I18nProvider } from '../shared/i18n/I18nProvider.jsx';
import { accountEnabled } from '../shared/account/supabase';
import { shipmentByToken, confirmLoadingWithPhotos } from './data';
import { shrinkPhoto } from '../outils/optimiseur-chargement/guide/ConfirmLoading';

const font = { fontFamily: "'DM Sans', system-ui, sans-serif" };
const Message = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center p-6 text-center text-slate-700" style={font}>
    <div className="max-w-sm"><Truck className="mx-auto mb-3 text-slate-400" />{children}</div>
  </div>
);

function TruckPicker({ s, guides, onPick }) {
  const done = new Set(s.loaded_trucks ?? []);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" style={font}>
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="font-jetbrains text-[10px] text-slate-500">GUIDE DE CHARGEMENT</div>
        <div className="font-bricolage font-semibold">{s.code}{s.label ? ` · ${s.label}` : ''}</div>
      </header>
      <main className="p-4 space-y-3">
        <h1 className="font-bricolage font-bold text-xl">Quel camion chargez-vous ?</h1>
        {guides.map((g) => (
          <button key={g.index} onClick={() => onPick(g.index)}
            className="w-full flex items-center gap-3 rounded-xl bg-white border border-slate-200 px-4 py-4 text-left active:bg-blue-50">
            <span className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0">{g.index}</span>
            <span className="flex-1 min-w-0"><span className="block font-semibold truncate">{g.label.replace(/^\d+\.\s*/, '')}</span>
              <span className="block text-sm text-slate-500">{g.units} colis · {done.has(g.index)
                ? <b className="text-violet-700">chargé ✓</b> : <b className="text-amber-700">à charger</b>}</span></span>
            <ChevronRight className="text-slate-400" />
          </button>
        ))}
      </main>
    </div>
  );
}

const DOCK = ['sent', 'partially_loaded', 'loaded'];
const REOPENED = ['new', 'in_progress', 'validated'];
const hhmm = (d) => (d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '');

/**
 * Alertes du cariste, sans jamais le bloquer :
 *  - chargement rouvert au bureau (qui, à quelle heure) ;
 *  - nouvelle version du plan renvoyée au quai → bouton pour l'afficher.
 */
function DockAlerts({ shown, live, en, onUpdate }) {
  if (!live) return null;
  const reopened = REOPENED.includes(live.status) && !!live.sent_at;
  const newPlan = !reopened && DOCK.includes(live.status) && live.version !== shown.version
    && JSON.stringify(live.result?.plan ?? null) !== JSON.stringify(shown.result?.plan ?? null);
  if (reopened) {
    const who = live.reopened_by ? (en ? ` by ${live.reopened_by}` : ` par ${live.reopened_by}`) : '';
    const at = live.reopened_at ? (en ? ` at ${hhmm(live.reopened_at)}` : ` à ${hhmm(live.reopened_at)}`) : '';
    return (
      <div role="alert" className="flex items-start gap-2 bg-amber-100 border-b border-amber-300 text-amber-900 text-sm px-4 py-2.5" style={font}>
        <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600" />
        <span><b>{en ? `Reopened at the office${who}${at}.` : `Chargement rouvert au bureau${who}${at}.`}</b>{' '}
          {en ? 'The plan may change. You can keep loading and confirm your truck.' : 'Le plan peut encore changer. Vous pouvez continuer à charger et confirmer votre camion.'}</span>
      </div>
    );
  }
  if (newPlan) {
    return (
      <div role="alert" className="flex items-center gap-2 bg-blue-50 border-b border-blue-200 text-blue-900 text-sm px-4 py-2.5" style={font}>
        <RefreshCw size={16} className="shrink-0 text-blue-600" />
        <span className="flex-1">{en ? `New plan sent by the office (v${live.version}).` : `Nouveau plan envoyé par le bureau (v${live.version}).`}</span>
        <button onClick={onUpdate} className="rounded-md bg-blue-600 text-white font-semibold px-3 py-1.5">{en ? 'Show' : 'Afficher'}</button>
      </div>
    );
  }
  return null;
}

export default function QuaiGuide() {
  const { token } = useParams();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState({ loading: true });
  const [live, setLive] = useState(null); // dernière lecture (toutes les 20 s) : alertes sans recharger le plan affiché

  useEffect(() => {
    if (!accountEnabled) { setState({ error: 'Lien indisponible.' }); return; }
    shipmentByToken(token)
      .then((s) => setState(s ? { shipment: s } : { error: 'Ce lien de chargement a expiré, a été annulé ou n’existe pas. Demandez un nouveau QR code au bureau.' }))
      .catch(() => setState({ error: 'Impossible d’ouvrir le chargement. Vérifiez la connexion et réessayez.' }));
  }, [token]);
  // Suivi pendant le chargement : réouverture au bureau, nouveau plan, camions confirmés.
  const loaded = !!state.shipment;
  useEffect(() => {
    if (!loaded) return undefined;
    const tick = () => { if (document.visibilityState !== 'hidden') shipmentByToken(token).then((s) => s && setLive(s)).catch(() => {}); };
    const t = setInterval(tick, 20000);
    window.addEventListener('focus', tick); document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick); };
  }, [token, loaded]);

  if (state.loading) return <div className="min-h-screen flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;
  if (state.error) return <Message>{state.error}</Message>;

  const s = state.shipment;
  const lang = payloadLang((s.result?.plan?.guides?.[0]?.guide) ?? s.result?.plan?.guide) ?? 'fr';
  const alerts = <DockAlerts shown={s} live={live ?? s} en={lang === 'en'} onUpdate={() => { setState({ shipment: live }); }} />;
  const plan = s.result?.plan;
  const guides = Array.isArray(plan?.guides) ? plan.guides : null;
  const picked = guides ? guides.find((g) => String(g.index) === params.get('camion')) : null;
  const notReady = <Message>Le plan de {s.code} n’est pas encore prêt. Demandez au bureau de lancer l’optimisation et d’enregistrer.</Message>;

  if (guides && !picked) {
    if (guides.length === 0) return notReady;
    return <>{alerts}<TruckPicker s={{ ...s, loaded_trucks: (live ?? s).loaded_trucks }} guides={guides} onPick={(n) => setParams({ camion: String(n) })} /></>;
  }
  const payload = picked ? picked.guide : plan?.guide;
  if (!payload) return notReady;
  const final = ['validated', 'sent', 'partially_loaded', 'loaded'].includes(s.status);
  // Confirmation de fin de chargement : chargement au quai, ou rouvert au bureau après un envoi (alerte, pas de blocage).
  const cur = live ?? s;
  const reopened = REOPENED.includes(cur.status) && !!cur.sent_at;
  const atDock = DOCK.includes(cur.status) || reopened;
  const truckNo = picked?.index ?? 1;
  // Fin de chargement : photos réduites puis envoyées, confirmation dans la base (statut « Chargé »).
  const onConfirm = async ({ files, name }) => confirmLoadingWithPhotos(token, truckNo, name, await Promise.all(files.map((f) => shrinkPhoto(f))));
  const confirmedAt = (cur.loaded_trucks ?? []).includes(truckNo) ? (cur.loaded_at ?? new Date().toISOString()) : null;
  const truck = picked ? ` · camion ${picked.index}/${guides.length}` : '';
  const notice = `${s.code}${s.label ? ` · ${s.label}` : ''}${truck} · v${s.version}${reopened ? ' · rouvert au bureau' : atDock ? '' : final ? ' · pas encore envoyé au quai : confirmation possible une fois envoyé' : ' · en cours de modification au bureau : attendez qu’il soit renvoyé au quai'}`;
  return (
    <I18nProvider lang={payloadLang(payload) ?? 'fr'}>
      {alerts}
      {picked && guides.length > 1 && (
        <button onClick={() => setParams({})} className="w-full flex items-center gap-1 bg-blue-600 text-white text-sm px-4 py-2" style={font}>
          <ChevronLeft size={16} /> Changer de camion
        </button>
      )}
      {/* La progression est mémorisée par plan (donc par camion) sur ce téléphone. */}
      <LoadingGuide key={`${token}-${s.version}-${picked?.index ?? 0}`} payload={payload} notice={notice} warn={!atDock} onConfirm={atDock ? onConfirm : null} confirmedAt={confirmedAt} />
    </I18nProvider>
  );
}
