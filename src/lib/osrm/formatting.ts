/**
 * OSRM Formatting & Maneuver Translation
 *
 * Distance/duration formatting and Portuguese maneuver translations.
 */

import { formatarDecimal } from '@/lib/formatNumber';

// ============================================================================
// DISTANCE & DURATION FORMATTING
// ============================================================================

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${formatarDecimal(meters / 1000)}km`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return 'menos de 1 min';
  if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
}

// ============================================================================
// MANEUVER TRANSLATION
// ============================================================================

export const MANEUVER_TRANSLATIONS: Record<string, Record<string, string>> = {
  turn: {
    left: 'Vire à esquerda',
    right: 'Vire à direita',
    'sharp left': 'Vire acentuadamente à esquerda',
    'sharp right': 'Vire acentuadamente à direita',
    'slight left': 'Pegue à esquerda',
    'slight right': 'Pegue à direita',
    straight: 'Continue em frente',
    uturn: 'Faça o retorno',
  },
  'new name': {
    default: 'Continue em',
  },
  depart: {
    default: 'Siga em direção a',
  },
  arrive: {
    default: 'Você chegou ao destino',
  },
  merge: {
    default: 'Entre na via',
  },
  'on ramp': {
    default: 'Entre na rampa',
  },
  'off ramp': {
    default: 'Pegue a saída',
  },
  fork: {
    left: 'Mantenha-se à esquerda',
    right: 'Mantenha-se à direita',
  },
  'end of road': {
    left: 'No final da rua, vire à esquerda',
    right: 'No final da rua, vire à direita',
  },
  continue: {
    default: 'Continue',
  },
  roundabout: {
    default: 'Na rotatória',
  },
  rotary: {
    default: 'Na rotatória',
  },
  'roundabout turn': {
    default: 'Na rotatória',
  },
  notification: {
    default: '',
  },
};

export function translateManeuver(
  type: string,
  modifier?: string,
  streetName?: string,
): string {
  const typeTranslations = MANEUVER_TRANSLATIONS[type];

  if (!typeTranslations) {
    return streetName ? `Continue para ${streetName}` : 'Continue';
  }

  let instruction =
    typeTranslations[modifier || ''] || typeTranslations.default || 'Continue';

  if (streetName && streetName !== '' && type !== 'arrive') {
    instruction += ` ${streetName}`;
  }

  return instruction;
}
