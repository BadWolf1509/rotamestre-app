// Recusa da exclusão de conta pelo servidor (`delete-account`): o último
// gestor ativo de uma loja e quem tem rota em andamento não são apagados.
//
// A função responde 409/503 com { error, code }. O supabase-js entrega isso
// como FunctionsHttpError, com a Response em `context` — e a mensagem dele é
// só "Edge Function returned a non-2xx status code". Sem ler o corpo, a tela
// mostraria o erro genérico e mandaria a pessoa escrever ao suporte, quando o
// que ela precisa é saber o que fazer (pedir ao suporte que adicione outro gestor,
// finalizar a rota).

export type CodigoExclusaoRecusada =
  | 'ULTIMO_GESTOR'
  | 'ROTA_EM_ANDAMENTO'
  | 'GUARDA_INDISPONIVEL';

const CODIGOS: readonly string[] = [
  'ULTIMO_GESTOR',
  'ROTA_EM_ANDAMENTO',
  'GUARDA_INDISPONIVEL',
];

export class ExclusaoRecusadaError extends Error {
  readonly codigo: CodigoExclusaoRecusada;

  constructor(codigo: CodigoExclusaoRecusada, mensagem: string) {
    super(mensagem);
    this.name = 'ExclusaoRecusadaError';
    this.codigo = codigo;
  }
}

/** Devolve a recusa se o erro for uma guarda da função; senão, null. */
export async function lerRecusaDaExclusao(
  erro: unknown,
): Promise<ExclusaoRecusadaError | null> {
  const resposta = (erro as { context?: unknown } | null)?.context;
  if (!(resposta instanceof Response)) return null;

  try {
    const corpo = (await resposta.json()) as {
      error?: unknown;
      code?: unknown;
    };
    if (typeof corpo.code !== 'string' || !CODIGOS.includes(corpo.code)) {
      return null;
    }
    if (typeof corpo.error !== 'string' || corpo.error.length === 0) {
      return null;
    }
    return new ExclusaoRecusadaError(
      corpo.code as CodigoExclusaoRecusada,
      corpo.error,
    );
  } catch {
    // Corpo que não é JSON (proxy, 502): não é uma guarda, segue o erro genérico.
    return null;
  }
}
