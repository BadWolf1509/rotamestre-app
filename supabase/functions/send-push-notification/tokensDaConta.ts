// Onde estão os tokens de push de uma conta (sem Deno/fetch), testável no Jest.
//
// Desde a Migration 45 (`20261024020000`) o token mora em `push_tokens`, um
// por aparelho, e a coluna `usuarios.push_token` fica sempre vazia (CHECK
// `usuarios_push_token_vazio`). A reserva que lia a coluna enquanto a tabela
// não existisse saiu (R-DB-1): a migration está aplicada e o banco é único.
// Tabela ausente agora é erro como qualquer outro.

// Um só valor desde que a reserva da coluna saiu; o tipo continua porque o
// index.ts devolve a origem ao `apagarTokenMorto`.
export type OrigemDoToken = 'push_tokens';

interface ErroSupabase {
  code?: string;
  message: string;
}

interface Resposta {
  data?: unknown;
  error: ErroSupabase | null;
}

// Só a parte da cadeia do supabase-js que este módulo usa.
interface Filtro extends PromiseLike<Resposta> {
  eq(coluna: string, valor: unknown): Filtro;
}

export interface ClienteTokens {
  from(tabela: string): {
    select(colunas: string): Filtro;
    delete(): Filtro;
  };
}

// O Expo emite os dois prefixos; o banco (gravar_push_token) aceita os dois.
const FORMATO_EXPO = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export function tokenNoFormatoExpo(token: string): boolean {
  return FORMATO_EXPO.test(token);
}

export async function lerTokensDaConta(
  cliente: ClienteTokens,
  usuarioId: string,
): Promise<{ tokens: string[]; origem: OrigemDoToken; erro: string | null }> {
  const { data, error } = await cliente
    .from('push_tokens')
    .select('token')
    .eq('usuario_id', usuarioId);

  if (error) return { tokens: [], origem: 'push_tokens', erro: error.message };

  const linhas = (data ?? []) as Array<{ token: string }>;
  return {
    tokens: linhas.map((l) => l.token),
    origem: 'push_tokens',
    erro: null,
  };
}

// Token morto sai, e só se ainda for desta conta: o aparelho pode ter passado
// a outra conta enquanto o envio estava no ar. Devolve a mensagem de erro (ou
// null), sem lançar.
export async function apagarTokenMorto(
  cliente: ClienteTokens,
  usuarioId: string,
  token: string,
  _origem: OrigemDoToken,
): Promise<string | null> {
  const { error } = await cliente
    .from('push_tokens')
    .delete()
    .eq('token', token)
    .eq('usuario_id', usuarioId);
  return error ? error.message : null;
}
