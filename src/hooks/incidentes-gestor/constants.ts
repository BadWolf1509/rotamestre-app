/**
 * Constants and label factories for incidents
 */

import { corDeTextoDoStatus } from '@/constants/statusConfig';
import type { Theme } from '@/utils/styles';

import type { CategoriaLabel, StatusLabel } from './types';

/**
 * Create category labels based on theme
 */
export function createCategoriaLabels(
  theme: Theme,
): Record<string, CategoriaLabel> {
  return {
    accident: {
      label: 'Acidente/Incidente',
      icon: 'warning',
      color: theme.colors.incident.accident,
    },
    absent: {
      label: 'Cliente ausente',
      icon: 'home-outline',
      color: theme.colors.incident.absent,
    },
    wrong_address: {
      label: 'Endereço incorreto',
      icon: 'location-outline',
      color: theme.colors.incident.wrongAddress,
    },
    blocked: {
      label: 'Acesso bloqueado',
      icon: 'lock-closed-outline',
      color: theme.colors.incident.blocked,
    },
    vehicle: {
      label: 'Problema no veículo',
      icon: 'car-outline',
      color: theme.colors.incident.vehicle,
    },
    other: {
      label: 'Outros',
      icon: 'ellipsis-horizontal-outline',
      color: theme.colors.incident.other,
    },
  };
}

/**
 * Create status labels based on theme. `textColor` é o tom do texto sobre o
 * fundo do selo soft (>= 4,5:1); o "Fechado" mantém a borda gray500 e escreve
 * em gray600.
 */
export function createStatusLabels(theme: Theme): Record<string, StatusLabel> {
  const { colors } = theme;
  return {
    aberto: {
      label: 'Aberto',
      color: colors.error,
      textColor: corDeTextoDoStatus('error', colors),
    },
    em_analise: {
      label: 'Em análise',
      color: colors.warning,
      textColor: corDeTextoDoStatus('warning', colors),
    },
    resolvido: {
      label: 'Resolvido',
      color: colors.success,
      textColor: corDeTextoDoStatus('success', colors),
    },
    fechado: {
      label: 'Fechado',
      color: colors.gray500,
      textColor: corDeTextoDoStatus('gray600', colors),
    },
  };
}

/**
 * Format date for display
 */
export function formatIncidentDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
