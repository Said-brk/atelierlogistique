# ATELIER · Suite d'outils Supply Chain

Suite d'outils web par **BARKco** :
- ZPL Viewer (rendu d'étiquettes Zebra)
- Générateur de codes-barres (10 symbologies, exports PNG/SVG/PDF)
- Calculateur de palettisation (avec visualisation 3D)
- Calculateur de stock de sécurité (mode article unique + multi-articles avec import d'historique de ventes)

## Démarrage en local

```bash
npm install
npm run dev
```

L'application s'ouvre sur `http://localhost:5173`.

## Build de production

```bash
npm run build
```

Le dossier `dist/` contient les fichiers à servir.

## Déploiement

Déployable sur **Vercel** ou **Netlify** sans configuration. Connecter le repo Git, ils détectent Vite automatiquement.

## Stack

- React 18 + Vite
- Tailwind CSS
- lucide-react (icônes)
- SheetJS (xlsx) pour import/export Excel
- bwip-js, jsPDF, JSZip chargés en CDN à la volée
