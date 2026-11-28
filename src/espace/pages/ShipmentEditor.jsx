// Éditeur d'un chargement : en-tête commun + optimiseur de chargement intégré, pré-rempli.
// Liens : palettisations qui alimentent ce chargement (chargement → palettes).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Loader2, QrCode, PackageCheck, X, Copy, Trash2, CheckCircle2, RotateCcw } from 'lucide-react';
import LoadOptimizer from '../../outils/optimiseur-chargement/LoadOptimizer.jsx';
import { useEspace } from '../useEspace';
import { getShipment, createShipment, updateShipment, palletizationsOfShipment, shareUrlOf, shipmentStatus, markShipmentLoaded, deleteShipment, duplicateShipment, mergedCount, DOCK_STATUSES, SOURCE } from '../data';
import { useLoadingProofs, proofsByTruck, ProofButton, ProofViewer } from '../LoadingProof';
import GuideQrModal from '../../outils/optimiseur-chargement/guide/GuideQrModal';
import { EditorHeader, DocChip, Btn, editorInputCls, pct, ConflictBanner, ReferencesError, DocMenu } from '../ui';
import useDocEditor, { initialOf } from '../useDocEditor';
import useReferences from '../useReferences';
import { tourTitle, isAutoTitle } from '../tourCheck';
import { quote, factsOf, routeOf, rankCarriers } from '../../shared/carriers/pricing';
import { tolerance } from '../transport/control';
import { t as tr, numLocale } from '../../shared/i18n/core';
import { fmtMoney, fmtWeight, parseNumber } from '../../shared/units/units';

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
const eur = (v) => fmtMoney(v);
/** Détail lisible d'un devis (infobulle). */
function quoteDetail(q) {
  if (!q || q.error) return q?.error ?? '';
  const lines = [];
  if (q.lines) q.lines.forEach((l) => lines.push(tr('{n} × {label} à {price}', { n: l.count, label: l.label, price: eur(l.price) })));
  else if (q.byDest) {
    q.byDest.forEach((d) => lines.push(`${d.agency} · ${d.zone} · ${d.qty.toLocaleString(numLocale())} ${tr(d.unit)} → ${eur(d.price)}${d.minApplied ? ` (${tr('minimum')})` : ''}`));
    if (q.byDest.length > 1) lines.push(`${tr('Total transport')} → ${eur(q.base)}`);
  } else lines.push(`${q.qty.toLocaleString(numLocale())} ${tr(q.unit)} → ${eur(q.base)}`);
  if (q.taxable && !q.byDest) lines.push(tr('Poids taxable : {w} ({by})', { w: fmtWeight(q.taxable.kg), by: { real: tr('poids réel'), volume: tr('volume'), floor: tr('plancher') }[q.taxable.by] }));
  if (q.minApplied && !q.byDest) lines.push(tr('Minimum de perception appliqué'));
  if (q.fuel) lines.push(tr('Surcharge gazole : {v}', { v: eur(q.fuel) }));
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
  const ed = useDocEditor({ code, load: getShipment, update: updateShipment, titleOf: (d) => d.label ?? tr('Chargement'), derive });
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
  if (ed.doc === null) return <div className="p-10 text-center text-slate-500">{tr('Chargement introuvable.')} <Link to="/app/chargements" className="text-blue-700">{tr('Retour à la liste')}</Link></div>;

  const s = ed.summary;
  const plan = ed.doc.result?.plan;
  const locked = DOCK_STATUSES.includes(ed.doc.status)
    ? (ed.doc.status === 'sent' ? tr('Chargement envoyé au quai : marchandises, véhicules et plan sont figés. « Rouvrir » pour les modifier.')
      : ed.doc.status === 'loaded' ? tr('Chargement chargé : marchandises, véhicules et plan sont figés. « Rouvrir » pour les modifier.')
        : tr('Chargement chargé en partie : marchandises, véhicules et plan sont figés. « Rouvrir » pour les modifier.')) : null;
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
    else if (d) alert(tr('Le plan n’est pas prêt : lancez l’optimisation, attendez la fin du calcul, puis renvoyez.')); // eslint-disable-line no-alert
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
  const invoiced = parseNumber(ed.meta.invoiced_amount);
  const facts = factsFor(s, liveRows.current ?? ed.doc.input?.rows, refs.tools?.agencies ?? [], ed.meta.departure_at, ed.meta.tour);
  const liveQuote = locked ? ed.doc.carrier_quote : (carriers.find((c) => c.code === carrier) ? quoteOf(carriers.find((c) => c.code === carrier), facts) : null);
  // Transporteur le moins cher pour ce plan (comparaison des grilles).
  const ranking = !locked && facts && carriers.length > 1 ? rankCarriers(facts, carriers).filter((x) => !('error' in x.q)) : [];
  const cheapest = ranking[0];
  const saving = cheapest && cheapest.code !== carrier && liveQuote && !liveQuote.error ? Math.round((liveQuote.amount - cheapest.q.amount) * 100) / 100 : null;
  // Écart facture / coût théorique.
  const invoiceGap = invoiced != null && Number.isFinite(invoiced) && liveQuote && !liveQuote.error && liveQuote.amount
    ? (() => { const g = invoiced - liveQuote.amount; const pct = (g / liveQuote.amount) * 100; return { pct, text: `${g >= 0 ? '+' : ''}${pct.toLocaleString(numLocale(), { maximumFractionDigits: 1 })} %` }; })()
    : null;
  // « Marquer chargé » depuis le bureau (sans QR code) : tous les camions pas encore confirmés au quai.
  const nTrucks = Math.max(1, plan?.guides?.length ?? 1);
  const nDone = Object.keys(byTruck).length;
  const markLoaded = async () => {
    const msg = tr('Marquer {code} comme chargé ?', { code: ed.doc.code })
      + (nTrucks > 1 ? `\n\n${tr('Les {n} camions passent « chargé » ({done} déjà confirmé(s) au quai).', { n: nTrucks, done: nDone })}` : '')
      + `\n\n${tr('Sans scanner le QR code : la confirmation est enregistrée à votre nom.')}`;
    if (!window.confirm(msg)) return; // eslint-disable-line no-alert
    const d = ed.dirty ? await ed.save() : ed.doc;
    if (!d) return;
    try { await markShipmentLoaded(d.id); await ed.refreshStatus(() => shipmentStatus(d.id)); } catch (e) { alert(e.message); } // eslint-disable-line no-alert
  };
  // Un seul bouton d'étape (la suite logique), tout le reste dans « Actions ».
  const st = ed.doc.status;
  const reopenable = ['validated', ...DOCK_STATUSES].includes(st);
  const noPlan = tr('Lancez d’abord l’optimisation');
  const step = ['new', 'in_progress'].includes(st) ? 'validate' : st === 'validated' ? 'dock' : st === 'loaded' ? 'reopen' : 'loaded';
  const doValidate = () => ed.save('validated');
  const doReopen = () => ed.save('in_progress');
  const quaiLabel = sent ? tr('QR code du quai') : tr('Envoyer au quai (QR code)');
  const statusAction = {
    validate: <Btn variant="success" onClick={doValidate} disabled={ed.saving || !s} title={s ? '' : noPlan}><CheckCircle2 size={15} /> {tr('Valider')}</Btn>,
    dock: <Btn variant="amber" onClick={sendToDock} disabled={ed.saving || !s} title={s ? tr('QR code et lien du plan pour le cariste, sans compte') : noPlan}>
      <QrCode size={15} /> <span className="sm:hidden">{tr('Quai')}</span><span className="hidden sm:inline">{tr('Envoyer au quai')}</span></Btn>,
    loaded: <Btn variant="ghost" onClick={markLoaded} disabled={ed.saving || !s} title={tr('Sans passer par le QR code')} className="!text-violet-700 !border-violet-300">
      <PackageCheck size={15} /> {tr('Marquer chargé')}</Btn>,
    reopen: <Btn variant="ghost" onClick={doReopen} disabled={ed.saving}><RotateCcw size={15} /> {tr('Rouvrir')}</Btn>,
  }[step];
  const duplicate = async () => {
    const d = ed.dirty ? await ed.save() : ed.doc;
    if (d) navigate(`/app/chargements/${await duplicateShipment(d)}`);
  };
  const remove = async () => {
    const merged = await mergedCount(ed.doc.org_id, ed.doc.code).catch(() => 0);
    const photos = proofs.reduce((n, p) => n + p.urls.length, 0);
    const deps = [
      pzs.length && tr('{n} palettisation(s) : {codes}', { n: pzs.length, codes: pzs.map((p) => p.code).join(', ') }),
      merged && tr('{n} chargement(s) d’origine regroupé(s) dans celui-ci', { n: merged }),
      photos && tr('{n} photo(s) de preuve de chargement', { n: photos }),
    ].filter(Boolean);
    const msg = tr('Supprimer définitivement {code} ?', { code: ed.doc.code })
      + (deps.length ? `\n\n${tr('Seront aussi supprimés :')}\n• ${deps.join('\n• ')}` : '')
      + (ed.doc.external_id ? `\n\n${tr('Votre WMS / ERP sera prévenu (annulé) pour {ref}.', { ref: ed.doc.external_id })}` : '')
      + `\n\n${tr('Cette action est irréversible.')}`;
    if (!window.confirm(msg)) return;
    try { await deleteShipment(ed.doc.id); ed.discard(); navigate('/app/chargements', { replace: true }); } catch (e) { alert(e.message); } // eslint-disable-line no-alert
  };
  return (
    <>
      <EditorHeader backTo="/app/chargements" backTitle={tr('Retour aux chargements')} doc={ed.doc} meta={ed.meta} onMeta={ed.setMeta}
        dirty={ed.dirty} savedAt={ed.savedAt} saving={ed.saving} onSave={ed.save} canValidate={!!s} validateHint={tr('Lancez d’abord l’optimisation')}
        sourceLabel={SOURCE[ed.doc.source]} error={ed.error}
        statusAction={statusAction}
        menu={<DocMenu disabled={ed.saving} label={tr('Actions')} items={[
          step !== 'dock' && { label: quaiLabel, icon: QrCode, color: '#D97706', onClick: sendToDock, disabled: !s, hint: s ? '' : noPlan },
          step !== 'loaded' && st !== 'loaded' && { label: tr('Marquer chargé (sans QR code)'), icon: PackageCheck, color: '#6D28D9', onClick: markLoaded, disabled: !s, hint: s ? '' : noPlan },
          step !== 'reopen' && reopenable && { label: tr('Rouvrir'), icon: RotateCcw, onClick: doReopen },
          { divider: true },
          { label: tr('Dupliquer'), icon: Copy, onClick: duplicate },
          { label: tr('Supprimer…'), icon: Trash2, danger: true, onClick: remove },
        ]} />}
        extraFields={<>
          <label className="flex items-center gap-2 text-slate-500">{tr('Départ')}
            <input type="date" value={ed.meta.departure_at} onChange={(e) => setHeader({ departure_at: e.target.value })} className={editorInputCls} /></label>
          {'tour' in ed.doc && !tours.length && !tour && (
            <span className="flex items-center gap-2 text-slate-500">{tr('Tournée')}
              <Link to="/app/parametres/references/tournees" className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
                title={tr('Créez vos tournées : destinations filtrées, titre automatique, calendrier')}>{tr('+ Créer une tournée')}</Link></span>
          )}
          {'tour' in ed.doc && (tours.length > 0 || tour) && (
            <label className="flex items-center gap-2 text-slate-500" title={tr('Les destinations proposées sont celles de la tournée')}>{tr('Tournée')}
              <select value={tour} onChange={(e) => setHeader({ tour: e.target.value })} disabled={!!locked} className={`${editorInputCls} max-w-[11rem]`}>
                <option value="">{tr('— Aucune —')}</option>
                {tours.map((t) => <option key={t.code} value={t.code}>{t.code} · {t.label}</option>)}
                {tourMissing && <option value={tour}>{tour} ({tr('inconnue')})</option>}
              </select></label>
          )}
          {'carrier' in ed.doc && !carriers.length && !carrier && (
            <span className="flex items-center gap-2 text-slate-500">{tr('Transporteur')}
              <Link to="/app/parametres/references/transporteurs" className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
                title={tr('Ajoutez vos transporteurs et leurs grilles : coût théorique, moins cher, contrôle des factures')}>{tr('+ Ajouter un transporteur')}</Link></span>
          )}
          {'carrier' in ed.doc && (carriers.length > 0 || carrier) && (
            <span className="flex flex-wrap items-center gap-2 text-slate-500 min-w-0 max-w-full">
              <label className="flex items-center gap-2">{tr('Transporteur')}
                <select value={carrier} onChange={(e) => ed.setMeta({ ...ed.meta, carrier: e.target.value })} disabled={!!locked} className={`${editorInputCls} max-w-[11rem]`}>
                  <option value="">{tr('— Aucun —')}</option>
                  {carriers.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  {carrierMissing && <option value={carrier}>{carrier} ({tr('inconnu')})</option>}
                </select></label>
              {liveQuote && (liveQuote.error
                ? <span className="text-xs text-amber-700" title={tr(liveQuote.error)}>{tr('coût : —')}</span>
                : <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 font-jetbrains text-xs text-slate-800 whitespace-pre" title={quoteDetail(liveQuote)}>
                    ≈ {eur(liveQuote.amount)}{locked && <span className="ml-1 text-slate-400">{tr('figé')}</span>}</span>)}
              {(saving > 0 || (!carrier && cheapest)) && (
                <button type="button" onClick={() => ed.setMeta({ ...ed.meta, carrier: cheapest.code })}
                  title={ranking.map((x) => `${x.label} : ${eur(x.q.amount)}`).join('\n')}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100">
                  {carrier ? `${cheapest.label} : −${eur(saving)}` : tr('Moins cher : {label} {amount}', { label: cheapest.label, amount: eur(cheapest.q.amount) })}
                </button>
              )}
              {'invoiced_amount' in ed.doc && carrier && (
                <label className="flex items-center gap-1.5" title={tr('Montant de la facture du transporteur (contrôle transport)')}>{tr('Facturé')}
                  <input value={ed.meta.invoiced_amount} onChange={(e) => ed.setMeta({ ...ed.meta, invoiced_amount: e.target.value })} inputMode="decimal" placeholder="—"
                    className={`${editorInputCls} w-24 text-right font-jetbrains`} />
                  {invoiceGap && <span className={`text-xs font-semibold ${invoiceGap.pct > tolerance() ? 'text-red-700' : invoiceGap.pct < -tolerance() ? 'text-amber-700' : 'text-emerald-700'}`}>{invoiceGap.text}</span>}
                </label>
              )}
            </span>
          )}
        </>}
        links={<>
          {pzs.length > 0 && <span className="flex flex-wrap items-center gap-1.5 text-slate-500 text-xs">{tr('Palettes issues de')}
            {pzs.map((p) => <DocChip key={p.code} kind="pallet" to={`/app/palettisations/${p.code}`} code={p.code} title={p.label ?? ''} />)}</span>}
          {proofs.length > 0 && <ProofButton count={proofs.reduce((n, p) => n + p.urls.length, 0)} onClick={() => setProofOf(null)} />}
        </>}
        summary={s && `${s.fleet ? tr('Flotte') : tr('Plan')} : ${s.vehicle} · ${tr('{n} colis', { n: s.packed })} · ${s.fleet ? tr('moy.') + ' ' : ''}${pct(s.fill)}${s.unpacked ? ` · ${tr('{n} non chargé(s)', { n: s.unpacked })}` : ''}${s.edited ? ` · ${tr('modifié à la main')}` : ''}`} />
      {received && (
        <div className="mx-4 sm:mx-6 mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 flex items-center gap-2">
          <PackageCheck size={16} className="shrink-0" />
          <span className="flex-1">{tr('{n} palette(s) de {from} ajoutée(s) à ce chargement. Choisissez le véhicule puis lancez l’optimisation.', { n: received.count, from: received.from })}</span>
          <button onClick={() => setReceived(null)} className="text-emerald-700 hover:text-emerald-900" aria-label={tr('Fermer')}><X size={15} /></button>
        </div>
      )}
      <ConflictBanner conflict={ed.conflict} saving={ed.saving} onReload={ed.reload} onOverwrite={ed.overwrite} />
      <LoadOptimizer key={`${ed.doc.id}:${ed.instance}`} workspace={{ initial: initialOf(ed.doc), references: refs.tools, agencies, onChange: onToolChange, shareUrl, locked, trucks, truckPhase: DOCK_STATUSES.includes(ed.doc.status) ? 'todo' : 'plan' }} />
      {proofOf !== undefined && <ProofViewer proofs={proofs} truck={proofOf} onClose={() => setProofOf(undefined)} />}
      {quaiOpen && <GuideQrModal url={shareUrlOf(ed.doc)} onClose={() => setQuaiOpen(false)} title={`${ed.doc.code} · ${tr('plan pas à pas pour le cariste')}`}
        note={tr('Lien permanent : il affiche toujours la dernière version enregistrée. Si vous modifiez le plan, enregistrez : le cariste voit la nouvelle version.')} />}
    </>
  );
}
