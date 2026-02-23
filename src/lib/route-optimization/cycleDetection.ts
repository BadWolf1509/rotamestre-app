/**
 * Cycle detection in stop dependencies using DFS (Depth-First Search).
 */

import type { ParadaParaOtimizar } from './types';

/**
 * Detecta ciclos nas dependencias usando DFS.
 * Retorna lista de ciclos encontrados (cada ciclo e um array de IDs).
 */
export function detectarCiclos(paradas: ParadaParaOtimizar[]): string[][] {
  const ciclosEncontrados: string[][] = [];
  const visitados = new Set<string>();
  const emProcessamento = new Set<string>();
  const caminhoAtual: string[] = [];

  // Criar mapa de dependencias (quem depende de quem)
  const dependencias = new Map<string, string>();
  paradas.forEach(p => {
    if (p.vinculo_parada_id) {
      dependencias.set(p.id, p.vinculo_parada_id);
    }
  });

  function dfs(paradaId: string): boolean {
    if (emProcessamento.has(paradaId)) {
      const indiceCiclo = caminhoAtual.indexOf(paradaId);
      if (indiceCiclo !== -1) {
        const ciclo = caminhoAtual.slice(indiceCiclo);
        ciclo.push(paradaId);
        ciclosEncontrados.push(ciclo);
      }
      return true;
    }

    if (visitados.has(paradaId)) {
      return false;
    }

    visitados.add(paradaId);
    emProcessamento.add(paradaId);
    caminhoAtual.push(paradaId);

    const dependeDe = dependencias.get(paradaId);
    if (dependeDe) {
      dfs(dependeDe);
    }

    caminhoAtual.pop();
    emProcessamento.delete(paradaId);
    return false;
  }

  paradas.forEach(p => {
    if (!visitados.has(p.id)) {
      dfs(p.id);
    }
  });

  return ciclosEncontrados;
}
