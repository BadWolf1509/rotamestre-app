/**
 * "Sem rede" confirmado pelo aparelho, para não esperar prazo de rede à toa.
 *
 * POR QUE EXISTE. Reaberto do zero em modo avião (1.14.4, moto g15), o app
 * passava 15–30 s em "Verificando autenticação" e a rota só aparecia uns 45 s
 * depois do "Running main". Com o token vencido, o auth-js tenta renovar com
 * recuo exponencial por até ~25 s (`_refreshAccessToken`, janela de 30 s) e
 * toda leitura de sessão espera por isso — inclusive a que o supabase-js faz
 * antes de cada consulta. Esperar prazo de rede sabendo que NÃO há rede é só
 * espera.
 *
 * DUAS FONTES, nesta ordem:
 *
 * 1. **Queda observada** (`redeObservada.ts`): o `fetch` do Supabase falhou
 *    por falta de rede há menos de `JANELA_REDE_CAIDA_MS` e nenhuma resposta
 *    veio depois. Cobre o Wi-Fi sem internet (pendência 27, 25/10), em que o
 *    NetInfo diz "conectado" e nenhum atalho disparava. É síncrona: nem
 *    pergunta ao NetInfo. Timeout e cancelamento NÃO contam como queda — uma
 *    consulta lenta não prova rede caída.
 * 2. **NetInfo**: SÓ `isConnected === false` conta. No modo avião ele é
 *    confiável; "conectado" não prova rede (sinal de uma barra, portal
 *    cativo) e aí os prazos de sempre continuam valendo. `null`, falha ou
 *    silêncio do NetInfo também não provam nada: respondem `false` e quem
 *    chama segue o caminho normal.
 *
 * Não reaproveita `isOnline()` de `offline.ts`: lá a regra é "conectado E
 * alcançável", e `isInternetReachable` vem `null` logo na abertura — leria
 * "sem rede" quem tem rede. E importar `offline.ts` daqui traria a fila, o
 * storage e as notificações para dentro da leitura da sessão.
 */
import NetInfo from '@react-native-community/netinfo';

import { logger } from './logger';
import { redeCaidaObservada } from './redeObservada';

/** Guarda contra um NetInfo que não responde; não é prazo de rede. */
export const PRAZO_NETINFO_MS = 2_000;

export interface OpcoesSemRede {
  /**
   * Pula só a fonte 1 (queda observada); o NetInfo segue valendo, e o modo
   * avião continua atalho. Para quem precisa ir à rede para que uma resposta
   * limpe o sinal — a recarga com dado em memória (`useLoadActiveRoute`).
   */
  ignorarQuedaObservada?: boolean;
}

export async function semRedeConfirmada(
  opcoes?: OpcoesSemRede,
): Promise<boolean> {
  // Wi-Fi sem internet: o fetch já falhou, e o NetInfo diria "conectado".
  if (!opcoes?.ignorarQuedaObservada && redeCaidaObservada()) return true;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const guarda = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), PRAZO_NETINFO_MS);
  });

  try {
    const estado = await Promise.race([NetInfo.fetch(), guarda]);
    return estado?.isConnected === false;
  } catch (error) {
    // Sem resposta do NetInfo não dá para afirmar "sem rede": segue o normal.
    logger.warn('[Rede] NetInfo falhou; seguindo como se houvesse rede', error);
    return false;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
