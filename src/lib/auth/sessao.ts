/**
 * Leitura da sessão que distingue "deslogado" de "offline".
 *
 * POR QUE EXISTE. No auth-js 2.x, access token vencido + refresh sem rede faz
 * `getSession()` devolver `{ session: null, error: AuthRetryableFetchError }`
 * — e a sessão CONTINUA no storage (só erro não retryable a remove, com
 * SIGNED_OUT). Quem descartava o `error` lia "deslogado" e mandava ao login
 * um motorista que só estava sem sinal. O token dura 1 h: é o caso comum.
 *
 * POR QUE NÃO LER O STORAGE CRU: acoplaria ao formato interno do auth-js.
 * Offline, o dono vem de `lerUltimoUsuario()` (`ultimoUsuario.ts`).
 */
import { isAuthRetryableFetchError } from '@supabase/supabase-js';

import { FalhaAoCarregarPerfil } from './falhaPerfil';
import { logger } from '../logger';
import { supabase } from '../supabase';

import type { Session } from '@supabase/supabase-js';

export interface EstadoSessao {
  session: Session | null;
  /** Sem sessão por falta de rede (a sessão segue guardada), não por logout. */
  offline: boolean;
}

export async function lerSessao(): Promise<EstadoSessao> {
  try {
    const { data, error } = await supabase.auth.getSession();
    const session = data?.session ?? null;
    return {
      session,
      offline: !session && isAuthRetryableFetchError(error),
    };
  } catch (error) {
    // `getSession` não costuma lançar; se lançar, não dá para afirmar logout.
    logger.warn('[Auth] getSession lançou; tratando como offline', error);
    return { session: null, offline: true };
  }
}

/**
 * Garante que a busca do perfil sairá AUTENTICADA como `userId`.
 *
 * Sem sessão, o supabase-js manda a query com a chave publishable (anon); a
 * RLS devolve 0 linhas e isso chega como `data: null, error: null` — idêntico
 * a "sem perfil", que apaga o perfil conhecido e manda ao onboarding. Acontece
 * no cooldown do refresh que falhou e no "Tentar novamente" logo que a rede
 * volta. Aqui isso vira falha TRANSITÓRIA.
 */
export async function exigirSessaoDe(userId: string): Promise<void> {
  const { session } = await lerSessao();
  if (session?.user?.id === userId) return;
  throw new FalhaAoCarregarPerfil(
    session ? 'Sessão de outra conta' : 'Sem sessão para buscar o perfil',
    { transitoria: true },
  );
}
