// Éditeur d'une palettisation : en-tête commun + palettisation 3D intégrée, pré-remplie.
// « Charger le camion » : choix d'un nouveau chargement ou d'un chargement en cours (Nouveau / En cours),
// puis ouverture avec les palettes ; le chargement affiche en retour « Palettes issues de PZ-… ».

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Copy, Trash2 } from 'lucide-react';
import Palletizer from '../../outils/palettisation/Palletizer.jsx';
import { useEspace } from '../useEspace';
import { getPalletization, createPalletization, updatePalletization, createShipmentForPalletization, linkPalletization, getShipment, palletRows, deletePalletization, duplicatePalletization, SOURCE } from '../data';
import { tourWarning } from '../tourCheck';
import LoadTruckDialog from '../LoadTruckDialog';
import { EditorHeader, DocChip, ConflictBanner, ReferencesError, DocMenu } from '../ui';
import useDocEditor, { initialOf } from '../useDocEditor';
import useReferences from '../useReferences';
import { t as tr, numLocale } from '../../shared/i18n/core';

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
  const refs = useReferences();
  const ed = useDocEditor({ code, load: getPalletization, update: updatePalletization, titleOf: (d) => d.label ?? tr('Palettisation') });

  // « Charger le camion » : on enregistre, on choisit le chargement, puis ses palettes sont écrites dans ce
  // chargement en base (marquées du n° de la palettisation) avant de l'ouvrir. Annuler ne laisse rien en attente.
  const [choosing, setChoosing] = useState(null); // { pz : palettisation enregistrée, rows : ses palettes }
  const destsOf = (doc) => (doc?.input?.rows ?? []).map((r) => r.destination);
  const loadTruck = async ({ records }) => {
    const saved = await ed.save();
    if (!saved) return;
    // Tournée : simple alerte (jamais bloquante) si les destinations sont dans plusieurs tournées.
    const warn = tourWarning(destsOf(saved), refs.tools);
    if (warn && !window.confirm(warn)) return;
    setChoosing({ pz: saved, rows: palletRows(saved.code, records) });
  };
  const open = (code) => navigate(`/app/chargements/${code}`, { state: { received: { from: choosing.pz.code, count: choosing.rows.reduce((n, r) => n + r.quantity, 0) } } });
  const toNew = async () => open(await createShipmentForPalletization(org.id, choosing.pz, choosing.rows));
  const toExisting = async (s) => {
    const target = await getShipment(s.code).catch(() => null);
    const others = (target?.input?.rows ?? []).filter((r) => r.origin !== choosing.pz.code).map((r) => r.destination);
    const before = tourWarning(destsOf(choosing.pz), refs.tools);
    const warn = tourWarning([...destsOf(choosing.pz), ...others], refs.tools);
    if (warn && warn !== before && !window.confirm(`${tr('En ajoutant ces palettes au chargement {code} :', { code: s.code })}\n\n${warn}`)) return;
    open(await linkPalletization(choosing.pz, s, choosing.rows));
  };

  if (refs.error) return <ReferencesError error={refs.error} onRetry={refs.reload} />;
  if (ed.doc === undefined || refs.items === undefined) return <div className="p-10 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;
  if (ed.doc === null) return <div className="p-10 text-center text-slate-500">{tr('Palettisation introuvable.')} <Link to="/app/palettisations" className="text-blue-700">{tr('Retour à la liste')}</Link></div>;

  const s = ed.summary;
  const duplicate = async () => {
    const d = ed.dirty ? await ed.save() : ed.doc;
    if (d) navigate(`/app/palettisations/${await duplicatePalletization(d)}`);
  };
  const remove = async () => {
    const sh = ed.doc.shipments;
    const msg = tr('Supprimer définitivement {code} ?', { code: ed.doc.code }) + (sh ? `\n\n${tr('Ses palettes seront retirées du chargement {code} (plan à recalculer).', { code: sh.code })}` : '') + `\n\n${tr('Cette action est irréversible.')}`;
    if (!window.confirm(msg)) return;
    try { await deletePalletization(ed.doc.id); ed.discard(); navigate('/app/palettisations', { replace: true }); } catch (e) { alert(e.message); } // eslint-disable-line no-alert
  };
  return (
    <>
      <EditorHeader backTo="/app/palettisations" backTitle={tr('Retour aux palettisations')} doc={ed.doc} kindColor="#7C3AED" kindBg="#F5F3FF"
        meta={ed.meta} onMeta={ed.setMeta} dirty={ed.dirty} savedAt={ed.savedAt} saving={ed.saving} onSave={ed.save} canValidate={!!s}
        validateHint={tr('Lancez d’abord le calcul')} sourceLabel={SOURCE[ed.doc.source]} error={ed.error}
        menu={<DocMenu disabled={ed.saving} items={[
          { label: tr('Dupliquer'), icon: Copy, onClick: duplicate },
          { label: tr('Supprimer…'), icon: Trash2, danger: true, onClick: remove },
        ]} />}
        links={<span className="flex items-center gap-1.5 text-slate-500 text-xs">{tr('Chargement')} {ed.doc.shipments?.code
          ? <DocChip kind="shipment" to={`/app/chargements/${ed.doc.shipments.code}`} code={ed.doc.shipments.code} title={ed.doc.shipments.label ?? ''} />
          : <span className="text-slate-400">{tr('— choisi au clic sur « Charger le camion »')}</span>}</span>}
        summary={s && `${tr('{n} palette(s) · {full} complète(s) · {mixed} mixte(s)', { n: s.pallets, full: s.full, mixed: s.mixed })} · ${Math.round(s.weight).toLocaleString(numLocale())} kg${s.unplaced ? ` · ${tr('{n} colis non palettisé(s)', { n: s.unplaced })}` : ''}`} />
      <ConflictBanner conflict={ed.conflict} saving={ed.saving} onReload={ed.reload} onOverwrite={ed.overwrite} />
      <Palletizer key={`${ed.doc.id}:${ed.instance}`} workspace={{ initial: initialOf(ed.doc), references: refs.tools, onChange: ed.onChange, origin: ed.doc.code }} onLoadTruck={loadTruck} />
      {choosing && <LoadTruckDialog orgId={org.id} pz={choosing.pz} onNew={toNew} onExisting={toExisting} onClose={() => setChoosing(null)} />}
    </>
  );
}
