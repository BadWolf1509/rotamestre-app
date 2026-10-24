/**
 * Chave do contexto de rastreamento (rota e motorista que a task de segundo
 * plano está rastreando). Quem grava e apaga é `unifiedLocationTracking`; a
 * fila de posições só lê, para saber se ainda há rastreamento daquele
 * motorista.
 *
 * POR QUE MORA AQUI. A fila importar o serviço criaria um ciclo de import e
 * levaria o `TaskManager.defineTask` (efeito colateral no import) para todo
 * quem usa a fila.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/lib/logger';

export const CHAVE_CONTEXTO_RASTREAMENTO = '@rotamestre:tracking_context';

/** Motorista do contexto gravado, ou null sem contexto (ou ilegível). */
export async function motoristaDoContexto(): Promise<string | null> {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE_CONTEXTO_RASTREAMENTO);
    if (!bruto) return null;
    const contexto = JSON.parse(bruto) as { motoristaId?: unknown };
    return typeof contexto.motoristaId === 'string'
      ? contexto.motoristaId
      : null;
  } catch (error) {
    logger.warn('[ContextoRastreamento] Falha ao ler o contexto', error);
    return null;
  }
}
