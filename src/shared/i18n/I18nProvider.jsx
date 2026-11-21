// Langue de l'interface pour un sous-arbre React (un outil, une page).
// La langue vient de la route (/en/… → anglais) : rien n'est stocké.

import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_LANG, setCurrentLang, translate, translateText, locale } from './core';
import './dictionaries';

const LangContext = createContext(DEFAULT_LANG);

export function I18nProvider({ lang = DEFAULT_LANG, children }) {
  setCurrentLang(lang); // pour les exports et PDF déclenchés depuis cet écran
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/**
 * const t = useT();  t('Texte français', { n })   — et t.text(messageDuMoteur), t.lang, t.num(1234.5)
 */
export function useT() {
  const lang = useLang();
  return useMemo(() => {
    const fn = (key, vars) => translate(lang, key, vars);
    fn.lang = lang;
    fn.text = (s) => translateText(lang, s);
    fn.num = (n, opts) => Number(n).toLocaleString(locale(lang), opts);
    return fn;
  }, [lang]);
}
