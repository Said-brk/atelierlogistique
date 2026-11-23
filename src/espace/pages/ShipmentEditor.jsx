// Éditeur d'un chargement : en-tête commun + optimiseur de chargement intégré, pré-rempli.
// Liens : palettisations qui alimentent ce chargement (chargement → palettes).

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import LoadOptimizer from '../../outils/optimiseur-chargement/LoadOptimizer.jsx';
import { useEspace } from '../useEspace';
import { getShipment, createShipment, updateShipment, palletizationsOfShipment, SOURCE } from '../data';
import { EditorHeader, DocChip, editorInputCls, pct } from '../ui';
import useDocEditor from '../useDocEditor';

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
  useEffect(() => { if (ed.doc?.id) palletizationsOfShipment(ed.doc.id).then(setPzs).catch(() => setPzs([])); }, [ed.doc?.id]);

  if (ed.doc === undefined) return <div className="p-10 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;
  if (ed.doc === null) return <div className="p-10 text-center text-slate-500">Chargement introuvable. <Link to="/app/chargements" className="text-blue-700">Retour à la liste</Link></div>;

  const s = ed.summary;
  return (
    <>
      <EditorHeader backTo="/app/chargements" backTitle="Retour aux chargements" doc={ed.doc} meta={ed.meta} onMeta={ed.setMeta}
        dirty={ed.dirty} saving={ed.saving} onSave={ed.save} canValidate={!!s} validateHint="Lancez d’abord l’optimisation"
        sourceLabel={SOURCE[ed.doc.source]} error={ed.error}
        extraFields={<label className="flex items-center gap-2 text-slate-500">Départ
          <input type="date" value={ed.meta.departure_at} onChange={(e) => ed.setMeta({ ...ed.meta, departure_at: e.target.value })} className={editorInputCls} /></label>}
        links={pzs.length > 0 && <span className="flex flex-wrap items-center gap-1.5 text-slate-500 text-xs">Palettes issues de
          {pzs.map((p) => <DocChip key={p.code} kind="pallet" to={`/app/palettisations/${p.code}`} code={p.code} title={p.label ?? ''} />)}</span>}
        summary={s && `Plan : ${s.vehicle} · ${s.packed} colis · ${pct(s.fill)}${s.unpacked ? ` · ${s.unpacked} non chargé(s)` : ''}${s.edited ? ' · modifié à la main' : ''}`} />
      <LoadOptimizer key={ed.doc.id} workspace={{ initial: { rows: [], ...(ed.doc.input ?? {}) }, onChange: ed.onChange }} />
    </>
  );
}
