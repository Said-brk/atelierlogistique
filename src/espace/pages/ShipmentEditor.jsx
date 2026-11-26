// Éditeur d'un chargement : en-tête commun + optimiseur de chargement intégré, pré-rempli.
// Liens : palettisations qui alimentent ce chargement (chargement → palettes).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Loader2, QrCode, PackageCheck, X, Copy, Trash2 } from 'lucide-react';
import LoadOptimizer from '../../outils/optimiseur-chargement/LoadOptimizer.jsx';
import { useEspace } from '../useEspace';
import { getShipment, createShipment, updateShipment, palletizationsOfShipment, shareUrlOf, shipmentStatus, deleteShipment, duplicateShipment, mergedCount, DOCK_STATUSES, SOURCE } from '../data';
import { useLoadingProofs, proofsByTruck, ProofButton, ProofViewer } from '../LoadingProof';
import GuideQrModal from '../../outils/optimiseur-chargement/guide/GuideQrModal';
import { EditorHeader, DocChip, Btn, editorInputCls, pct, ConflictBanner, ReferencesError, DocMenu } from '../ui';
import useDocEditor, { initialOf } from '../useDocEditor';
import useReferences from '../useReferences';
import { tourTitle, isAutoTitle } from '../tourCheck';
import { quote, factsOf, routeOf, rankCarriers } from '../../shared/carriers/pricing';
import { tolerance } from '../transport/control';

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

/** Devis d'un transporteur pour un résumé de plan (null sans plan). */
/** Faits d'un chargement pour la tarification : résumé du plan + zones / arrêts des destinations + mois de départ. */
function factsFor(summary, rows, agencies, departure, tour) {
  const route = routeOf(rows, agencies);
  // Destination sans tournée : celle choisie sur le chargement.
  const dests = route.dests.map((d) => (d.tour || !tour ? d : { ...d, tour }));
  return factsOf(summary, { ...route, dests: dests.length || !tour ? dests : [{ agency: '', tour, zone: null }], month: departure ? String(departure).slice(0, 7) : new Date().toISOString().slice(0, 7) });
}
function quoteOf(c, facts) {
  if (!facts) return null;
  return { carrier: c.code, label: c.label, ...quote(facts, c.data) };
}
const eur = (v) => `${v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
/** Détail lisible d'un devis (infobulle). */
function quoteDetail(q) {
  if (!q || q.error) return q?.error ?? '';
  const lines = [];
  if (q.lines) q.lines.forEach((l) => lines.push(`${l.count} × ${l.label} à ${eur(l.price)}`));
  else lines.push(`${q.qty.toLocaleString('fr-FR')} ${q.unit} → ${eur(q.base)}`);
  if (q.taxable) lines.push(`Poids taxable : ${q.taxable.kg.toLocaleString('fr-FR')} kg (${{ real: 'poids réel', volume: 'volume', floor: 'plancher' }[q.taxable.by]})`);
  if (q.minApplied) lines.push('Minimum de perception appliqué');
  if (q.fuel) lines.push(`Surcharge gazole : ${eur(q.fuel)}`);
  return lines.join('\n');
}

export default function ShipmentEditor() {
  const { code } = useParams();
  const refs = useReferences();
  const navigate = useNavigate();
  // Coût théorique du transporteur : recalculé à chaque enregistrement, figé une fois au quai.
  const carriers = refs.tools?.carriers ?? [];
  const derive = (patch, base) => {
    if (!('carrier_cost' in base) || DOCK_STATUSES.includes(base.status)) return {};
    const c = carriers.find((x) => x.code === patch.carrier);
    const q = c ? quoteOf(c, factsFor(patch.result?.summary, patch.input?.rows, refs.tools?.agencies ?? [], patch.departure_at, patch.tour)) : null;
    return { carrier_cost: q && !q.error ? q.amount : null, carrier_quote: q };
  };
  const ed = useDocEditor({ code, load: getShipment, update: updateShipment, titleOf: (d) => d.label ?? 'Chargement', derive });
  // Lignes en cours de saisie (destinations → zones tarifaires et arrêts).
  const liveRows = useRef(null);
  const [, bump] = useState(0);
  const onToolChange = useCallback((snap) => { if (snap?.rows !== liveRows.current) { liveRows.current = snap?.rows ?? null; bump((x) => x + 1); } ed.onChange(snap); }, [ed.onChange]); // eslint-disable-line react-hooks/exhaustive-deps
  const [pzs, setPzs] = useState([]);
  const [quaiOpen, setQuaiOpen] = useState(false);
  const [proofOf, setProofOf] = useState(undefined); // undefined = fermé ; null = toutes ; n = camion n
  // Arrivée depuis « Charger le camion » d'une palettisation : palettes déjà écrites dans ce chargement.
  const location = useLocation();
  const [received, setReceived] = useState(location.state?.received ?? null);
  // Tournée choisie : seules ses agences sont proposées comme destinations (dans l'ordre de la tournée).
  const tours = refs.tools?.tours ?? [];
  const tour = ed.meta.tour;
  const agencies = useMemo(() => {
    const all = refs.tools?.agencies ?? [];
    return tour ? all.filter((a) => a.tour === tour).sort((a, b) => a.order - b.order) : all;
  }, [refs.tools, tour]);
  useEffect(() => { if (ed.doc?.id) palletizationsOfShipment(ed.doc.id).then(setPzs).catch(() => setPzs([])); }, [ed.doc?.id]);
  const proofs = useLoadingProofs(ed.doc?.id, ed.doc?.status);
  // Au quai : le statut suit les confirmations du cariste (toutes les 20 s et au retour sur l'onglet).
  const { refreshStatus } = ed;
  const atDock = DOCK_STATUSES.includes(ed.doc?.status) && ed.doc?.status !== 'loaded';
  useEffect(() => {
    if (!atDock || !ed.doc?.id) return undefined;
    const tick = () => refreshStatus(() => shipmentStatus(ed.doc.id));
    const t = setInterval(tick, 20000);
    window.addEventListener('focus', tick);
    return () => { clearInterval(t); window.removeEventListener('focus', tick); };
  }, [atDock, ed.doc?.id, refreshStatus]);

  if (refs.error) return <ReferencesError error={refs.error} onRetry={refs.reload} />;
  if (ed.doc === undefined || refs.items === undefined) return <div className="p-10 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;
  if (ed.doc === null) return <div className="p-10 text-center text-slate-500">Chargement introuvable. <Link to="/app/chargements" className="text-blue-700">Retour à la liste</Link></div>;

  const s = ed.summary;
  const plan = ed.doc.result?.plan;
  const locked = DOCK_STATUSES.includes(ed.doc.status)
    ? `Chargement ${ed.doc.status === 'sent' ? 'envoyé au quai' : ed.doc.status === 'loaded' ? 'chargé' : 'chargé en partie'} : marchandises, véhicules et plan sont figés. « Rouvrir » pour les modifier.` : null;
  // Camions confirmés depuis le dernier envoi au quai (un renvoi après réouverture repart de zéro).
  const byTruck = proofsByTruck(proofs.filter((p) => !ed.doc.sent_at || new Date(p.created_at) >= new Date(ed.doc.sent_at)));
  const trucks = Object.fromEntries(Object.entries(byTruck).map(([k, v]) => [k, { ...v, onProof: () => setProofOf(Number(k)) }]));
  const sent = DOCK_STATUSES.includes(ed.doc.status); // au quai (envoyé, chargé en partie, chargé) : on ne rétrograde pas le statut
  // Le lien permanent ne sert que si le plan affiché est celui enregistré (sinon : lien avec le plan dedans).
  const ready = (p) => !!(p?.guide || p?.guides?.length);
  const shareUrl = !ed.dirty && ready(plan) ? shareUrlOf(ed.doc) : null;
  // Envoyer au quai : enregistre (statut « Envoyé »), puis affiche le QR code et le lien permanents.
  const sendToDock = async () => {
    const d = !ed.dirty && sent ? ed.doc : await ed.save('sent');
    if (ready(d?.result?.plan)) setQuaiOpen(true);
    else if (d) alert('Le plan n’est pas prêt : lancez l’optimisation, attendez la fin du calcul, puis renvoyez.'); // eslint-disable-line no-alert
  };
  // Tournée ou date changée : le titre suit (« Tournée T01 – 25/11/2026 ») tant qu'il n'a pas été saisi à la main.
  const setHeader = (patch) => {
    const m = { ...ed.meta, ...patch };
    // Tournée choisie : son transporteur par défaut, si aucun n'est encore choisi.
    if (patch.tour && !m.carrier) m.carrier = tours.find((t) => t.code === patch.tour)?.carrier ?? '';
    const auto = isAutoTitle(ed.meta.label) ? tourTitle([m.tour], m.departure_at) : null;
    ed.setMeta(auto ? { ...m, label: auto } : m);
  };
  const tourMissing = !!tour && !tours.some((t) => t.code === tour);
  const carrier = ed.meta.carrier;
  const carrierMissing = !!carrier && !carriers.some((c) => c.code === carrier);
  // Au quai : coût figé (enregistré) ; sinon calcul en direct sur le plan affiché.
  const invoiced = (() => { const t = String(ed.meta.invoiced_amount ?? '').replace(/[€\s\u00a0]/g, '').replace(',', '.'); return t === '' ? null : Number(t); })();
  const facts = factsFor(s, liveRows.current ?? ed.doc.input?.rows, refs.tools?.agencies ?? [], ed.meta.departure_at, ed.meta.tour);
  const liveQuote = locked ? ed.doc.carrier_quote : (carriers.find((c) => c.code === carrier) ? quoteOf(carriers.find((c) => c.code === carrier), facts) : null);
  // Transporteur le moins cher pour ce plan (comparaison des grilles).
  const ranking = !locked && facts && carriers.length > 1 ? rankCarriers(facts, carriers).filter((x) => !('error' in x.q)) : [];
  const cheapest = ranking[0];
  const saving = cheapest && cheapest.code !== carrier && liveQuote && !liveQuote.error ? Math.round((liveQuote.amount - cheapest.q.amount) * 100) / 100 : null;
  // Écart facture / coût théorique.
  const invoiceGap = invoiced != null && Number.isFinite(invoiced) && liveQuote && !liveQuote.error && liveQuote.amount
    ? (() => { const g = invoiced - liveQuote.amount; const pct = (g / liveQuote.amount) * 100; return { pct, text: `${g >= 0 ? '+' : ''}${pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %` }; })()
    : null;
  const duplicate = async () => {
    const d = ed.dirty ? await ed.save() : ed.doc;
    if (d) navigate(`/app/chargements/${await duplicateShipment(d)}`);
  };
  const remove = async () => {
    const merged = await mergedCount(ed.doc.org_id, ed.doc.code).catch(() => 0);
    const photos = proofs.reduce((n, p) => n + p.urls.length, 0);
    const deps = [
      pzs.length && `${pzs.length} palettisation(s) : ${pzs.map((p) => p.code).join(', ')}`,
      merged && `${merged} chargement(s) d’origine regroupé(s) dans celui-ci`,
      photos && `${photos} photo(s) de preuve de chargement`,
    ].filter(Boolean);
    const msg = `Supprimer définitivement ${ed.doc.code} ?${deps.length ? `\n\nSeront aussi supprimés :\n• ${deps.join('\n• ')}` : ''}`
      + `${ed.doc.external_id ? `\n\nVotre WMS / ERP sera prévenu (annulé) pour ${ed.doc.external_id}.` : ''}\n\nCette action est irréversible.`;
    if (!window.confirm(msg)) return;
    try { await deleteShipment(ed.doc.id); ed.discard(); navigate('/app/chargements', { replace: true }); } catch (e) { alert(e.message); } // eslint-disable-line no-alert
  };
  return (
    <>
      <EditorHeader backTo="/app/chargements" backTitle="Retour aux chargements" doc={ed.doc} meta={ed.meta} onMeta={ed.setMeta}
        dirty={ed.dirty} savedAt={ed.savedAt} saving={ed.saving} onSave={ed.save} canValidate={!!s} validateHint="Lancez d’abord l’optimisation"
        sourceLabel={SOURCE[ed.doc.source]} error={ed.error}
        actions={<Btn variant="amber" onClick={sendToDock} disabled={ed.saving || !s} title={s ? 'QR code et lien du plan pour le cariste, sans compte' : 'Lancez d’abord l’optimisation'}>
          <QrCode size={15} /> {sent ? 'QR quai' : <><span className="sm:hidden">Quai</span><span className="hidden sm:inline">Envoyer au quai</span></>}</Btn>}
        menu={<DocMenu disabled={ed.saving} items={[
          { label: 'Dupliquer', icon: Copy, onClick: duplicate },
          { label: 'Supprimer…', icon: Trash2, danger: true, onClick: remove },
        ]} />}
        extraFields={<>
          <label className="flex items-center gap-2 text-slate-500">Départ
            <input type="date" value={ed.meta.departure_at} onChange={(e) => setHeader({ departure_at: e.target.value })} className={editorInputCls} /></label>
          {'tour' in ed.doc && (tours.length > 0 || tour) && (
            <label className="flex items-center gap-2 text-slate-500" title="Les destinations proposées sont celles de la tournée">Tournée
              <select value={tour} onChange={(e) => setHeader({ tour: e.target.value })} disabled={!!locked} className={`${editorInputCls} max-w-[11rem]`}>
                <option value="">— Aucune —</option>
                {tours.map((t) => <option key={t.code} value={t.code}>{t.code} · {t.label}</option>)}
                {tourMissing && <option value={tour}>{tour} (inconnue)</option>}
              </select></label>
          )}
          {'carrier' in ed.doc && (carriers.length > 0 || carrier) && (
            <span className="flex flex-wrap items-center gap-2 text-slate-500 min-w-0 max-w-full">
              <label className="flex items-center gap-2">Transporteur
                <select value={carrier} onChange={(e) => ed.setMeta({ ...ed.meta, carrier: e.target.value })} disabled={!!locked} className={`${editorInputCls} max-w-[11rem]`}>
                  <option value="">— Aucun —</option>
                  {carriers.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  {carrierMissing && <option value={carrier}>{carrier} (inconnu)</option>}
                </select></label>
              {liveQuote && (liveQuote.error
                ? <span className="text-xs text-amber-700" title={liveQuote.error}>coût : —</span>
                : <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 font-jetbrains text-xs text-slate-800 whitespace-pre" title={quoteDetail(liveQuote)}>
                    ≈ {eur(liveQuote.amount)}{locked && <span className="ml-1 text-slate-400">figé</span>}</span>)}
              {(saving > 0 || (!carrier && cheapest)) && (
                <button type="button" onClick={() => ed.setMeta({ ...ed.meta, carrier: cheapest.code })}
                  title={ranking.map((x) => `${x.label} : ${eur(x.q.amount)}`).join('\n')}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100">
                  {carrier ? `${cheapest.label} : −${eur(saving)}` : `Moins cher : ${cheapest.label} ${eur(cheapest.q.amount)}`}
                </button>
              )}
              {'invoiced_amount' in ed.doc && carrier && (
                <label className="flex items-center gap-1.5" title="Montant de la facture du transporteur (contrôle transport)">Facturé
                  <input value={ed.meta.invoiced_amount} onChange={(e) => ed.setMeta({ ...ed.meta, invoiced_amount: e.target.value })} inputMode="decimal" placeholder="—"
                    className={`${editorInputCls} w-24 text-right font-jetbrains`} />
                  {invoiceGap && <span className={`text-xs font-semibold ${invoiceGap.pct > tolerance() ? 'text-red-700' : invoiceGap.pct < -tolerance() ? 'text-amber-700' : 'text-emerald-700'}`}>{invoiceGap.text}</span>}
                </label>
              )}
            </span>
          )}
        </>}
        links={<>
          {pzs.length > 0 && <span className="flex flex-wrap items-center gap-1.5 text-slate-500 text-xs">Palettes issues de
            {pzs.map((p) => <DocChip key={p.code} kind="pallet" to={`/app/palettisations/${p.code}`} code={p.code} title={p.label ?? ''} />)}</span>}
          {proofs.length > 0 && <ProofButton count={proofs.reduce((n, p) => n + p.urls.length, 0)} onClick={() => setProofOf(null)} />}
        </>}
        summary={s && `${s.fleet ? 'Flotte' : 'Plan'} : ${s.vehicle} · ${s.packed} colis · ${s.fleet ? 'moy. ' : ''}${pct(s.fill)}${s.unpacked ? ` · ${s.unpacked} non chargé(s)` : ''}${s.edited ? ' · modifié à la main' : ''}`} />
      {received && (
        <div className="mx-4 sm:mx-6 mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 flex items-center gap-2">
          <PackageCheck size={16} className="shrink-0" />
          <span className="flex-1">{received.count} palette(s) de {received.from} ajoutée(s) à ce chargement. Choisissez le véhicule puis lancez l’optimisation.</span>
          <button onClick={() => setReceived(null)} className="text-emerald-700 hover:text-emerald-900" aria-label="Fermer"><X size={15} /></button>
        </div>
      )}
      <ConflictBanner conflict={ed.conflict} saving={ed.saving} onReload={ed.reload} onOverwrite={ed.overwrite} />
      <LoadOptimizer key={`${ed.doc.id}:${ed.instance}`} workspace={{ initial: initialOf(ed.doc), references: refs.tools, agencies, onChange: onToolChange, shareUrl, locked, trucks, truckPhase: DOCK_STATUSES.includes(ed.doc.status) ? 'todo' : 'plan' }} />
      {proofOf !== undefined && <ProofViewer proofs={proofs} truck={proofOf} onClose={() => setProofOf(undefined)} />}
      {quaiOpen && <GuideQrModal url={shareUrlOf(ed.doc)} onClose={() => setQuaiOpen(false)} title={`${ed.doc.code} · plan pas à pas pour le cariste`}
        note="Lien permanent : il affiche toujours la dernière version enregistrée. Si vous modifiez le plan, enregistrez : le cariste voit la nouvelle version." />}
    </>
  );
}
