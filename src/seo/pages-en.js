// Données SEO des pages anglaises : une seule source pour
//  - le pré-rendu HTML (scripts/en-pages.mjs, scripts/prerender.mjs) ;
//  - les outils React en anglais (titre de l'onglet, FAQ affichée).
// Fichier sans JSX ni dépendance : importable depuis Node.

import { SITE_NAME } from './pages.js';

export const LOAD_FAQ_EN = [
  { q: 'Is the load planner free? Do I need an account?', a: 'It is free and needs no account. Everything runs in your browser: your data is neither stored nor sent to any server.' },
  { q: 'What can I load?', a: 'Rectangular cartons, cases and pallets. For each line you enter dimensions, weight, quantity, whether it may be rotated, and its stacking rule: free, top only (nothing on top), floor only, or floor only with nothing on top. The truck is loaded wall by wall, from the cab to the doors.' },
  { q: 'Which vehicles and containers are supported?', a: 'A 13.6 m semi-trailer, 20ft, 40ft and 40ft High Cube containers, and custom dimensions. The automatic fleet mode also offers vans and 12 t / 19 t rigid trucks and picks the cheapest combination that carries everything.' },
  { q: 'Can I plan a multi-drop route?', a: 'Yes. Give each line a stop number (1 = delivered first). The last stop is loaded at the front, the first by the doors, and no later drop blocks an earlier one. If not everything fits, you choose to drop a whole stop or only the excess cases.' },
  { q: 'Does it check axle loads and load securing?', a: 'Yes: centre of gravity, axle loads (with a suggested shift if one axle is overloaded) and the number of lashing straps according to EN 12195-1.' },
  { q: 'Can my ERP or WMS feed it?', a: 'Yes. Import an Excel or CSV file (or paste rows): columns and units (mm, cm, g, kg) are recognised and the mapping is saved. The loading sequence can be exported as CSV for your WMS.' },
];

export const PALLET_FAQ_EN = [
  { q: 'How many cartons fit on a Euro pallet?', a: 'Cartons per layer times the number of layers. Example: 400 × 300 × 250 mm cartons on a 1200 × 800 Euro pallet give 8 per layer; with a 1.80 m total height (144 mm deck included) that is 6 layers, so 48 cartons. The calculator also tests interlocked patterns mixing both orientations.' },
  { q: 'Euro or 1200 × 1000 pallet: which one?', a: 'Tick the pallets you actually have: the calculator picks the one that gives the fewest pallets, then the smallest truck floor area, then the lowest cost, and explains why. You can also force a pallet type per line or per customer.' },
  { q: 'What is a mixed pallet?', a: 'A pallet carrying several SKUs. The calculator first builds full single-SKU pallets (easier to pick and check), then puts the remainders on mixed pallets computed in 3D, heavy cases at the bottom and nothing on top of fragile ones.' },
  { q: 'How do I then load the pallets into a truck?', a: 'One click on “Load the truck” sends the pallets — dimensions, weight, stacking, stop — to the 3D load planner.' },
  { q: 'Is it free?', a: 'Yes, free and with no sign-up. The calculation runs in your browser: your data is not sent to any server.' },
];

/** Outils disponibles en anglais (mêmes id que TOOL_PAGES). */
export const TOOL_PAGES_EN = [
  {
    id: 'optimiseur-chargement',
    path: '/en/truck-load-planner',
    name: '3D truck load planner',
    title: `Free 3D truck load planner: semi-trailer & container loading plan | ${SITE_NAME}`,
    description: 'Free online 3D load planner for semi-trailers and 20ft / 40ft containers: pallets and cartons, multi-drop routes, stacking, axle loads, lashing straps. No sign-up.',
    h1: '3D truck load planner',
    intro: 'Plan how your pallets and cartons fit in a semi-trailer or a shipping container, in 3D, in seconds. Free, no sign-up, your data stays in your browser.',
    features: [
      '3D loading plan for a 13.6 m semi-trailer, 20ft, 40ft and 40ft High Cube containers or custom dimensions.',
      'Multi-drop routes: the first delivery is loaded by the doors and nothing blocks an earlier stop.',
      'Stacking rules, rotation, payload, axle loads with suggested load shift, lashing straps (EN 12195-1).',
      'Automatic fleet mode: the cheapest mix of vans, rigid trucks and trailers that carries everything.',
      'Excel / CSV import from your ERP or WMS, loading-sequence export, printable loading sheet.',
      'Step-by-step loading guide on the loader’s phone via QR code, with a photo of the loaded truck at the end.',
    ],
    faq: LOAD_FAQ_EN,
  },
  {
    id: 'pallet',
    path: '/en/palletizing-calculator',
    name: '3D pallet calculator',
    title: `Free 3D pallet calculator: palletizing plan for Euro & 1200 × 1000 pallets | ${SITE_NAME}`,
    description: 'How many cartons per pallet? Free 3D palletizing calculator: full and mixed pallets, Euro, 1200 × 1000 or custom pallets, then load the truck in one click. No sign-up.',
    h1: '3D pallet calculator',
    intro: 'Turn your cartons into optimised pallets — full and mixed — then send them to the truck load planner in one click.',
    features: [
      'Full single-SKU pallets first: best layer pattern (interlocked), alternating layers, centred load.',
      'Remainders on mixed pallets computed in 3D, never mixing two delivery stops.',
      'Tick the pallets you own (Euro, 1200 × 1000, half, US 48 × 40, custom): the best one is chosen and explained.',
      'Height and weight limits, pallet tare, stackable or not in the truck.',
      'Printable sheet, CSV export, and one-click transfer to the 3D truck load planner.',
    ],
    faq: PALLET_FAQ_EN,
  },
];

export const toolSeoEn = (id) => TOOL_PAGES_EN.find((t) => t.id === id) ?? null;
