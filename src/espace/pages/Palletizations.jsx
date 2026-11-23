import { useCallback } from 'react';
import { useEspace } from '../useEspace';
import { listPalletizations, SOURCE } from '../data';
import DocList from '../DocList';
import { DocChip } from '../ui';

export default function Palletizations() {
  const { org } = useEspace();
  const fetch = useCallback(() => listPalletizations(org.id), [org.id]);
  return (
    <DocList title="Palettisations" subtitle="Colis → palettes complètes et mixtes, puis « Charger le camion »" docTitle="Palettisations"
      newLabel="Nouvelle palettisation" newPath="/app/palettisations/nouveau" basePath="/app/palettisations" fetch={fetch}
      columns={[
        { h: 'Origine', cell: (r) => SOURCE[r.source] ?? r.source },
        { h: 'Palettes', cell: (r) => r.result?.summary?.pallets ?? '—' },
        { h: 'Poids', cell: (r) => (r.result?.summary ? `${Math.round(r.result.summary.weight).toLocaleString('fr-FR')} kg` : '—') },
        { h: 'Chargement', cell: (r) => (r.shipments?.code ? <DocChip kind="shipment" to={`/app/chargements/${r.shipments.code}`} code={r.shipments.code} /> : '—') },
      ]} />
  );
}
