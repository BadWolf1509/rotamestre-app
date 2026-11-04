/**
 * O que o mini-mapa nativo (`MiniMap.tsx`) e o web (`MiniMap.web.tsx`)
 * compartilham: o teto de fonte e o texto do chip. A paleta do que fica sobre
 * o mapa mora em `@/components/map/coresSobreOMapa`.
 */

import { formatarDecimal } from '@/lib/formatNumber';

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
