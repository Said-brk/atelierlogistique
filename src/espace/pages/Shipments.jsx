import { useCallback } from 'react';
import { useEspace } from '../useEspace';
import { listShipments, SOURCE } from '../data';
import DocList from '../DocList';
import { DocChip, fmtDate, pct } from '../ui';

export default function Shipments() {
  const { org } = useEspace();
  const fetch = useCallback(() => listShipments(org.id), [org.id]);
  return (
    <DocList title="Chargements" subtitle="Arrivés de votre WMS / ERP, d’un fichier, ou créés ici" docTitle="Chargements"
      newLabel="Nouveau chargement" newPath="/app/chargements/nouveau" basePath="/app/chargements" fetch={fetch}
      columns={[
        { h: 'Origine', cell: (r) => SOURCE[r.source] ?? r.source },
        { h: 'Départ', cell: (r) => <span className="whitespace-nowrap">{fmtDate(r.departure_at)}</span> },
        { h: 'Véhicule', cell: (r) => <span className="whitespace-nowrap">{r.result?.summary?.vehicle ?? '—'}</span> },
        { h: 'Remplissage', cell: (r) => pct(r.result?.summary?.fill) },
        { h: 'Palettes de', cell: (r) => (r.palletizations?.length
          ? <span className="flex flex-wrap gap-1">{r.palletizations.map((p) => <DocChip key={p.code} kind="pallet" to={`/app/palettisations/${p.code}`} code={p.code} />)}</span> : '—') },
      ]} />
  );
}
