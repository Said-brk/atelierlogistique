// Contenu éditorial en bas des outils (fonctionnement, guides, FAQ) : gardé dans la page — lu par les
// moteurs de recherche — mais replié par défaut pour ne pas encombrer l'espace de travail.

import { BookOpen, ChevronDown } from 'lucide-react';
import { t } from '../i18n/core';

export default function SeoFold({ children }) {
  return (
    <details className="group max-w-3xl mx-auto px-4 sm:px-6 py-8 print:hidden">
      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 hover:border-slate-300 hover:text-slate-800">
        <span className="flex items-center gap-2"><BookOpen size={15} className="text-slate-400 shrink-0" />{t('À propos de cet outil : fonctionnement, guides et questions fréquentes')}</span>
        <ChevronDown size={16} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="pt-8 space-y-8">{children}</div>
    </details>
  );
}
