// Identité de la marque Atelier Logistique : source unique pour
//  - la fiche Organization / SoftwareApplication (JSON-LD) du pré-rendu (scripts/prerender.mjs) ;
//  - la page « À propos » (/a-propos) et sa version anglaise (/en/about), en React et en HTML pré-rendu.
// But : que Google (et son IA) reconnaisse « Atelier Logistique » comme un logiciel,
// et non comme l'expression générique (hôtel logistique, entrepôt…).

export const LINKEDIN_URL = 'https://www.linkedin.com/company/atelierlogistique/';

export const BRAND = {
  name: 'Atelier Logistique',
  alternateNames: ['atelierlogistique', 'AtelierLogistique', 'atelierlogistique.com', 'Atelier Logistique SaaS'],
  sameAs: [LINKEDIN_URL],
  slogan: { fr: 'Palettisez. Chargez. Payez le juste prix du transport.', en: 'Palletise. Load. Pay the right freight price.' },
  /** Phrase de définition : reprise telle quelle partout (site, LinkedIn, annuaires). */
  definition: {
    fr: 'Atelier Logistique (atelierlogistique.com) est un logiciel SaaS en ligne pour les professionnels de la logistique et du transport : palettisation 3D, plan de chargement camion et conteneur en 3D, mètres plancher, choix du transporteur le moins cher et contrôle des factures transport.',
    en: 'Atelier Logistique (atelierlogistique.com) is an online SaaS for logistics and transport teams: 3D palletising, 3D truck and container load planning, loading meters, cheapest-carrier selection and freight invoice audit.',
  },
  knowsAbout: ['Palettisation', 'Plan de chargement camion', 'Optimisation de chargement conteneur', 'Mètre plancher', 'Coût transport', 'Contrôle des factures transport', 'Supply chain', 'Logistique'],
};

const T = {
  fr: {
    path: '/a-propos',
    alt: '/en/about',
    title: 'À propos d’Atelier Logistique : logiciel de palettisation et de chargement camion 3D',
    description: 'Atelier Logistique est un logiciel SaaS en ligne : palettisation 3D, plan de chargement camion et conteneur 3D, mètres plancher, transporteur le moins cher et contrôle des factures.',
    kicker: 'À PROPOS',
    h1: 'Qu’est-ce qu’Atelier Logistique\u00a0?',
    disambiguation: 'Atelier Logistique est un logiciel, pas un lieu : ce n’est ni un hôtel logistique, ni un entrepôt, ni un prestataire de stockage. C’est une application web que les équipes logistiques utilisent depuis leur navigateur.',
    sections: [
      { h: 'Ce que fait le logiciel', items: [
        'Palettisation 3D : palettes complètes et mixtes, meilleur type de palette, plan de palette imprimable.',
        'Plan de chargement camion et conteneur en 3D : semi-remorques, porteurs, conteneurs 20 et 40 pieds, tournées multi-arrêts, charge par essieu.',
        'Flotte automatique : le bon nombre de véhicules, et le bon type, pour une commande.',
        'Coûts transport : mètres plancher, poids taxable, grilles tarifaires des transporteurs, transporteur le moins cher, surcharge gazole et contrôle des factures.',
        'QR code cariste : le plan de chargement sur le téléphone du cariste, étape par étape.',
        'Import ERP / WMS (fichiers Excel ou CSV) et API pour automatiser les calculs.',
      ] },
      { h: 'Pour qui', text: 'Responsables logistique et transport, chefs de quai, équipes ADV et service client, industriels et distributeurs qui expédient des palettes ou des colis en camion ou en conteneur.' },
      { h: 'Gratuit', text: 'Les outils en ligne s’utilisent sans compte. L’espace personnel (historique des chargements, transporteurs, grilles tarifaires, travail en équipe) est gratuit pendant la phase pilote.' },
      { h: 'Langues et unités', text: 'En français et en anglais, en unités métriques (cm, kg, €) ou américaines (in, lb, $).' },
    ],
    contactH: 'Contact',
    contact: 'Écrivez-nous :',
    linkedin: 'Suivre Atelier Logistique sur LinkedIn',
    cta: 'Essayer les outils',
    ctaHref: '/chargement-palettisation',
  },
  en: {
    path: '/en/about',
    alt: '/a-propos',
    title: 'About Atelier Logistique: 3D palletising and truck load planning software',
    description: 'Atelier Logistique is an online SaaS: 3D palletising, 3D truck and container load planning, loading meters, cheapest carrier and freight invoice audit.',
    kicker: 'ABOUT',
    h1: 'What is Atelier Logistique?',
    disambiguation: 'Atelier Logistique is software, not a place: it is not a logistics hotel, a warehouse or a storage provider. It is a web app logistics teams use in their browser.',
    sections: [
      { h: 'What the software does', items: [
        '3D palletising: full and mixed pallets, best pallet type, printable pallet plan.',
        '3D truck and container load planning: semi-trailers, rigid trucks, 20ft and 40ft containers, multi-drop routes, axle loads.',
        'Automatic fleet: the right number and type of vehicles for an order.',
        'Freight costs: loading meters, chargeable weight, carrier rate cards, cheapest carrier, fuel surcharge and invoice audit.',
        'Loader QR code: the load plan on the forklift driver’s phone, step by step.',
        'ERP / WMS import (Excel or CSV files) and an API to automate calculations.',
      ] },
      { h: 'Who it is for', text: 'Logistics and transport managers, dock supervisors, customer service teams, manufacturers and distributors shipping pallets or parcels by truck or container.' },
      { h: 'Free', text: 'The online tools work without an account. The personal workspace (load history, carriers, rate cards, teamwork) is free during the pilot phase.' },
      { h: 'Languages and units', text: 'In English and French, in US (in, lb, $) or metric (cm, kg, €) units.' },
    ],
    contactH: 'Contact',
    contact: 'Write to us:',
    linkedin: 'Follow Atelier Logistique on LinkedIn',
    cta: 'Try the tools',
    ctaHref: '/en',
  },
};

export const aboutPage = (lang = 'fr') => ({ ...T[lang === 'en' ? 'en' : 'fr'], definition: BRAND.definition[lang === 'en' ? 'en' : 'fr'] });
