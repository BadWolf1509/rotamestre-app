/**
 * Visita no local: entrega e retirada (ou vários serviços) no mesmo endereço
 * contam como UMA visita para o motorista.
 *
 * Não existe campo de "visita" no banco (`paradas` é uma linha por serviço);
 * a visita é derivada das coordenadas, com o mesmo raio que o otimizador usa
 * para deixar essas paradas juntas na rota (`RAIO_MESMO_LOCAL_METROS`).
 * Módulo puro: sem React, sem I/O.
 */

import type { ParadaData } from '@/context/route-status/types';

import { calculateHaversineDistance } from '../osrm/fallback';
import { RAIO_MESMO_LOCAL_METROS } from '../route-optimization/agrupamento';

type ComCoordenada = {
  latitude?: number | null;
  longitude?: number | null;
};

/** Coordenada ausente ou 0,0 (geocoding que falhou) não localiza nada. */
function temCoordenada(p: ComCoordenada): boolean {
  const { latitude, longitude } = p;
  if (latitude == null || longitude == null) return false;
  return !(latitude === 0 && longitude === 0);
}

function noMesmoLocal(a: ComCoordenada, b: ComCoordenada): boolean {
  if (!temCoordenada(a) || !temCoordenada(b)) return false;
  return (
    calculateHaversineDistance(
      a.latitude as number,
      a.longitude as number,
      b.latitude as number,
      b.longitude as number,
    ) <= RAIO_MESMO_LOCAL_METROS
  );
}

/** Paradas reais (sem checkpoint de partida/chegada), por `ordem`. */
function paradasReaisOrdenadas(paradas: ParadaData[]): ParadaData[] {
  return paradas
    .filter((p) => p.is_checkpoint !== false)
    .sort((a, b) => a.ordem - b.ordem);
}

/**
 * `atual` mais as paradas seguintes CONSECUTIVAS na rota que ainda faltam
 * fazer e estão no mesmo local. Para na primeira que não serve: um ponto que
 * repete mais adiante, depois de outro lugar, é outra visita.
 */
export function paradasDaVisita(
  paradas: ParadaData[],
  atual: ParadaData,
): ParadaData[] {
  const visita = [atual];
  const seguintes = paradasReaisOrdenadas(paradas).filter(
    (p) => p.ordem > atual.ordem,
  );
  for (const p of seguintes) {
    const aFazer = p.status === 'pendente' || p.status === 'em_andamento';
    if (!aFazer || !noMesmoLocal(atual, p)) break;
    visita.push(p);
  }
  return visita;
}

/**
 * O motorista já está no local porque acabou de CONCLUIR a parada real
 * imediatamente anterior, que fica no mesmo ponto de `atual`. Só a conclusão
 * prova presença: o pulo pode ser feito à distância (gestor por telefone,
 * "Pular também" desligado), e aí o atalho dos 0 m abriria a conclusão em vez
 * de navegar até o local.
 */
export function chegouPelaParadaAnterior(
  paradas: ParadaData[],
  atual: ParadaData,
): boolean {
  const anterior = paradasReaisOrdenadas(paradas)
    .filter((p) => p.ordem < atual.ordem)
    .pop();
  if (!anterior) return false;
  return anterior.status === 'concluida' && noMesmoLocal(anterior, atual);
}

/**
 * Agrupa por local usando ponto-âncora: a parada entra no primeiro grupo cuja
 * PRIMEIRA parada está no raio (mesma regra do otimizador, para uma fileira de
 * casas a 25 m uma da outra não virar um local só). Sem coordenada válida, a
 * parada fica sozinha. Grupos e membros saem por `ordem`.
 */
export function agruparPorLocal<
  T extends {
    id: string;
    ordem: number;
    latitude?: number | null;
    longitude?: number | null;
  },
>(paradas: T[]): T[][] {
  const grupos: T[][] = [];
  [...paradas]
    .sort((a, b) => a.ordem - b.ordem)
    .forEach((p) => {
      const grupo = grupos.find((g) => noMesmoLocal(g[0], p));
      if (grupo) grupo.push(p);
      else grupos.push([p]);
    });
  return grupos;
}
