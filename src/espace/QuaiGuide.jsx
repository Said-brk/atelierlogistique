// /q/:token : plan de chargement enregistré, ouvert par le cariste sans compte (QR code de la fiche,
// lien envoyé par SMS / WhatsApp). Affiche toujours la dernière version enregistrée du chargement.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Truck } from 'lucide-react';
import LoadingGuide from '../outils/optimiseur-chargement/guide/LoadingGuide.jsx';
import { payloadLang } from '../outils/optimiseur-chargement/guide/planLink';
import { I18nProvider } from '../shared/i18n/I18nProvider.jsx';
import { accountEnabled } from '../shared/account/supabase';
import { shipmentByToken } from './data';

const Message = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center p-6 text-center text-slate-700" style={{ fontFamily: "'DM Sans', system-ui" }}>
    <div className="max-w-sm"><Truck className="mx-auto mb-3 text-slate-400" />{children}</div>
  </div>
);

export default function QuaiGuide() {
  const { token } = useParams();
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
  const payload = s.result?.plan?.guide;
  if (!payload) return <Message>Le plan de {s.code} n’est pas encore prêt. Demandez au bureau de lancer l’optimisation et d’enregistrer.</Message>;
  const final = s.status === 'validated' || s.status === 'sent';
  const notice = `${s.code}${s.label ? ` · ${s.label}` : ''} · v${s.version}${final ? '' : ' · plan pas encore validé, il peut encore changer'}`;
  // La version entre dans la clé de progression : un plan modifié repart du début.
  return (
    <I18nProvider lang={payloadLang(payload) ?? 'fr'}>
      <LoadingGuide key={`${token}-${s.version}`} payload={payload} notice={notice} warn={!final} />
    </I18nProvider>
  );
}
