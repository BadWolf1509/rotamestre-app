/**
 * Último usuário que teve sessão neste aparelho.
 *
 * POR QUE EXISTE. Offline com o access token vencido, `getSession()` não
 * consegue renovar e devolve `session: null` — mas a pessoa continua com o
 * app aberto, tirando foto de entrega. A fila de fotos offline precisa saber
 * de quem é a foto sem depender de renovar a sessão; senão ela ficaria sem
 * dono e subiria com a sessão de quem entrasse depois.
 *
 * Gravado a cada evento de auth com sessão (`setupOfflineSync`, em
 * `src/lib/offline.ts`) e apagado no logout (`limparEstadoLocalDoUsuario`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '../logger';

export const CHAVE_ULTIMO_USUARIO = '@rotamestre:ultimo_usuario';

export async function gravarUltimoUsuario(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CHAVE_ULTIMO_USUARIO, userId);
  } catch (error) {
    logger.warn('[Auth] Falha ao gravar o último usuário', error);
  }
}

export async function lerUltimoUsuario(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CHAVE_ULTIMO_USUARIO);
  } catch (error) {
    logger.warn('[Auth] Falha ao ler o último usuário', error);
    return null;
  }
}
