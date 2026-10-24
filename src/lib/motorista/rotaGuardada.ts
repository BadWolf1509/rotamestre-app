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
 * `sobreporAcoesPendentes` por cima, como faz com a busca fresca. Exceção:
 * ação que já subiu entra no retrato (`aplicarAcoesNaRotaGuardada`), porque
 * o banco já a tem e a fila que a sobrepunha esvaziou.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ParadaData, RouteData } from '@/context/route-status/types';

import { logger } from '../logger';
import { sobreporAcoesPendentes, type AcaoParada } from './filaAcoesParada';

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

// Gravações em série, na ordem das chamadas: a correção por ação enviada
// (ler-modificar-gravar) não pode sobrescrever um retrato fresco gravado no
// meio dela.
let cadeia: Promise<unknown> = Promise.resolve();
function emSerie(fn: () => Promise<void>): Promise<void> {
  const proxima = cadeia.then(fn, fn);
  cadeia = proxima.catch(() => undefined);
  return proxima;
}

export function gravarRotaGuardada(
  userId: string,
  retrato: RotaGuardada,
): Promise<void> {
  return emSerie(async () => {
    try {
      const registro: Registro = { userId, retrato };
      await AsyncStorage.setItem(CHAVE_ROTA_GUARDADA, JSON.stringify(registro));
    } catch (error) {
      logger.warn('[RouteStatus] Falha ao guardar a rota no aparelho', error);
    }
  });
}

/**
 * Ações de parada que já SUBIRAM entram no retrato: a fila que as sobrepunha
 * esvaziou, e o retrato ainda é de antes delas. Sem isto, reabrir sem rede
 * (antes de uma carga fresca) mostrava a parada concluída como "pendente".
 * Mantém `guardadoEm`: o resto continua sendo o que o banco disse àquela hora.
 */
export function aplicarAcoesNaRotaGuardada(
  userId: string,
  acoes: AcaoParada[],
): Promise<void> {
  return emSerie(async () => {
    try {
      const bruto = await AsyncStorage.getItem(CHAVE_ROTA_GUARDADA);
      if (!bruto) return;
      const registro = JSON.parse(bruto) as Registro;
      if (registro?.userId !== userId) return;
      const { paradas } = sobreporAcoesPendentes(
        registro.retrato.paradas,
        acoes,
        registro.retrato.route?.id,
      );
      if (paradas === registro.retrato.paradas) return;
      const corrigido: Registro = {
        userId,
        retrato: { ...registro.retrato, paradas },
      };
      await AsyncStorage.setItem(
        CHAVE_ROTA_GUARDADA,
        JSON.stringify(corrigido),
      );
    } catch (error) {
      logger.warn('[RouteStatus] Falha ao corrigir a rota guardada', error);
    }
  });
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
