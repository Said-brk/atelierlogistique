// Sélecteur de langue FR / EN (pastilles). tone : 'light' (fond blanc) | 'dark' (barre de l'Espace).
import { LANGS } from './core';
import { LANG_LABELS } from './userLang';

export default function LangSwitch({ value, onChange, tone = 'light', full = false, disabled = false, label }) {
  const dark = tone === 'dark';
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex items-center gap-0.5 p-0.5 rounded-lg border ${dark ? 'border-white/15 bg-white/5' : 'border-slate-200 bg-slate-50'} ${full ? 'w-full' : ''}`}>
      {LANGS.map((l) => {
        const on = l === value;
        return (
          <button key={l} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => onChange(l)}
            className={`${full ? 'flex-1' : ''} inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${on ? (dark ? 'bg-white text-slate-900' : 'bg-white text-blue-700 shadow-sm') : (dark ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-slate-800')}`}>
            <span className="font-jetbrains text-[10px] uppercase">{l}</span>{full && <span>{LANG_LABELS[l]}</span>}
          </button>
        );
      })}
    </div>
  );
}
