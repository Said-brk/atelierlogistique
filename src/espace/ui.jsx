// Petits éléments d'interface communs aux pages de l'espace.
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
  return <button {...props} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold disabled:opacity-50 transition hover:brightness-105 ${props.className ?? ''}`} style={styles}>{children}</button>;
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)} %`);
