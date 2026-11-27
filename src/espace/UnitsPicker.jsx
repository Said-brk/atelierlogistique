// Choix de la devise et du système d'unités (création de l'entreprise, Paramètres › Entreprise).
import { useT } from '../shared/i18n/I18nProvider.jsx';
import { CURRENCIES, currencySymbol } from '../shared/units/units';

export default function UnitsPicker({ value, onChange, disabled = false, compact = false }) {
  const t = useT();
  const systems = [
    ['metric', t('Métrique'), 'cm · kg · m³'],
    ['imperial', t('US'), 'in · lb · ft³'],
  ];
  return (
    <div className={`flex flex-wrap items-center ${compact ? 'gap-2' : 'gap-3'}`}>
      <div role="radiogroup" aria-label={t('Unités')} className="inline-flex p-0.5 rounded-lg border border-slate-200 bg-slate-50">
        {systems.map(([v, l, hint]) => (
          <button key={v} type="button" role="radio" aria-checked={value.units === v} disabled={disabled} onClick={() => onChange({ ...value, units: v })}
            className={`px-3 py-1.5 rounded-md text-sm transition disabled:opacity-60 ${value.units === v ? 'bg-white shadow-sm text-blue-700 font-medium' : 'text-slate-500 hover:text-slate-800'}`}>
            {l} <span className="font-jetbrains text-[10px] text-slate-400">{hint}</span>
          </button>
        ))}
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-slate-600">{t('Devise')}
        <select value={value.currency} onChange={(e) => onChange({ ...value, currency: e.target.value })} disabled={disabled}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm disabled:bg-slate-50">
          {CURRENCIES.map((c) => <option key={c} value={c}>{c} ({currencySymbol(c)})</option>)}
        </select>
      </label>
    </div>
  );
}
