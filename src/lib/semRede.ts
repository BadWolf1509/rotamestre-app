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
 * SÓ `isConnected === false` conta. No modo avião o NetInfo é confiável;
 * "conectado" não prova rede (sinal de uma barra, portal cativo) e aí os
 * prazos de sempre continuam valendo. `null`, falha ou silêncio do NetInfo
 * também não provam nada: respondem `false` e quem chama segue o caminho
 * normal.
 *
 * Não reaproveita `isOnline()` de `offline.ts`: lá a regra é "conectado E
 * alcançável", e `isInternetReachable` vem `null` logo na abertura — leria
 * "sem rede" quem tem rede. E importar `offline.ts` daqui traria a fila, o
 * storage e as notificações para dentro da leitura da sessão.
 */
import NetInfo from '@react-native-community/netinfo';

import { logger } from './logger';

/** Guarda contra um NetInfo que não responde; não é prazo de rede. */
export const PRAZO_NETINFO_MS = 2_000;

export async function semRedeConfirmada(): Promise<boolean> {
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
