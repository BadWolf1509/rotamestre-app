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
  '@rotamestre:ultimo_usuario', // src/lib/auth/ultimoUsuario.ts
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

// ---------------------------------------------------------------------------
// Exclusão de conta
// ---------------------------------------------------------------------------

const CHAVE_FILA_ACOES = '@rotamestre:fila_acoes_parada'; // src/lib/motorista/filaAcoesParada.ts
const CHAVE_DESCARTES_ACOES = '@rotamestre:fila_acoes_parada_descartes'; // idem
const CHAVE_INDICE_FOTOS = '@rotamestre:offline_photos_index'; // src/lib/offline.ts

type ComDono = { motoristaId?: string };
type FotoComDono = { userId?: string; semDono?: boolean };

/**
 * Excluir a conta apaga tudo do aparelho, MENOS as pendências de OUTRAS
 * contas: concluir/pular feitos sem rede (e seus avisos) e as fotos de
 * comprovante que ainda não subiram. Elas sobem quando a dona entrar; um
 * `AsyncStorage.clear()` cru as perderia sem aviso. Foto sem dono conhecido
 * (`semDono`) também fica — pode ser de qualquer um.
 *
 * POR QUE GUARDAR E REGRAVAR (e não apagar chave a chave): o resto do
 * aparelho deve mesmo sumir numa exclusão; só estas três chaves misturam
 * dados de várias contas, e é só delas que se tira o que é de quem sai.
 */
export async function limparAparelhoAoExcluirConta(
  usuarioId: string,
): Promise<void> {
  const lerLista = async <T>(chave: string): Promise<T[]> => {
    try {
      const bruto = await AsyncStorage.getItem(chave);
      return bruto ? (JSON.parse(bruto) as T[]) : [];
    } catch (error) {
      logger.warn('[ExcluirConta] Falha ao ler pendências do aparelho', error);
      return [];
    }
  };

  const acoes = (await lerLista<ComDono>(CHAVE_FILA_ACOES)).filter(
    (a) => a.motoristaId !== usuarioId,
  );
  const descartes = (
    await lerLista<{ acao?: ComDono }>(CHAVE_DESCARTES_ACOES)
  ).filter((d) => d.acao?.motoristaId !== usuarioId);
  const fotos = (await lerLista<FotoComDono>(CHAVE_INDICE_FOTOS)).filter(
    (f) => f.semDono || (f.userId !== undefined && f.userId !== usuarioId),
  );

  await AsyncStorage.clear();

  const guardar: [string, unknown[]][] = [
    [CHAVE_FILA_ACOES, acoes],
    [CHAVE_DESCARTES_ACOES, descartes],
    [CHAVE_INDICE_FOTOS, fotos],
  ];
  for (const [chave, lista] of guardar) {
    if (lista.length > 0) {
      await AsyncStorage.setItem(chave, JSON.stringify(lista));
    }
  }
}
