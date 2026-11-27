import type { UnitDef, UnitKind } from './types';

export const UNITS: Record<UnitKind, UnitDef[]> = {
  length: [
    { id: 'mm', label: 'mm', factor: 1 },
    { id: 'cm', label: 'cm', factor: 10 },
    { id: 'm', label: 'm', factor: 1000 },
    { id: 'in', label: 'in', factor: 25.4 },
    { id: 'ft', label: 'ft', factor: 304.8 },
  ],
  mass: [
    { id: 'g', label: 'g', factor: 0.001 },
    { id: 'kg', label: 'kg', factor: 1 },
    { id: 't', label: 't', factor: 1000 },
    { id: 'lb', label: 'lb', factor: 0.45359237 },
  ],
};

export function unitFactor(kind: UnitKind, unitId: string | undefined, fallback: string): number {
  const list = UNITS[kind];
  return (list.find((u) => u.id === unitId) ?? list.find((u) => u.id === fallback) ?? list[0]).factor;
}

/**
 * Devine l'unité d'après l'en-tête de colonne : « Longueur (mm) », « Poids brut kg »,
 * « HAUTEUR_MM », « Poids (g) »… Renvoie null si rien n'est indiqué.
 */
export function detectUnit(header: string, kind: UnitKind): string | null {
  const h = ` ${header.toLowerCase().replace(/[()[\]_\-./]/g, ' ')} `;
  const ids = UNITS[kind].map((u) => u.id).sort((a, b) => b.length - a.length);
  for (const id of ids) {
    if (h.includes(` ${id} `)) return id;
  }
  if (kind === 'mass' && /\bgrammes?\b/.test(h)) return 'g';
  if (kind === 'mass' && /\btonnes?\b/.test(h)) return 't';
  if (kind === 'length' && /\bmillim/.test(h)) return 'mm';
  if (kind === 'length' && /\bcentim/.test(h)) return 'cm';
  if (kind === 'length' && /\binch(es)?\b|\bpouces?\b|"/.test(h)) return 'in';
  if (kind === 'mass' && /\blbs?\b|\bpounds?\b|\blivres?\b/.test(h)) return 'lb';
  return null;
}
