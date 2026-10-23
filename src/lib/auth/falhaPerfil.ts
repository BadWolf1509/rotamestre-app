/**
 * Falha ao buscar o perfil (`usuarios`), classificada.
 *
 * POR QUE CLASSIFICAR. O perfil conhecido (`perfilConhecido.ts`) não expira:
 * deixá-lo responder por QUALQUER falha esconderia para sempre um defeito de
 * verdade (coluna que sumiu, policy que passou a negar). Ele só responde pela
 * falha em que o servidor não deu resposta útil — e aí "não deu para saber" é
 * diferente de "não tem".
 *
 * Transitória: sem resposta (status 0, exceção do fetch, refresh de sessão
 * sem rede), timeout (408), token vencido (401 / PGRST301), 5xx, e busca sem
 * sessão (sairia anônima; ver `exigirSessaoDe`). O resto — 4xx de schema ou
 * permissão (400, 403/42501, 406…) e erro sem status — é defeito.
 */
import { isAuthRetryableFetchError } from '@supabase/supabase-js';

interface Detalhes {
  transitoria: boolean;
  status?: number | null;
  code?: string | null;
  causa?: unknown;
}

export class FalhaAoCarregarPerfil extends Error {
  readonly transitoria: boolean;
  readonly status: number | null;
  readonly code: string | null;
  readonly causa: unknown;

  constructor(mensagem: string, detalhes: Detalhes) {
    super(mensagem);
    this.name = 'FalhaAoCarregarPerfil';
    this.transitoria = detalhes.transitoria;
    this.status = detalhes.status ?? null;
    this.code = detalhes.code ?? null;
    this.causa = detalhes.causa;
  }
}

function statusTransitorio(status: number): boolean {
  return status === 0 || status === 408 || status === 401 || status >= 500;
}

export function classificarFalhaPerfil(
  erro: unknown,
  status?: number | null,
): FalhaAoCarregarPerfil {
  if (erro instanceof FalhaAoCarregarPerfil) return erro;

  const code =
    typeof erro === 'object' && erro !== null && 'code' in erro
      ? String((erro as { code: unknown }).code ?? '') || null
      : null;
  const mensagem =
    erro instanceof Error
      ? erro.message
      : typeof erro === 'object' && erro !== null && 'message' in erro
        ? String((erro as { message: unknown }).message)
        : String(erro);

  let transitoria: boolean;
  if (isAuthRetryableFetchError(erro)) {
    transitoria = true;
  } else if (typeof status === 'number') {
    transitoria = statusTransitorio(status) || code === 'PGRST301';
  } else {
    // Sem status = a exceção saiu antes de haver resposta. Só a do fetch
    // (TypeError "Network request failed", abort/timeout) é rede.
    const nome = erro instanceof Error ? erro.name : '';
    transitoria =
      erro instanceof TypeError ||
      nome === 'AbortError' ||
      nome === 'TimeoutError' ||
      code === 'PGRST301';
  }

  return new FalhaAoCarregarPerfil(mensagem, {
    transitoria,
    status: status ?? null,
    code,
    causa: erro,
  });
}
