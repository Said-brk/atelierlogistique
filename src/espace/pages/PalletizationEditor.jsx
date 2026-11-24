// Éditeur d'une palettisation : en-tête commun + palettisation 3D intégrée, pré-remplie.
// « Charger le camion » : choix d'un nouveau chargement ou d'un chargement en cours (Nouveau / En cours),
// puis ouverture avec les palettes ; le chargement affiche en retour « Palettes issues de PZ-… ».

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Palletizer from '../../outils/palettisation/Palletizer.jsx';
import { useEspace } from '../useEspace';
import { getPalletization, createPalletization, updatePalletization, createShipmentForPalletization, linkPalletization, SOURCE } from '../data';
import LoadTruckDialog from '../LoadTruckDialog';
import { EditorHeader, DocChip } from '../ui';
import useDocEditor, { initialOf } from '../useDocEditor';

export function NewPalletization() {
  const { org } = useEspace();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    createPalletization(org.id).then((code) => navigate(`/app/palettisations/${code}`, { replace: true })).catch((e) => setError(e.message));
  }, [org.id, navigate]);
  return <div className="p-10 flex justify-center text-slate-400">{error ? <span className="text-red-700 text-sm">{error}</span> : <Loader2 className="animate-spin" />}</div>;
}

export default function PalletizationEditor() {
  const { code } = useParams();
  const { org } = useEspace();
  const navigate = useNavigate();
  const ed = useDocEditor({ code, load: getPalletization, update: updatePalletization, titleOf: (d) => d.label ?? 'Palettisation' });

  // Les palettes sont déjà mises de côté pour l'optimiseur (sendHandoff, marquées du n° de la palettisation) :
  // on enregistre, on choisit le chargement, on relie, on l'ouvre (les palettes s'ajoutent à ses lignes).
  const [choosing, setChoosing] = useState(null); // palettisation enregistrée, en attente du choix
  const loadTruck = async () => {
    const saved = await ed.save();
    if (saved) setChoosing(saved);
  };
  const toNew = async () => navigate(`/app/chargements/${await createShipmentForPalletization(org.id, choosing)}`);
  const toExisting = async (s) => navigate(`/app/chargements/${await linkPalletization(choosing, s)}`);

  if (ed.doc === undefined) return <div className="p-10 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;
  if (ed.doc === null) return <div className="p-10 text-center text-slate-500">Palettisation introuvable. <Link to="/app/palettisations" className="text-blue-700">Retour à la liste</Link></div>;

  const s = ed.summary;
  return (
    <>
      <EditorHeader backTo="/app/palettisations" backTitle="Retour aux palettisations" doc={ed.doc} kindColor="#7C3AED" kindBg="#F5F3FF"
        meta={ed.meta} onMeta={ed.setMeta} dirty={ed.dirty} savedAt={ed.savedAt} saving={ed.saving} onSave={ed.save} canValidate={!!s}
        validateHint="Lancez d’abord le calcul" sourceLabel={SOURCE[ed.doc.source]} error={ed.error}
        links={<span className="flex items-center gap-1.5 text-slate-500 text-xs">Chargement {ed.doc.shipments?.code
          ? <DocChip kind="shipment" to={`/app/chargements/${ed.doc.shipments.code}`} code={ed.doc.shipments.code} title={ed.doc.shipments.label ?? ''} />
          : <span className="text-slate-400">— choisi au clic sur « Charger le camion »</span>}</span>}
        summary={s && `${s.pallets} palette(s) · ${s.full} complète(s) · ${s.mixed} mixte(s) · ${Math.round(s.weight).toLocaleString('fr-FR')} kg${s.unplaced ? ` · ${s.unplaced} colis non palettisé(s)` : ''}`} />
      <Palletizer key={ed.doc.id} workspace={{ initial: initialOf(ed.doc), onChange: ed.onChange, origin: ed.doc.code }} onLoadTruck={loadTruck} />
      {choosing && <LoadTruckDialog orgId={org.id} pz={choosing} onNew={toNew} onExisting={toExisting} onClose={() => setChoosing(null)} />}
    </>
  );
}
