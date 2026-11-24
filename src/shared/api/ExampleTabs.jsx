// Onglets d'exemples de code (PowerShell / curl) avec bouton Copier. Windows par défaut.
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function ExampleTabs({ examples }) {
  const [tab, setTab] = useState(examples[0].id);
  const [ok, setOk] = useState(false);
  const ex = examples.find((e) => e.id === tab) ?? examples[0];
  const copy = async () => { try { await navigator.clipboard.writeText(ex.code); setOk(true); setTimeout(() => setOk(false), 1800); } catch { /* indisponible */ } };
  return (
    <div className="my-3 rounded-xl bg-slate-900 overflow-hidden">
      <div className="flex items-center gap-1 px-2 pt-2 border-b border-white/10">
        {examples.map((e) => (
          <button key={e.id} type="button" onClick={() => setTab(e.id)}
            className={`px-3 py-1.5 rounded-t-md text-xs font-medium ${tab === e.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{e.label}</button>
        ))}
        <button type="button" onClick={copy} className="ml-auto mb-1.5 inline-flex items-center gap-1 rounded-md bg-white/10 hover:bg-white/20 px-2 py-1 text-[11px] text-slate-200">
          {ok ? <Check size={12} /> : <Copy size={12} />}{ok ? 'Copié' : 'Copier'}
        </button>
      </div>
      <pre className="p-4 text-[12.5px] leading-relaxed overflow-x-auto font-jetbrains text-slate-100">{ex.code}</pre>
    </div>
  );
}
