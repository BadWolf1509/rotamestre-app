/**
 * Utilitário para otimização de rotas respeitando dependências entre paradas.
 *
 * Quando uma entrega está vinculada a uma retirada (mesmo equipamento),
 * a retirada DEVE ser executada antes da entrega.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { Coordenadas } from '@/types/endereco';

import { googleMapsService } from './google';

// ============================================================================
// CONSTANTES
// ============================================================================

/** Limite máximo de waypoints da Google Directions API (25 total - origem - destino) */
export const MAX_WAYPOINTS = 23;

/** Limite recomendado para melhor otimização (deixa margem para API) */
export const WAYPOINTS_RECOMENDADO = 20;

/** Chave para persistência no AsyncStorage */
const CACHE_STORAGE_KEY = '@rotamestre/route-optimization-cache';

// ============================================================================
// INTERFACES
// ============================================================================

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

export interface ValidacaoRotaResult {
  valido: boolean;
  erros: string[];
  avisos: string[];
}

// ============================================================================
// CACHE DE OTIMIZAÇÃO (com persistência em AsyncStorage)
// ============================================================================

interface CacheEntry {
  resultado: ResultadoOtimizacao;
  timestamp: number;
}

interface PersistedCache {
  entries: Record<string, CacheEntry>;
  version: number;
}

/** Versão do cache (incrementar se estrutura mudar) */
const CACHE_VERSION = 1;

/** Cache em memória para resultados de otimização */
let optimizationCache = new Map<string, CacheEntry>();

/** Flag para indicar se cache foi carregado do storage */
let cacheLoaded = false;

/** Promise para aguardar carregamento inicial */
let loadingPromise: Promise<void> | null = null;

/** Tempo de vida do cache em ms (24 horas)
 * Aumentado de 5 min para 24h para reduzir chamadas duplicadas à API
 * Rotas não mudam frequentemente, cache longo é seguro
 */
const CACHE_TTL = 24 * 60 * 60 * 1000;

/** Limite máximo de entradas no cache */
const MAX_CACHE_ENTRIES = 50;

/**
 * Carrega cache do AsyncStorage (executado uma vez na inicialização).
 */
async function carregarCacheDoStorage(): Promise<void> {
  if (cacheLoaded) return;

  if (loadingPromise) {
    await loadingPromise;
    return;
  }

  loadingPromise = (async () => {
    try {
      const stored = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
      if (stored) {
        const parsed: PersistedCache = JSON.parse(stored);

        // Verificar versão
        if (parsed.version !== CACHE_VERSION) {
          console.log('[RouteCache] Versão diferente, limpando cache antigo');
          await AsyncStorage.removeItem(CACHE_STORAGE_KEY);
          cacheLoaded = true;
          return;
        }

        // Restaurar apenas entradas válidas (não expiradas)
        const agora = Date.now();
        const entries = parsed.entries || {};

        for (const [key, entry] of Object.entries(entries)) {
          if (agora - entry.timestamp <= CACHE_TTL) {
            optimizationCache.set(key, entry);
          }
        }

        console.log(`[RouteCache] 📦 Carregado do storage: ${optimizationCache.size} entradas válidas`);
      }
    } catch (error) {
      console.warn('[RouteCache] Erro ao carregar cache:', error);
    } finally {
      cacheLoaded = true;
    }
  })();

  await loadingPromise;
}

/**
 * Persiste cache no AsyncStorage.
 */
async function persistirCacheNoStorage(): Promise<void> {
  try {
    const entries: Record<string, CacheEntry> = {};
    for (const [key, value] of optimizationCache) {
      entries[key] = value;
    }

    const data: PersistedCache = {
      entries,
      version: CACHE_VERSION,
    };

    await AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('[RouteCache] Erro ao persistir cache:', error);
  }
}

/**
 * Gera hash único para uma configuração de rota.
 * Usado como chave do cache.
 */
function gerarHashRota(
  origem: Coordenadas,
  paradas: ParadaParaOtimizar[],
  destino?: Coordenadas
): string {
  const origemStr = `${origem.latitude.toFixed(6)},${origem.longitude.toFixed(6)}`;
  const destinoStr = destino
    ? `${destino.latitude.toFixed(6)},${destino.longitude.toFixed(6)}`
    : origemStr;

  // Ordenar paradas por ID para garantir consistência
  const paradasStr = paradas
    .map(p => `${p.id}:${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}:${p.vinculo_parada_id || ''}`)
    .sort()
    .join('|');

  return `${origemStr}>${paradasStr}>${destinoStr}`;
}

/**
 * Obtém resultado do cache se ainda válido.
 */
async function obterDoCache(hash: string): Promise<ResultadoOtimizacao | null> {
  // Garantir que cache foi carregado
  await carregarCacheDoStorage();

  const entry = optimizationCache.get(hash);
  if (!entry) return null;

  const agora = Date.now();
  if (agora - entry.timestamp > CACHE_TTL) {
    optimizationCache.delete(hash);
    // Persistir remoção
    persistirCacheNoStorage();
    return null;
  }

  return entry.resultado;
}

/**
 * Salva resultado no cache.
 */
async function salvarNoCache(hash: string, resultado: ResultadoOtimizacao): Promise<void> {
  // Garantir que cache foi carregado
  await carregarCacheDoStorage();

  // Limpar entradas expiradas
  const agora = Date.now();
  for (const [key, entry] of optimizationCache) {
    if (agora - entry.timestamp > CACHE_TTL) {
      optimizationCache.delete(key);
    }
  }

  // Se ainda cheio, remover mais antigas
  while (optimizationCache.size >= MAX_CACHE_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of optimizationCache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) optimizationCache.delete(oldestKey);
    else break;
  }

  optimizationCache.set(hash, {
    resultado,
    timestamp: Date.now(),
  });

  // Persistir de forma assíncrona (não bloqueia)
  persistirCacheNoStorage();
}

/**
 * Limpa todo o cache de otimização.
 */
export async function limparCacheOtimizacao(): Promise<void> {
  optimizationCache.clear();
  await AsyncStorage.removeItem(CACHE_STORAGE_KEY);
  console.log('[RouteCache] 🗑️ Cache limpo');
}

/**
 * Retorna estatísticas do cache.
 */
export async function estatisticasCache(): Promise<{ tamanho: number; entradas: string[] }> {
  await carregarCacheDoStorage();
  return {
    tamanho: optimizationCache.size,
    entradas: Array.from(optimizationCache.keys()),
  };
}

/**
 * Força carregamento do cache (útil para pré-aquecer).
 */
export async function precarregarCache(): Promise<void> {
  await carregarCacheDoStorage();
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
 * 1. Verifica cache para evitar chamadas duplicadas
 * 2. Valida limite de waypoints e dependências
 * 3. Agrupa paradas por dependência (retirada + entregas vinculadas)
 * 4. Trata cada grupo como um "super-waypoint"
 * 5. Otimiza a ordem dos grupos/independentes via Google Directions API
 * 6. Expande os grupos mantendo a ordem interna (retirada sempre antes das entregas)
 * 7. Salva resultado no cache
 *
 * @param origem Coordenadas do ponto de partida
 * @param paradas Lista de paradas para otimizar
 * @param destino Coordenadas do destino (opcional, padrão = origem para rota circular)
 * @param ignorarCache Se true, força nova chamada à API ignorando cache
 */
export async function otimizarRotaComDependencias(
  origem: Coordenadas,
  paradas: ParadaParaOtimizar[],
  destino?: Coordenadas,
  ignorarCache?: boolean
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

  // Gerar hash para cache
  const hashRota = gerarHashRota(origem, paradas, destino);

  // Verificar cache (se não ignorar)
  if (!ignorarCache) {
    const resultadoCache = await obterDoCache(hashRota);
    if (resultadoCache) {
      console.log('[RouteOptimization] ✅ Resultado obtido do cache');
      return resultadoCache;
    }
  }

  // Validar antes de chamar API
  const validacao = validarRotaParaOtimizacao(paradas);
  if (!validacao.valido) {
    console.error('[RouteOptimization] ❌ Validação falhou:', validacao.erros);
    return null;
  }

  if (validacao.avisos.length > 0) {
    console.warn('[RouteOptimization] ⚠️ Avisos:', validacao.avisos);
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

  const resultadoFinal: ResultadoOtimizacao = {
    paradasOrdenadas,
    distanciaTotalMetros: resultado.distancia_total_metros,
    duracaoTotalSegundos: resultado.duracao_total_segundos,
    polyline: resultado.polyline,
    ordemIndices,
  };

  // Salvar no cache para futuras chamadas (fire-and-forget para não bloquear)
  salvarNoCache(hashRota, resultadoFinal).then(() => {
    console.log('[RouteOptimization] 💾 Resultado salvo no cache');
  });

  return resultadoFinal;
}

// ============================================================================
// DETECÇÃO DE CICLOS
// ============================================================================

/**
 * Detecta ciclos nas dependências usando DFS (Depth-First Search).
 * Retorna lista de ciclos encontrados (cada ciclo é um array de IDs).
 */
function detectarCiclos(paradas: ParadaParaOtimizar[]): string[][] {
  const ciclosEncontrados: string[][] = [];
  const visitados = new Set<string>();
  const emProcessamento = new Set<string>();
  const caminhoAtual: string[] = [];

  // Criar mapa de dependências (quem depende de quem)
  const dependencias = new Map<string, string>();
  paradas.forEach(p => {
    if (p.vinculo_parada_id) {
      dependencias.set(p.id, p.vinculo_parada_id);
    }
  });

  function dfs(paradaId: string): boolean {
    if (emProcessamento.has(paradaId)) {
      // Encontrou ciclo! Extrair o ciclo do caminho atual
      const indiceCiclo = caminhoAtual.indexOf(paradaId);
      if (indiceCiclo !== -1) {
        const ciclo = caminhoAtual.slice(indiceCiclo);
        ciclo.push(paradaId); // Fechar o ciclo
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

    // Seguir dependência se existir
    const dependeDe = dependencias.get(paradaId);
    if (dependeDe) {
      dfs(dependeDe);
    }

    caminhoAtual.pop();
    emProcessamento.delete(paradaId);
    return false;
  }

  // Verificar cada parada
  paradas.forEach(p => {
    if (!visitados.has(p.id)) {
      dfs(p.id);
    }
  });

  return ciclosEncontrados;
}

// ============================================================================
// VALIDAÇÃO
// ============================================================================

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

  // Detectar ciclos nas dependências
  const ciclos = detectarCiclos(paradas);
  if (ciclos.length > 0) {
    ciclos.forEach(ciclo => {
      const nomesCiclo = ciclo.map(id => {
        const p = paradas.find(par => par.id === id);
        return p?.destinatario || p?.endereco || id;
      });
      erros.push(
        `Dependência circular detectada: ${nomesCiclo.join(' → ')}`
      );
    });
  }

  return erros;
}

/**
 * Valida a rota completa antes da otimização.
 * Verifica limite de waypoints, vínculos e retorna erros/avisos.
 */
export function validarRotaParaOtimizacao(
  paradas: ParadaParaOtimizar[]
): ValidacaoRotaResult {
  const erros: string[] = [];
  const avisos: string[] = [];

  // Verificar limite de waypoints
  if (paradas.length > MAX_WAYPOINTS) {
    erros.push(
      `Limite de ${MAX_WAYPOINTS} paradas excedido (atual: ${paradas.length}). ` +
      `A API do Google não suporta mais que ${MAX_WAYPOINTS} waypoints por rota.`
    );
  } else if (paradas.length > WAYPOINTS_RECOMENDADO) {
    avisos.push(
      `Rota com ${paradas.length} paradas está próxima do limite de ${MAX_WAYPOINTS}. ` +
      `Considere dividir em rotas menores para melhor performance.`
    );
  }

  // Validar vínculos
  const errosVinculos = validarVinculos(paradas);
  erros.push(...errosVinculos);

  // Verificar se todas as paradas têm coordenadas
  paradas.forEach(p => {
    if (!p.latitude || !p.longitude) {
      erros.push(`Parada "${p.endereco}" não tem coordenadas válidas`);
    }
  });

  return {
    valido: erros.length === 0,
    erros,
    avisos,
  };
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
