// /app/outils : catalogue des outils (par famille) ; /app/outils/:id : l'outil, dans l'espace.
// Outils locaux : les calculs restent dans ce navigateur, rien n'est enregistré dans l'espace.

import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Monitor, ArrowRight } from 'lucide-react';
import { TOOL_COMPONENTS, TOOL_EMBED_CSS } from '../../App.jsx';
import { I18nProvider, useLang } from '../../shared/i18n/I18nProvider.jsx';
import { APP_TOOLS, TOOL_GROUPS } from '../tools';
import { PageHeader } from '../ui';

const LocalNote = ({ className = '' }) => (
  <div className={`inline-flex items-center gap-1.5 text-xs text-slate-500 ${className}`}>
    <Monitor size={13} /> Outil local : les calculs restent dans ce navigateur, rien n’est enregistré dans votre espace.
  </div>
);

export function ToolsHome() {
  useEffect(() => { document.title = 'Outils | Atelier Logistique'; }, []);
  return (
    <>
      <PageHeader title="Outils" subtitle="Les outils du site, à portée de main dans votre espace." />
      <div className="px-5 sm:px-8 py-6 space-y-6 max-w-6xl">
        <LocalNote />
        {TOOL_GROUPS.map((g) => (
          <section key={g.id}>
            <div className="font-jetbrains text-[11px] tracking-wider text-slate-400 mb-2 flex items-center gap-2"><g.icon size={13} /> {g.label.toUpperCase()}</div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {g.tools.map((t) => (
                <Link key={t.id} to={`/app/outils/${t.id}`} className="group rounded-xl bg-white border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm transition">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center"><t.icon size={18} /></span>
                    <span className="font-semibold text-slate-900 flex-1">{t.name}</span>
                    <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-600" />
                  </div>
                  <p className="text-sm text-slate-500 mt-2">{t.desc}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

export function ToolInApp() {
  const { id } = useParams();
  const navigate = useNavigate();
  const tool = APP_TOOLS.find((t) => t.id === id);
  const Comp = TOOL_COMPONENTS[id];
  const lang = useLang();
  useEffect(() => { if (tool) document.title = `${tool.name} | Atelier Logistique`; }, [tool]);
  if (!tool || !Comp) return <div className="p-10 text-center text-slate-500">Outil introuvable. <Link to="/app/outils" className="text-blue-700">Tous les outils</Link></div>;
  return (
    <div className="tool-embedded">
      <style>{TOOL_EMBED_CSS}</style>
      <div className="bg-white border-b border-slate-200 px-5 sm:px-8 py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-bricolage font-semibold text-slate-900 flex items-center gap-2"><tool.icon size={17} className="text-blue-700" /> {tool.name}</span>
        <LocalNote />
      </div>
      <I18nProvider lang={lang}><Comp onBack={() => navigate('/app/outils')} /></I18nProvider>
    </div>
  );
}
