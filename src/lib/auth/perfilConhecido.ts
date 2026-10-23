/**
 * Último perfil (`usuarios`) que a busca devolveu neste aparelho.
 *
 * POR QUE EXISTE. Offline, o Android mata o processo na câmera e o app reabre
 * do zero: o cache de 5 min do perfil (`CACHE_KEYS.USER_DATA`) já venceu e a
 * busca falha. Sem um perfil para rotear, o portão mandava o motorista ao
 * onboarding ou ao login. Este é o "stale-if-error": vale SÓ quando a busca
 * falha — busca que responde (com perfil ou sem linha) sempre vence.
 *
 * POR QUE FORA DO `cache.ts`: lá a entrada vencida é apagada na leitura, e o
 * uso aqui é justamente depois do vencimento. Uma vaga só, com o dono gravado:
 * o perfil da conta A nunca responde pela B, e não sobra perfil de quem saiu.
 * Apagado no logout (`CHAVES_DA_CONTA` em `limparEstadoLocal.ts`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '../logger';

import type { Usuario } from '../../types/usuario';

export const CHAVE_PERFIL_CONHECIDO = '@rotamestre:perfil_conhecido';

interface Registro {
  userId: string;
  perfil: Usuario;
}

async function lerRegistro(): Promise<Registro | null> {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE_PERFIL_CONHECIDO);
    return bruto ? (JSON.parse(bruto) as Registro) : null;
  } catch (error) {
    logger.warn('[Auth] Falha ao ler o perfil conhecido', error);
    return null;
  }
}

export async function gravarPerfilConhecido(perfil: Usuario): Promise<void> {
  try {
    const registro: Registro = { userId: perfil.id, perfil };
    await AsyncStorage.setItem(
      CHAVE_PERFIL_CONHECIDO,
      JSON.stringify(registro),
    );
  } catch (error) {
    logger.warn('[Auth] Falha ao gravar o perfil conhecido', error);
  }
}

/** Perfil conhecido de `userId`; null se não há ou se é de outra conta. */
export async function lerPerfilConhecido(
  userId: string,
): Promise<Usuario | null> {
  const registro = await lerRegistro();
  return registro?.userId === userId ? registro.perfil : null;
}

/** Apaga o perfil conhecido, se for de `userId` (sem linha em `usuarios`). */
export async function apagarPerfilConhecido(userId: string): Promise<void> {
  const registro = await lerRegistro();
  if (registro?.userId !== userId) return;
  try {
    await AsyncStorage.removeItem(CHAVE_PERFIL_CONHECIDO);
  } catch (error) {
    logger.warn('[Auth] Falha ao apagar o perfil conhecido', error);
  }
}
