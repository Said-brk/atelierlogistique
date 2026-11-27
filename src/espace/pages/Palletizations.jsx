import { useCallback } from 'react';
import { useEspace } from '../useEspace';
import { listPalletizations, SOURCE } from '../data';
import DocList from '../DocList';
import { DocChip } from '../ui';
import { t as tr, N_, numLocale } from '../../shared/i18n/core';
import { fmtWeight } from '../../shared/units/units';

export default function Palletizations() {
  const { org } = useEspace();
  const fetch = useCallback(() => listPalletizations(org.id), [org.id]);
  return (
    <DocList title={tr('Palettisations')} subtitle={tr('Colis → palettes complètes et mixtes, puis « Charger le camion »')} docTitle={tr('Palettisations')}
      newLabel={tr('Nouvelle palettisation')} newPath="/app/palettisations/nouveau" basePath="/app/palettisations" fetch={fetch}
      columns={[
        { h: N_('Origine'), cell: (r) => SOURCE[r.source] ?? r.source },
        { h: N_('Palettes'), cell: (r) => r.result?.summary?.pallets ?? '—' },
        { h: N_('Poids'), cell: (r) => (r.result?.summary ? fmtWeight(r.result.summary.weight) : '—') },
        { h: N_('Chargement'), cell: (r) => (r.shipments?.code ? <DocChip kind="shipment" to={`/app/chargements/${r.shipments.code}`} code={r.shipments.code} /> : '—') },
      ]} />
  );
}
