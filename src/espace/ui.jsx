// Petits éléments d'interface communs aux pages de l'espace.
import { Link } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle2, RotateCcw, Loader2, Truck, Package, AlertTriangle } from 'lucide-react';
import { STATUS } from './data';

export function PageHeader({ title, subtitle, actions, children }) {
  return (
    <div className="bg-white border-b border-slate-200 print:hidden">
      <div className="px-5 sm:px-8 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-bricolage font-bold text-xl sm:text-2xl text-slate-900 truncate">{title}</h1>
          {subtitle && <div className="text-sm text-slate-500 mt-0.5">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function StatusBadge({ status }) {
  const s = STATUS[status] ?? STATUS.new;
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap" style={{ color: s.color, background: s.bg }}>
    <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />{s.label}</span>;
}

export function Btn({ children, variant = 'primary', ...props }) {
  const styles = {
    primary: { background: '#2563EB', color: '#fff' },
    success: { background: '#15803D', color: '#fff' },
    ghost: { background: '#fff', color: '#334155', border: '1px solid #CBD5E1' },
    amber: { background: '#F59E0B', color: '#0F172A' },
  }[variant];
  return <button {...props} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3.5 py-2 text-sm font-semibold whitespace-nowrap disabled:opacity-50 transition hover:brightness-105 ${props.className ?? ''}`} style={styles}>{children}</button>;
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)} %`);

const inputCls = 'rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200';

/**
 * En-tête commun des éditeurs (chargement, palettisation) : retour, n°, libellé modifiable, statut,
 * version, enregistrer / valider / rouvrir, champs secondaires, liens vers les documents liés.
 */
export function EditorHeader({
  backTo, backTitle, doc, kindColor = '#1D4ED8', kindBg = '#EFF6FF', meta, onMeta, dirty, saving, onSave,
  canValidate, validateHint, extraFields = null, links = null, summary = null, error = '', sourceLabel = '', actions = null, savedAt = null,
}) {
  const validated = ['validated', 'sent', 'partially_loaded', 'loaded'].includes(doc.status);
  return (
    // Fixé en haut sur grand écran ; sur téléphone il défile (sinon il mangerait la moitié de l'écran).
    <div className="bg-white border-b border-slate-200 lg:sticky top-0 z-20 print:hidden">
      <div className="px-4 sm:px-8 py-3 flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-2">
        <Link to={backTo} className="text-slate-400 hover:text-slate-700" title={backTitle}><ArrowLeft size={18} /></Link>
        <span className="font-jetbrains text-xs rounded px-2 py-1" style={{ color: kindColor, background: kindBg }}>{doc.code}</span>
        <input value={meta.label} onChange={(e) => onMeta({ ...meta, label: e.target.value })} placeholder="Libellé"
          className="font-bricolage font-bold text-base sm:text-lg text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-400 focus:outline-none min-w-0 flex-1 sm:flex-none sm:w-72" />
        <StatusBadge status={doc.status} />
        <span className="text-xs text-slate-400 hidden 2xl:inline">v{doc.version}{sourceLabel ? ` · ${sourceLabel}` : ''} · {fmtDateTime(doc.updated_at)}</span>
        {/* Téléphone : boutons sur toute la largeur, sous le titre. */}
        <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
          {/* Enregistrement automatique : état discret (le bouton reste pour forcer l'enregistrement). */}
          <span className={`text-xs hidden lg:inline ${saving || dirty ? 'text-slate-500' : 'text-emerald-700'}`}>
            {saving ? 'Enregistrement…' : dirty ? 'Modifications en cours…' : savedAt ? `Enregistré à ${savedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </span>
          {actions}
          <Btn variant="ghost" onClick={() => onSave()} disabled={saving} title={dirty ? 'Modifications non enregistrées' : ''}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer
            {dirty && <span className="w-2 h-2 rounded-full bg-amber-500 lg:hidden" aria-label="Modifications non enregistrées" />}</Btn>
          {validated
            ? <Btn variant="ghost" onClick={() => onSave('in_progress')} disabled={saving}><RotateCcw size={15} /> Rouvrir</Btn>
            : <Btn variant="success" onClick={() => onSave('validated')} disabled={saving || !canValidate} title={canValidate ? '' : validateHint}><CheckCircle2 size={15} /> Valider</Btn>}
        </div>
      </div>
      <div className="px-4 sm:px-8 pb-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <label className="flex items-center gap-2 text-slate-500"><span className="whitespace-nowrap">Réf.<span className="hidden sm:inline"> WMS / ERP</span></span>
          <input value={meta.external_id} onChange={(e) => onMeta({ ...meta, external_id: e.target.value })} placeholder="EXP-…" className={`${inputCls} w-28 sm:w-36`} /></label>
        {extraFields}
        {links}
        {summary && <span className="text-xs text-slate-500 font-jetbrains">{summary}</span>}
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>
    </div>
  );
}

export const editorInputCls = inputCls;

/** Pastille-lien vers un document lié (PL-… / PZ-…). */
export function DocChip({ to, code, title, kind = 'shipment' }) {
  const c = kind === 'shipment' ? { color: '#1D4ED8', bg: '#EFF6FF' } : { color: '#7C3AED', bg: '#F5F3FF' };
  const Icon = kind === 'shipment' ? Truck : Package;
  return (
    <Link to={to} title={title} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 font-jetbrains text-[11px] rounded px-2 py-1 hover:underline whitespace-nowrap" style={{ color: c.color, background: c.bg }}>
      <Icon size={11} /> {code}
    </Link>
  );
}

/** Document modifié ailleurs pendant l'édition : l'enregistrement automatique est suspendu jusqu'au choix. */
export function ConflictBanner({ conflict, saving, onReload, onOverwrite }) {
  if (!conflict) return null;
  const when = conflict.updated_at ? new Date(conflict.updated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <div role="alert" className="mx-4 sm:mx-6 mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 flex flex-wrap items-center gap-x-3 gap-y-2">
      <AlertTriangle size={16} className="shrink-0 text-amber-600" />
      <span className="flex-1 min-w-[220px]">
        <b>Modifié ailleurs{when && ` à ${when}`}</b> (autre onglet, collègue ou WMS{conflict.status ? ` · statut : ${STATUS[conflict.status]?.label ?? conflict.status}` : ''}).
        Vos dernières modifications ne sont pas enregistrées.
      </span>
      <Btn variant="ghost" onClick={onReload} disabled={saving}><RotateCcw size={14} /> Recharger</Btn>
      <Btn onClick={onOverwrite} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Garder mes modifications</Btn>
    </div>
  );
}
