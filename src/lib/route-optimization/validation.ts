/**
 * Route validation: dependency checks, waypoint limits, coordinate validation.
 */

import { detectarCiclos } from './cycleDetection';
import { MAX_WAYPOINTS, WAYPOINTS_RECOMENDADO } from './types';

import type { ParadaParaOtimizar, ValidacaoRotaResult } from './types';

/**
 * Valida se os vinculos de uma lista de paradas sao consistentes.
 */
export function validarVinculos(paradas: ParadaParaOtimizar[]): string[] {
  const erros: string[] = [];
  const idsExistentes = new Set(paradas.map((p) => p.id));

  paradas.forEach((parada) => {
    if (parada.vinculo_parada_id) {
      if (!idsExistentes.has(parada.vinculo_parada_id)) {
        erros.push(
          `Parada "${parada.endereco}" esta vinculada a uma parada inexistente`,
        );
      }

      if (parada.tipo !== 'entrega') {
        erros.push(
          `Apenas entregas podem ter vinculos. "${parada.endereco}" e ${parada.tipo}`,
        );
      }

      const vinculada = paradas.find((p) => p.id === parada.vinculo_parada_id);
      if (vinculada && vinculada.tipo !== 'retirada') {
        erros.push(
          `"${parada.endereco}" deve estar vinculada a uma retirada, nao a ${vinculada.tipo}`,
        );
      }
    }
  });

  const ciclos = detectarCiclos(paradas);
  if (ciclos.length > 0) {
    ciclos.forEach((ciclo) => {
      const nomesCiclo = ciclo.map((id) => {
        const p = paradas.find((par) => par.id === id);
        return p?.destinatario || p?.endereco || id;
      });
      erros.push(`Dependencia circular detectada: ${nomesCiclo.join(' → ')}`);
    });
  }

  return erros;
}

/**
 * Valida a rota completa antes da otimizacao.
 */
export function validarRotaParaOtimizacao(
  paradas: ParadaParaOtimizar[],
): ValidacaoRotaResult {
  const erros: string[] = [];
  const avisos: string[] = [];

  if (paradas.length > MAX_WAYPOINTS) {
    erros.push(
      `Limite de ${MAX_WAYPOINTS} paradas excedido (atual: ${paradas.length}). ` +
        `O limite operacional configurado para uma rota e ${MAX_WAYPOINTS} paradas.`,
    );
  } else if (paradas.length > WAYPOINTS_RECOMENDADO) {
    avisos.push(
      `Rota com ${paradas.length} paradas esta proxima do limite de ${MAX_WAYPOINTS}. ` +
        `Considere dividir em rotas menores para melhor performance.`,
    );
  }

  const errosVinculos = validarVinculos(paradas);
  erros.push(...errosVinculos);

  paradas.forEach((p) => {
    if (!p.latitude || !p.longitude) {
      erros.push(`Parada "${p.endereco}" nao tem coordenadas validas`);
    }
  });

  return {
    valido: erros.length === 0,
    erros,
    avisos,
  };
}
