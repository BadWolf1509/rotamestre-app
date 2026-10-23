/**
 * O que o mini-mapa nativo (`MiniMap.tsx`) e o web (`MiniMap.web.tsx`)
 * compartilham: as cores do que fica sobre o mapa e o texto do chip.
 */

import { formatarDecimal } from '@/lib/formatNumber';
import { defaultTheme } from '@/utils/styles.base';

const claro = defaultTheme.colors;

/**
 * Cores fixas para o que fica SOBRE o mapa (pinos, chip, botões).
 *
 * O estilo do mapa é sempre claro, mas `colors.white`/`colors.black` do tema
 * se invertem no escuro (`white` vira #1a2029): a borda dos pinos sumia e o
 * número saía escuro. Por isso nada aqui vem do tema ativo: é a paleta clara,
 * a mesma em que o mapa é desenhado. Use só no mini-mapa.
 */
export const CORES_SOBRE_O_MAPA = {
  branco: '#ffffff',
  sombra: '#000000',
  marca: claro.primary,
  proxima: claro.warning,
  pendente: claro.gray500,
  concluida: claro.success,
  usuario: claro.info,
} as const;

/** Mesmo teto de ampliação da fonte do sistema usado no MainCard/ParadaCard. */
export const MAX_FONTE_SOBRE_O_MAPA = 1.3;

export function rotuloParadasRestantes(n: number): string {
  return n === 1 ? '1 parada restante' : `${n} paradas restantes`;
}

/**
 * "2 paradas restantes • 15,5 km no total • trajeto indisponível".
 * A distância é da rota inteira, não do que falta.
 */
export function textoDoChip({
  restantes,
  distanciaKm,
  trajetoIndisponivel,
}: {
  restantes: number;
  distanciaKm: number | null;
  trajetoIndisponivel: boolean;
}): string {
  const partes = [rotuloParadasRestantes(restantes)];
  if (distanciaKm) partes.push(`${formatarDecimal(distanciaKm)} km no total`);
  if (trajetoIndisponivel) partes.push('trajeto indisponível');
  return partes.join(' • ');
}
