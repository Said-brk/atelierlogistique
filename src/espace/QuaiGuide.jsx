// /q/:token : plan de chargement enregistré, ouvert par le cariste sans compte (QR code de la fiche,
// lien envoyé par SMS / WhatsApp). Affiche toujours la dernière version enregistrée du chargement.
// Flotte : le cariste choisit son camion (ou ?camion=N, QR de la fiche de ce camion).

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2, Truck, ChevronRight, ChevronLeft } from 'lucide-react';
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
              <span className="block text-sm text-slate-500">{g.units} colis</span></span>
            <ChevronRight className="text-slate-400" />
          </button>
        ))}
      </main>
    </div>
  );
}

export default function QuaiGuide() {
  const { token } = useParams();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    if (!accountEnabled) { setState({ error: 'Lien indisponible.' }); return; }
    shipmentByToken(token)
      .then((s) => setState(s ? { shipment: s } : { error: 'Ce lien de chargement a expiré, a été annulé ou n’existe pas. Demandez un nouveau QR code au bureau.' }))
      .catch(() => setState({ error: 'Impossible d’ouvrir le chargement. Vérifiez la connexion et réessayez.' }));
  }, [token]);

  if (state.loading) return <div className="min-h-screen flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;
  if (state.error) return <Message>{state.error}</Message>;

  const s = state.shipment;
  const plan = s.result?.plan;
  const guides = Array.isArray(plan?.guides) ? plan.guides : null;
  const picked = guides ? guides.find((g) => String(g.index) === params.get('camion')) : null;
  const notReady = <Message>Le plan de {s.code} n’est pas encore prêt. Demandez au bureau de lancer l’optimisation et d’enregistrer.</Message>;

  if (guides && !picked) {
    if (guides.length === 0) return notReady;
    return <TruckPicker s={s} guides={guides} onPick={(n) => setParams({ camion: String(n) })} />;
  }
  const payload = picked ? picked.guide : plan?.guide;
  if (!payload) return notReady;
  const final = ['validated', 'sent', 'loaded'].includes(s.status);
  const truckNo = picked?.index ?? 1;
  // Fin de chargement : photos réduites puis envoyées, confirmation dans la base (statut « Chargé »).
  const onConfirm = async ({ files, name }) => confirmLoadingWithPhotos(token, truckNo, name, await Promise.all(files.map((f) => shrinkPhoto(f))));
  const confirmedAt = (s.loaded_trucks ?? []).includes(truckNo) ? (s.loaded_at ?? new Date().toISOString()) : null;
  const truck = picked ? ` · camion ${picked.index}/${guides.length}` : '';
  const notice = `${s.code}${s.label ? ` · ${s.label}` : ''}${truck} · v${s.version}${final ? '' : ' · plan pas encore validé, il peut encore changer'}`;
  return (
    <I18nProvider lang={payloadLang(payload) ?? 'fr'}>
      {picked && guides.length > 1 && (
        <button onClick={() => setParams({})} className="w-full flex items-center gap-1 bg-blue-600 text-white text-sm px-4 py-2" style={font}>
          <ChevronLeft size={16} /> Changer de camion
        </button>
      )}
      {/* La progression est mémorisée par plan (donc par camion) sur ce téléphone. */}
      <LoadingGuide key={`${token}-${s.version}-${picked?.index ?? 0}`} payload={payload} notice={notice} warn={!final} onConfirm={onConfirm} confirmedAt={confirmedAt} />
    </I18nProvider>
  );
}
