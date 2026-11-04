/**
 * Badge de status da rota no cabeçalho mobile do mapa-rota.
 *
 * A cor de cada status vem de `ROUTE_STATUS_CONFIG` (fonte única, a mesma do
 * desktop e do card do Dashboard); aqui só se escolhe o fundo claro que
 * acompanha cada cor. Mora no módulo do mapa-rota, e não no `statusConfig`,
 * para a constante (usada pelos marcadores de mapa) não depender do tema.
 *
 * Status fora da lista (valor novo no CHECK do banco) cai no neutro em vez de
 * quebrar a tela.
 */

import {
  ROUTE_STATUS_CONFIG,
  type StatusColorKey,
} from '@/constants/statusConfig';
import type { Theme } from '@/utils/styles';

type Colors = Theme['colors'];

export interface BadgeDoStatus {
  container: { backgroundColor: string; borderColor: string };
  text: { color: string };
}

const FUNDO_POR_COR: Record<
  StatusColorKey,
  'warningBg' | 'infoBg' | 'successBg' | 'errorBg' | 'gray100'
> = {
  warning: 'warningBg',
  info: 'infoBg',
  success: 'successBg',
  error: 'errorBg',
  gray600: 'gray100',
};

export function badgeDoStatusDaRota(
  colors: Colors,
  status?: string | null,
): BadgeDoStatus {
  const config = status
    ? (ROUTE_STATUS_CONFIG as Record<string, { colorKey: StatusColorKey }>)[
        status.toLowerCase()
      ]
    : undefined;

  if (config) {
    const cor = colors[config.colorKey];
    return {
      container: {
        backgroundColor: colors[FUNDO_POR_COR[config.colorKey]],
        borderColor: cor,
      },
      text: { color: cor },
    };
  }

  return {
    container: {
      backgroundColor: colors.gray100,
      borderColor: colors.gray200,
    },
    text: { color: colors.gray700 },
  };
}
