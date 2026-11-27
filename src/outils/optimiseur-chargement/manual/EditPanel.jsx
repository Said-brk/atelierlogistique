// Panneau du mode « modifier à la main » : colis sélectionné, déplacements, pivoter, retirer,
// zone d'attente, annuler / rétablir, contrôle du plan. Raccourcis clavier quand il est ouvert.

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, RotateCw, Trash2, Undo2, Redo2, RotateCcw, CheckCircle2, AlertTriangle, PackagePlus, X } from 'lucide-react';
import { t } from '../../../shared/i18n/core';
import { cmToDim } from '../../../shared/units/units';
import { wU, lU, dU, vU, formatKg } from '../uiHelpers';

const STEPS = [10, 50, 100]; // mm
const cm = (mm) => Math.round(cmToDim(mm / 10) * 10) / 10; // cm, ou pouces (unités US)

function Btn({ onClick, title, children, disabled, danger }) {
  return (
    <button type="button" onClick={onClick} title={title} disabled={disabled}
      className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border font-jetbrains text-[11px] disabled:opacity-40 ${danger ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
      {children}
    </button>
  );
}

export default function EditPanel({ edit, rulesOf, onClose }) {
  const [step, setStep] = useState(50);
  const [msg, setMsg] = useState(null);
  const sel = edit.placed.find((p) => p.id === edit.selectedId) ?? null;
  const canRotate = sel ? rulesOf(sel).canRotate : false;
  const { issues } = edit;

  // Raccourcis : flèches (longueur / largeur), Page ↑/↓ (hauteur), R, Suppr, Ctrl+Z / Ctrl+Y.
  useEffect(() => {
    const onKey = (e) => {
      if (/input|select|textarea/i.test(e.target?.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); (e.shiftKey ? edit.redo : edit.undo)(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); edit.redo(); return; }
      if (!sel) return;
      const k = e.key;
      const map = { ArrowLeft: [-step, 0, 0], ArrowRight: [step, 0, 0], ArrowUp: [0, -step, 0], ArrowDown: [0, step, 0], PageUp: [0, 0, step], PageDown: [0, 0, -step] };
      if (map[k]) { e.preventDefault(); edit.move(sel.id, ...map[k]); }
      else if (k === 'r' || k === 'R') edit.rotate(sel.id);
      else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); edit.remove(sel.id); edit.select(null); }
      else if (k === 'Escape') edit.select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [edit, sel, step]);

  const restore = (id) => {
    const ok = edit.restore(id);
    setMsg(ok ? null : t('Pas de place libre pour ce colis : déplacez ou retirez-en un autre.'));
  };

  const nbIssues = issues.all.size;
  return (
    <div className="border-t border-amber-200 bg-amber-50/60 px-3 sm:px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-jetbrains text-[11px] font-semibold text-amber-800">{t('MODIFIER À LA MAIN')}</div>
        <div className="flex flex-wrap gap-1.5">
          <Btn onClick={edit.undo} disabled={!edit.canUndo} title={t('Annuler (Ctrl+Z)')}><Undo2 size={12} /></Btn>
          <Btn onClick={edit.redo} disabled={!edit.canRedo} title={t('Rétablir (Ctrl+Y)')}><Redo2 size={12} /></Btn>
          <Btn onClick={edit.reset} disabled={!edit.edited} title={t('Revenir au plan calculé')}><RotateCcw size={12} />{' '}{t('Plan calculé')}</Btn>
          <Btn onClick={onClose} title={t('Terminer')}><X size={12} />{' '}{t('Terminer')}</Btn>
        </div>
      </div>

      {sel ? (
        <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="font-jetbrains text-xs"><b className="text-slate-900">{sel.reference}</b>{' '}
              <span className="text-slate-500">{cm(sel.length)} × {cm(sel.width)} × {cm(sel.height)} {dU()} · {formatKg(sel.weight)} {wU()}</span></div>
            <div className="font-jetbrains text-[10px] text-slate-500">{t('x {x} · y {y} · z {z} {du}', { wu: wU(), lu: lU(), du: dU(), vu: vU(),  x: cm(sel.x), y: cm(sel.y), z: cm(sel.z) })}</div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-slate-100 mr-1" title={t('Pas de déplacement')}>
              {STEPS.map((s) => (
                <button key={s} type="button" onClick={() => setStep(s)} className="px-1.5 py-1 rounded font-jetbrains text-[10px]"
                  style={step === s ? { background: '#fff', fontWeight: 600, color: '#1D4ED8' } : { color: '#64748B' }}>{cm(s)} {dU()}</button>
              ))}
            </div>
            <Btn onClick={() => edit.move(sel.id, -step, 0, 0)} title={t('Vers la cabine (←)')}><ArrowLeft size={12} />{' '}{t('Cabine')}</Btn>
            <Btn onClick={() => edit.move(sel.id, step, 0, 0)} title={t('Vers les portes (→)')}>{t('Portes')}{' '}<ArrowRight size={12} /></Btn>
            <Btn onClick={() => edit.move(sel.id, 0, -step, 0)} title={t('Vers la gauche (↑)')}><ArrowUp size={12} />{' '}{t('Gauche')}</Btn>
            <Btn onClick={() => edit.move(sel.id, 0, step, 0)} title={t('Vers la droite (↓)')}><ArrowDown size={12} />{' '}{t('Droite')}</Btn>
            <Btn onClick={() => edit.move(sel.id, 0, 0, step)} title={t('Monter (Page ↑)')}><ChevronsUp size={12} /></Btn>
            <Btn onClick={() => edit.settle(sel.id)} title={t('Poser sur ce qu’il y a dessous')}><ChevronsDown size={12} />{' '}{t('Poser')}</Btn>
            <Btn onClick={() => edit.rotate(sel.id)} disabled={!canRotate} title={canRotate ? t('Pivoter d’un quart de tour (R)') : t('Rotation interdite pour ce colis')}><RotateCw size={12} />{' '}{t('Pivoter')}</Btn>
            <Btn danger onClick={() => { edit.remove(sel.id); edit.select(null); }} title={t('Retirer du camion (Suppr)')}><Trash2 size={12} />{' '}{t('Retirer')}</Btn>
          </div>
        </div>
      ) : (
        <div className="font-jetbrains text-[11px] text-slate-600">
          {t('Cliquez un colis pour le sélectionner, puis faites-le glisser ou utilisez les boutons. Il se cale contre les parois et les colis voisins.')}
        </div>
      )}

      <div className="font-jetbrains text-[11px]">
        {nbIssues === 0 ? (
          <div className="flex items-center gap-1.5 text-emerald-700"><CheckCircle2 size={13} />{' '}{t('Plan valide : aucun chevauchement, tout repose.')}</div>
        ) : (
          <div className="flex items-start gap-1.5 text-red-700"><AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>{[
              issues.collisions.size && t('{n} colis se chevauchent', { n: issues.collisions.size }),
              issues.outside.size && t('{n} dépassent du contenant', { n: issues.outside.size }),
              issues.floating.size && t('{n} ne reposent pas assez', { n: issues.floating.size }),
              issues.stacking.size && t('{n} posés sur un colis non gerbable ou hors du sol', { n: issues.stacking.size }),
            ].filter(Boolean).join(' · ')} {t('(en rouge sur la vue)')}</span>
          </div>
        )}
      </div>

      {edit.staged.length > 0 && (
        <div>
          <div className="font-jetbrains text-[10px] text-slate-500 mb-1">{t('ZONE D’ATTENTE · {n} colis retiré(s)', { n: edit.staged.length })}</div>
          <div className="flex flex-wrap gap-1.5">
            {edit.staged.map((s) => (
              <Btn key={s.id} onClick={() => restore(s.id)} title={t('Replacer dans le camion (première place libre)')}>
                <PackagePlus size={12} />{' '}{s.reference}
              </Btn>
            ))}
          </div>
          {msg && <div className="font-jetbrains text-[11px] text-red-700 mt-1">{msg}</div>}
        </div>
      )}
    </div>
  );
}
