// Tableau réutilisable de l'espace aux colonnes redimensionnables : on tire le bord droit d'un en-tête
// (souris ou doigt), les largeurs sont mémorisées par tableau dans ce navigateur, double-clic sur un bord
// = retour aux largeurs automatiques. Une colonne de remplissage absorbe la place restante.
//
// columns : [{ key, h, cell(row), min?, thClass?, tdClass? }]

import { useRef, useState } from 'react';

const PREFIX = 'al.espace.cols.';
const load = (id) => { try { return JSON.parse(localStorage.getItem(PREFIX + id)) || null; } catch { return null; } };
const save = (id, w) => { try { w ? localStorage.setItem(PREFIX + id, JSON.stringify(w)) : localStorage.removeItem(PREFIX + id); } catch { /* stockage indisponible */ } };

export default function ResizableTable({
  id, columns, rows, rowKey = (r) => r.id, onRowClick, rowClass,
  theadClass = 'bg-slate-50 text-left text-[11px] font-jetbrains text-slate-500 uppercase',
  thClass = 'px-4 py-2.5 font-medium', tdClass = 'px-4 py-3 text-slate-600',
}) {
  const [widths, setWidths] = useState(() => load(id));
  const ths = useRef({});
  const latest = useRef(widths);
  const fixed = !!widths && columns.every((c) => widths[c.key]);

  const startDrag = (e, col) => {
    e.preventDefault(); e.stopPropagation();
    const base = {};
    columns.forEach((c) => { base[c.key] = (fixed && widths[c.key]) || Math.round(ths.current[c.key]?.getBoundingClientRect().width || 120); });
    const x0 = e.clientX, w0 = base[col.key], min = col.min ?? 60;
    const move = (ev) => { latest.current = { ...base, [col.key]: Math.max(min, Math.round(w0 + ev.clientX - x0)) }; setWidths(latest.current); };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      document.body.style.cursor = ''; document.body.style.userSelect = '';
      save(id, latest.current);
    };
    latest.current = base; setWidths(base);
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const reset = (e) => { e.stopPropagation(); latest.current = null; setWidths(null); save(id, null); };

  const total = fixed ? columns.reduce((s, c) => s + widths[c.key], 0) : 0;
  const clip = fixed ? ' overflow-hidden' : '';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={fixed ? { tableLayout: 'fixed', minWidth: total } : undefined}>
        {fixed && <colgroup>{columns.map((c) => <col key={c.key} style={{ width: widths[c.key] }} />)}<col /></colgroup>}
        <thead className={theadClass}>
          <tr>
            {columns.map((c) => (
              <th key={c.key} ref={(el) => { ths.current[c.key] = el; }} className={`relative whitespace-nowrap ${thClass} ${c.thClass ?? ''}${clip} text-ellipsis`}>
                {c.h}
                <span role="separator" aria-orientation="vertical" title="Tirer pour redimensionner · double-clic : largeurs auto"
                  onPointerDown={(e) => startDrag(e, c)} onDoubleClick={reset} onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-0 h-full w-2.5 cursor-col-resize touch-none group flex justify-end">
                  <span className="w-px h-full bg-slate-200 group-hover:bg-blue-400 group-hover:w-0.5" />
                </span>
              </th>
            ))}
            {fixed && <th className={thClass} />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={rowKey(r)} onClick={onRowClick && (() => onRowClick(r))}
              className={`${onRowClick ? 'hover:bg-blue-50/40 cursor-pointer' : ''} ${rowClass?.(r) ?? ''}`}>
              {columns.map((c) => <td key={c.key} className={`${tdClass} ${c.tdClass ?? ''}${clip}`}>{c.cell(r)}</td>)}
              {fixed && <td />}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
