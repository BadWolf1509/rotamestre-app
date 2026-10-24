/**
 * Último retrato bem-sucedido da rota do motorista (rota + paradas, como o
 * banco devolveu), guardado no aparelho.
 *
 * POR QUE EXISTE. Com o app vivo, uma recarga que falha mantém a rota em
 * memória e a Início mostra "Sem conexão — dados de HH:MM". Mas o Android mata
 * o processo (câmera, memória, `force-stop`) e o app reabre do zero, sem nada
 * em memória: offline, a busca falhava e a Início dizia "Não foi possível
 * carregar a sua rota" no meio da entrega. Este é o "stale-if-error": vale SÓ
 * quando a busca falha. Busca que responde sempre vence e regrava — inclusive
 * "sem rota" (finalizada, expirada ou trocada no servidor).
 *
 * POR QUE FORA DO `cache.ts`: lá a entrada vence por TTL e é apagada na
 * leitura; aqui o uso é justamente horas depois. Uma vaga só, com o dono
 * gravado: a rota da conta A nunca responde pela B. Apagado no logout
 * (`CHAVES_DA_CONTA` em `src/lib/auth/limparEstadoLocal.ts`).
 *
 * As paradas são as do BANCO, sem a fila offline: quem lê aplica
 * `sobreporAcoesPendentes` por cima, como faz com a busca fresca.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ParadaData, RouteData } from '@/context/route-status/types';

import { logger } from '../logger';

export const CHAVE_ROTA_GUARDADA = '@rotamestre:rota_guardada';

export interface RotaGuardada {
  route: RouteData | null;
  paradas: ParadaData[];
  pendingRoutesCount: number;
  /** Epoch (ms) da busca que produziu o retrato. */
  guardadoEm: number;
}

interface Registro {
  userId: string;
  retrato: RotaGuardada;
}

export async function gravarRotaGuardada(
  userId: string,
  retrato: RotaGuardada,
): Promise<void> {
  try {
    const registro: Registro = { userId, retrato };
    await AsyncStorage.setItem(CHAVE_ROTA_GUARDADA, JSON.stringify(registro));
  } catch (error) {
    logger.warn('[RouteStatus] Falha ao guardar a rota no aparelho', error);
  }
}

/** Retrato guardado de `userId`; null se não há ou se é de outra conta. */
export async function lerRotaGuardada(
  userId: string,
): Promise<RotaGuardada | null> {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE_ROTA_GUARDADA);
    if (!bruto) return null;
    const registro = JSON.parse(bruto) as Registro;
    return registro?.userId === userId ? registro.retrato : null;
  } catch (error) {
    logger.warn('[RouteStatus] Falha ao ler a rota guardada', error);
    return null;
  }
}
