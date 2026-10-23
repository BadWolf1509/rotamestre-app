/**
 * Limpa do aparelho o estado que pertence à conta que está saindo.
 *
 * POR QUE UMA LISTA DO QUE APAGAR (e não "apaga tudo menos X"): o AsyncStorage
 * também guarda o que NÃO pode sumir num logout — a fila de fotos offline
 * (comprovante de entrega que ainda não subiu), limites anti-abuso do login,
 * preferências do aparelho (tema, "Navegar com", onboarding visto) e o
 * contexto do rastreamento. Uma chave nova esquecida aqui só sobrevive ao
 * logout; uma chave nova esquecida numa allowlist seria apagada sem aviso.
 *
 * Os nomes são conferidos contra o código por
 * `__tests__/limparEstadoLocal.chaves.test.ts`: renomear uma chave na origem
 * sem atualizar aqui quebra o teste.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearAllCache } from '../cache';
import { logger } from '../logger';
import { limparCacheOtimizacao } from '../route-optimization/cache';

/** Chaves exatas com dado da conta. */
export const CHAVES_DA_CONTA = [
  '@rotamestre:unidade_ativa', // src/hooks/useUnidadeAtiva.ts
  '@rotamestre:conclusao_em_voo', // src/lib/motorista/conclusaoEmVoo.ts
  '@rotamestre:rascunho_incidente', // src/lib/motorista/rascunhoIncidente.ts
  '@rotamestre:offline_data', // src/lib/offline.ts (rota/paradas em cache, não a fila)
] as const;

/** Prefixos de chaves com dado da conta. */
export const PREFIXOS_DA_CONTA = [
  'gestao_rotas_cache_', // src/hooks/gestao-rotas/useRotasCache.ts
  'route_cache_', // src/hooks/useRouteDirections.ts
  '@timeline_last_seen_', // src/hooks/useTimelineLastSeen.ts
] as const;

export async function limparEstadoLocalDoUsuario(): Promise<void> {
  // Caches com camada em memória: só as funções do próprio módulo zeram o Map.
  // `clearAllCache` cobre as chaves `@cache_*` e já engole a própria falha.
  await clearAllCache();
  try {
    await limparCacheOtimizacao();
  } catch (error) {
    logger.warn('[Logout] Falha ao limpar cache de otimização', error);
  }

  try {
    const chaves = await AsyncStorage.getAllKeys();
    const apagar = chaves.filter(
      (k) =>
        (CHAVES_DA_CONTA as readonly string[]).includes(k) ||
        PREFIXOS_DA_CONTA.some((p) => k.startsWith(p)),
    );
    if (apagar.length > 0) await AsyncStorage.multiRemove(apagar);
  } catch (error) {
    // Não crítico para o logout em si: a sessão já saiu. Fica registrado.
    logger.warn('[Logout] Falha ao limpar estado local da conta', error);
  }
}
