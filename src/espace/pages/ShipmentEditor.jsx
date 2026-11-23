// Éditeur d'un chargement : en-tête commun + optimiseur de chargement intégré, pré-rempli.
// Liens : palettisations qui alimentent ce chargement (chargement → palettes).

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2, QrCode } from 'lucide-react';
import LoadOptimizer from '../../outils/optimiseur-chargement/LoadOptimizer.jsx';
import { useEspace } from '../useEspace';
import { getShipment, createShipment, updateShipment, palletizationsOfShipment, shareUrlOf, SOURCE } from '../data';
import GuideQrModal from '../../outils/optimiseur-chargement/guide/GuideQrModal';
import { EditorHeader, DocChip, Btn, editorInputCls, pct } from '../ui';
import useDocEditor, { initialOf } from '../useDocEditor';

/** /app/chargements/nouveau : crée un chargement vide puis ouvre l'éditeur. */
export function NewShipment() {
  const { org } = useEspace();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    createShipment(org.id).then((code) => navigate(`/app/chargements/${code}`, { replace: true })).catch((e) => setError(e.message));
  }, [org.id, navigate]);
  return <div className="p-10 flex justify-center text-slate-400">{error ? <span className="text-red-700 text-sm">{error}</span> : <Loader2 className="animate-spin" />}</div>;
}

export default function ShipmentEditor() {
  const { code } = useParams();
  const ed = useDocEditor({ code, load: getShipment, update: updateShipment, titleOf: (d) => d.label ?? 'Chargement' });
  const [pzs, setPzs] = useState([]);
  const [quaiOpen, setQuaiOpen] = useState(false);
  useEffect(() => { if (ed.doc?.id) palletizationsOfShipment(ed.doc.id).then(setPzs).catch(() => setPzs([])); }, [ed.doc?.id]);

  if (ed.doc === undefined) return <div className="p-10 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;
  if (ed.doc === null) return <div className="p-10 text-center text-slate-500">Chargement introuvable. <Link to="/app/chargements" className="text-blue-700">Retour à la liste</Link></div>;

  const s = ed.summary;
  const plan = ed.doc.result?.plan;
  const sent = ed.doc.status === 'sent';
  // Le lien permanent ne sert que si le plan affiché est celui enregistré (sinon : lien avec le plan dedans).
  const ready = (p) => !!(p?.guide || p?.guides?.length);
  const shareUrl = !ed.dirty && ready(plan) ? shareUrlOf(ed.doc) : null;
  // Envoyer au quai : enregistre (statut « Envoyé »), puis affiche le QR code et le lien permanents.
  const sendToDock = async () => {
    const d = !ed.dirty && sent ? ed.doc : await ed.save('sent');
    if (ready(d?.result?.plan)) setQuaiOpen(true);
    else if (d) alert('Le plan n’est pas prêt : lancez l’optimisation, attendez la fin du calcul, puis renvoyez.'); // eslint-disable-line no-alert
  };
  return (
    <>
      <EditorHeader backTo="/app/chargements" backTitle="Retour aux chargements" doc={ed.doc} meta={ed.meta} onMeta={ed.setMeta}
        dirty={ed.dirty} saving={ed.saving} onSave={ed.save} canValidate={!!s} validateHint="Lancez d’abord l’optimisation"
        sourceLabel={SOURCE[ed.doc.source]} error={ed.error}
        actions={<Btn variant="amber" onClick={sendToDock} disabled={ed.saving || !s} title={s ? 'QR code et lien du plan pour le cariste, sans compte' : 'Lancez d’abord l’optimisation'}>
          <QrCode size={15} /> {sent ? 'QR quai' : <><span className="sm:hidden">Quai</span><span className="hidden sm:inline">Envoyer au quai</span></>}</Btn>}
        extraFields={<label className="flex items-center gap-2 text-slate-500">Départ
          <input type="date" value={ed.meta.departure_at} onChange={(e) => ed.setMeta({ ...ed.meta, departure_at: e.target.value })} className={editorInputCls} /></label>}
        links={pzs.length > 0 && <span className="flex flex-wrap items-center gap-1.5 text-slate-500 text-xs">Palettes issues de
          {pzs.map((p) => <DocChip key={p.code} kind="pallet" to={`/app/palettisations/${p.code}`} code={p.code} title={p.label ?? ''} />)}</span>}
        summary={s && `${s.fleet ? 'Flotte' : 'Plan'} : ${s.vehicle} · ${s.packed} colis · ${s.fleet ? 'moy. ' : ''}${pct(s.fill)}${s.unpacked ? ` · ${s.unpacked} non chargé(s)` : ''}${s.edited ? ' · modifié à la main' : ''}`} />
      <LoadOptimizer key={ed.doc.id} workspace={{ initial: initialOf(ed.doc), onChange: ed.onChange, shareUrl }} />
      {quaiOpen && <GuideQrModal url={shareUrlOf(ed.doc)} onClose={() => setQuaiOpen(false)} title={`${ed.doc.code} · plan pas à pas pour le cariste`}
        note="Lien permanent : il affiche toujours la dernière version enregistrée. Si vous modifiez le plan, enregistrez : le cariste voit la nouvelle version." />}
    </>
  );
}
