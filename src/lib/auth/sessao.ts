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
import { obterSessaoComTimeout } from './sessaoComTimeout';
import { logger } from '../logger';
import { semRedeConfirmada } from '../semRede';
import { supabase } from '../supabase';

import type { Session } from '@supabase/supabase-js';

/**
 * Prazo para ler a sessão (index e useAuth). Sem ele o app trava quando o
 * Supabase não responde (github.com/supabase/supabase/issues/35754); estourar
 * o prazo é tratado como offline, nunca como logout.
 */
export const PRAZO_LEITURA_SESSAO_MS = 10_000;

export interface EstadoSessao {
  session: Session | null;
  /** Sem sessão por falta de rede (a sessão segue guardada), não por logout. */
  offline: boolean;
}

const OFFLINE: EstadoSessao = { session: null, offline: true };

/**
 * Leitura em curso, compartilhada. O prazo é DELA, não de quem chama.
 *
 * POR QUE. Reaberto sem rede com o token vencido, o getSession fica preso no
 * refresh do auth-js (~25 s de recuo exponencial). Cada um esperava o seu
 * prazo pelo MESMO getSession: o index 10 s, depois o useAuth do layout mais
 * 10 s, e o `exigirSessaoDe` do useUser sem prazo nenhum — 20–30 s em
 * "Verificando autenticação". Agora quem chega no meio divide o prazo que já
 * corre, e quem chega depois de ele estourar, com o getSession ainda preso,
 * recebe offline na hora (perguntar de novo só entraria na mesma fila do
 * auth-js). Quando o getSession enfim responde, a vaga fica livre e a próxima
 * leitura pergunta de novo.
 */
let leituraEmCurso: Promise<EstadoSessao> | null = null;

async function consultarSessao(): Promise<EstadoSessao> {
  // Sem rede confirmada (modo avião): não há o que esperar. O auth-js nem é
  // consultado — ele só responderia depois de desistir do refresh.
  if (await semRedeConfirmada()) return OFFLINE;
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
    return OFFLINE;
  }
}

/**
 * Sessão, ou offline. Nunca demora mais que `PRAZO_LEITURA_SESSAO_MS`; prazo
 * esgotado é offline, nunca logout.
 */
export function lerSessao(): Promise<EstadoSessao> {
  if (leituraEmCurso) return leituraEmCurso;

  const consulta = consultarSessao();
  const leitura = obterSessaoComTimeout(
    () => consulta,
    PRAZO_LEITURA_SESSAO_MS,
    () =>
      logger.warn(
        '[Auth] Sessão não respondeu no prazo — modo offline',
        PRAZO_LEITURA_SESSAO_MS,
      ),
  ).then((estado) => estado ?? OFFLINE);

  leituraEmCurso = leitura;
  // A vaga só se libera quando a CONSULTA termina (não o prazo).
  void consulta.finally(() => {
    if (leituraEmCurso === leitura) leituraEmCurso = null;
  });
  return leitura;
}

/**
 * Um evento do auth (login, TOKEN_REFRESHED, logout) é mais novo que qualquer
 * leitura em curso: a próxima pergunta de novo, em vez de herdar o "offline"
 * de uma leitura que estourou o prazo com o getSession velho ainda preso.
 */
export function descartarLeituraEmCurso(): void {
  leituraEmCurso = null;
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
