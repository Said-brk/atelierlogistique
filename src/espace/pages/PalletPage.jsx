import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Palletizer from '../../outils/palettisation/Palletizer.jsx';
import { PageHeader } from '../ui';

// Palettisation dans l'espace : « Charger le camion » crée un nouveau chargement avec ces palettes.
export default function PalletPage() {
  const navigate = useNavigate();
  useEffect(() => { document.title = 'Palettisation | Atelier Logistique'; }, []);
  return (
    <>
      <PageHeader title="Palettisation" subtitle="Colis → palettes complètes et mixtes. « Charger le camion » crée un chargement avec ces palettes." />
      <Palletizer embedded onLoadTruck={() => navigate('/app/chargements/nouveau')} />
    </>
  );
}
