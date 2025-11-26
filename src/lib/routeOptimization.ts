/**
 * Utilitário para otimização de rotas respeitando dependências entre paradas.
 *
 * Quando uma entrega está vinculada a uma retirada (mesmo equipamento),
 * a retirada DEVE ser executada antes da entrega.
 */

import { Coordenadas } from '@/types/endereco';

import { googleMapsService } from './google';

export interface ParadaParaOtimizar {
  id: string;
  tipo: 'entrega' | 'retirada';
  endereco: string;
  latitude: number;
  longitude: number;
  ordem: number;
  destinatario?: string;
  telefone?: string;
  observacoes?: string;
  /** ID da retirada que deve ser feita antes (apenas para entregas) */
  vinculo_parada_id?: string;
}

export interface ResultadoOtimizacao {
  /** Paradas na ordem otimizada respeitando dependências */
  paradasOrdenadas: ParadaParaOtimizar[];
  /** Distância total em metros */
  distanciaTotalMetros: number;
  /** Duração total em segundos */
  duracaoTotalSegundos: number;
  /** Polyline codificada para desenhar no mapa */
  polyline: string;
  /** Ordem original dos índices após otimização */
  ordemIndices: number[];
}

/**
 * Agrupa paradas por dependência.
 * Retorna grupos onde cada grupo é [retirada, ...entregas_vinculadas]
 */
function agruparPorDependencia(paradas: ParadaParaOtimizar[]): {
  grupos: ParadaParaOtimizar[][];
  independentes: ParadaParaOtimizar[];
} {
  const grupos: ParadaParaOtimizar[][] = [];
  const independentes: ParadaParaOtimizar[] = [];
  const processados = new Set<string>();

  // Primeiro, encontrar todas as retiradas que têm entregas vinculadas
  const retiradasComVinculos = new Map<string, ParadaParaOtimizar[]>();

  paradas.forEach(parada => {
    if (parada.vinculo_parada_id) {
      const vinculadas = retiradasComVinculos.get(parada.vinculo_parada_id) || [];
      vinculadas.push(parada);
      retiradasComVinculos.set(parada.vinculo_parada_id, vinculadas);
    }
  });

  // Criar grupos: [retirada, entregas_vinculadas...]
  paradas.forEach(parada => {
    if (processados.has(parada.id)) return;

    // Se é uma retirada com entregas vinculadas
    if (parada.tipo === 'retirada' && retiradasComVinculos.has(parada.id)) {
      const grupo = [parada, ...retiradasComVinculos.get(parada.id)!];
      grupos.push(grupo);
      grupo.forEach(p => processados.add(p.id));
    }
    // Se não tem vínculo e não foi processada
    else if (!parada.vinculo_parada_id && !processados.has(parada.id)) {
      independentes.push(parada);
      processados.add(parada.id);
    }
  });

  return { grupos, independentes };
}

/**
 * Otimiza a rota respeitando dependências entre paradas.
 *
 * Algoritmo:
 * 1. Agrupa paradas por dependência (retirada + entregas vinculadas)
 * 2. Trata cada grupo como um "super-waypoint"
 * 3. Otimiza a ordem dos grupos/independentes via Google Directions API
 * 4. Expande os grupos mantendo a ordem interna (retirada sempre antes das entregas)
 */
export async function otimizarRotaComDependencias(
  origem: Coordenadas,
  paradas: ParadaParaOtimizar[],
  destino?: Coordenadas
): Promise<ResultadoOtimizacao | null> {
  if (paradas.length === 0) {
    return {
      paradasOrdenadas: [],
      distanciaTotalMetros: 0,
      duracaoTotalSegundos: 0,
      polyline: '',
      ordemIndices: [],
    };
  }

  // Agrupar paradas por dependência
  const { grupos, independentes } = agruparPorDependencia(paradas);

  // Criar lista de "representantes" para otimização
  // Cada grupo é representado pela sua retirada (primeiro elemento)
  // Paradas independentes são representadas por si mesmas
  const representantes: ParadaParaOtimizar[] = [
    ...grupos.map(grupo => grupo[0]), // Retiradas dos grupos
    ...independentes,
  ];

  // Mapear índice do representante para grupo/independente
  const mapaRepresentantes = new Map<number, ParadaParaOtimizar[]>();
  grupos.forEach((grupo, idx) => {
    mapaRepresentantes.set(idx, grupo);
  });
  independentes.forEach((parada, idx) => {
    mapaRepresentantes.set(grupos.length + idx, [parada]);
  });

  // Preparar waypoints para Google Directions API
  const waypoints: Coordenadas[] = representantes.map(p => ({
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  // Destino: último waypoint ou origem (rota circular)
  const destinoFinal = destino || origem;

  // Chamar Google Directions API com otimização
  const resultado = await googleMapsService.getDirections(
    origem,
    destinoFinal,
    waypoints
  );

  if (!resultado) {
    console.error('[RouteOptimization] Falha ao obter direções do Google');
    return null;
  }

  // Aplicar ordem otimizada aos grupos/independentes
  const ordemOtimizada = resultado.ordem_otimizada;
  const paradasOrdenadas: ParadaParaOtimizar[] = [];
  const ordemIndices: number[] = [];

  // Se Google retornou ordem otimizada, usar
  if (ordemOtimizada && ordemOtimizada.length > 0) {
    ordemOtimizada.forEach(idx => {
      const grupo = mapaRepresentantes.get(idx);
      if (grupo) {
        grupo.forEach(parada => {
          const idxOriginal = paradas.findIndex(p => p.id === parada.id);
          ordemIndices.push(idxOriginal);
          paradasOrdenadas.push(parada);
        });
      }
    });
  } else {
    // Fallback: manter ordem original mas respeitando grupos
    [...grupos, ...independentes.map(p => [p])].forEach(grupo => {
      grupo.forEach(parada => {
        const idxOriginal = paradas.findIndex(p => p.id === parada.id);
        ordemIndices.push(idxOriginal);
        paradasOrdenadas.push(parada);
      });
    });
  }

  // Atualizar ordem das paradas
  paradasOrdenadas.forEach((parada, idx) => {
    parada.ordem = idx + 1;
  });

  return {
    paradasOrdenadas,
    distanciaTotalMetros: resultado.distancia_total_metros,
    duracaoTotalSegundos: resultado.duracao_total_segundos,
    polyline: resultado.polyline,
    ordemIndices,
  };
}

/**
 * Valida se os vínculos de uma lista de paradas são consistentes.
 * Retorna lista de erros encontrados.
 */
export function validarVinculos(paradas: ParadaParaOtimizar[]): string[] {
  const erros: string[] = [];
  const idsExistentes = new Set(paradas.map(p => p.id));

  paradas.forEach(parada => {
    if (parada.vinculo_parada_id) {
      // Verificar se o vínculo existe
      if (!idsExistentes.has(parada.vinculo_parada_id)) {
        erros.push(
          `Parada "${parada.endereco}" está vinculada a uma parada inexistente`
        );
      }

      // Verificar se é entrega vinculada a retirada
      if (parada.tipo !== 'entrega') {
        erros.push(
          `Apenas entregas podem ter vínculos. "${parada.endereco}" é ${parada.tipo}`
        );
      }

      // Verificar se está vinculada a uma retirada
      const vinculada = paradas.find(p => p.id === parada.vinculo_parada_id);
      if (vinculada && vinculada.tipo !== 'retirada') {
        erros.push(
          `"${parada.endereco}" deve estar vinculada a uma retirada, não a ${vinculada.tipo}`
        );
      }
    }
  });

  return erros;
}

/**
 * Formata a descrição de um vínculo para exibição.
 */
export function formatarDescricaoVinculo(
  parada: ParadaParaOtimizar,
  todasParadas: ParadaParaOtimizar[]
): string | null {
  if (!parada.vinculo_parada_id) return null;

  const vinculada = todasParadas.find(p => p.id === parada.vinculo_parada_id);
  if (!vinculada) return null;

  return `Depende de: Retirada em ${vinculada.destinatario || vinculada.endereco}`;
}

/**
 * Encontra retiradas disponíveis para vincular a uma nova entrega.
 */
export function encontrarRetiradasDisponiveis(
  paradas: ParadaParaOtimizar[]
): ParadaParaOtimizar[] {
  return paradas.filter(p => p.tipo === 'retirada');
}
