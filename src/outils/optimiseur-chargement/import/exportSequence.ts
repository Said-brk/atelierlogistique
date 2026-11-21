// Export de la séquence de chargement (format standard Atelier Logistique v1).
// Une ligne par colis : réimportable dans un WMS / ERP pour guider le chargement
// (ordre de préparation, appel des supports au quai, contrôle au chargement).

import type { OptimizationResult } from '../engine/types';
import { t, N_ } from '../../../shared/i18n/core';

export const SEQUENCE_HEADERS = [
  N_('Séquence'), N_('Statut'), N_('Mur'), N_('Arrêt'), N_('Destination'), N_('Référence'), N_('N° support (SSCC)'),
  N_('X depuis cabine (cm)'), N_('Y depuis gauche (cm)'), N_('Z depuis plancher (cm)'),
  N_('Longueur placée (cm)'), N_('Largeur placée (cm)'), N_('Hauteur placée (cm)'), N_('Poids (kg)'), N_('Pivoté'),
];

/** Identifiants d'unités importés, par ligne de colis (definitionId). */
export type UnitIdsByDefinition = Record<string, string[] | undefined>;

const cm = (mm: number) => Math.round(mm / 10 * 10) / 10;

/** Index de l'unité dans sa ligne : les instances moteur sont nommées « <definitionId>#<k> ». */
const unitIndex = (instanceId: string) => {
  const m = /#(\d+)$/.exec(instanceId);
  return m ? parseInt(m[1], 10) : 0;
};

export function sequenceRows(result: OptimizationResult, unitIds: UnitIdsByDefinition = {}): (string | number)[][] {
  const label = (defId: string, ref: string, instanceId: string) => {
    const k = unitIndex(instanceId);
    return unitIds[defId]?.[k] ?? `${ref}-${k + 1}`;
  };
  const placed = [...result.placedItems]
    .sort((a, b) => a.sequence - b.sequence)
    .map((p) => {
      const rotated = p.length !== p.originalLength || p.width !== p.originalWidth || p.height !== p.originalHeight;
      return [
        p.sequence, t('Chargé'), p.wall || '', p.stop, p.destination || '', p.reference, label(p.definitionId, p.reference, p.id),
        cm(p.x), cm(p.y), cm(p.z), cm(p.length), cm(p.width), cm(p.height),
        Math.round(p.weight * 100) / 100, rotated ? t('Oui') : t('Non'),
      ];
    });
  const left = result.unpackedItems.map((u) => [
    '', t('Non chargé'), '', u.stop, u.destination || '', u.reference, label(u.definitionId, u.reference, u.id),
    '', '', '', cm(u.dimensions.length), cm(u.dimensions.width), cm(u.dimensions.height),
    Math.round(u.weight * 100) / 100, '',
  ]);
  return [...placed, ...left];
}
