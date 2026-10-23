// Onde estão os tokens de push de uma conta (sem Deno/fetch), testável no Jest.
//
// Desde a Migration 45 (`20261024020000`) o token mora em `push_tokens`, um
// por aparelho, e a coluna `usuarios.push_token` fica sempre vazia. Enquanto a
// migration não estiver aplicada, a tabela não existe: a leitura cai na
// coluna antiga (um token só). Assim a função pode ser publicada ANTES da
// migration, sem janela em que o push deixa de chegar.

export type OrigemDoToken = 'push_tokens' | 'coluna';

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
    update(valores: Record<string, unknown>): Filtro;
  };
}

// 42P01 = relação inexistente (Postgres); PGRST205 = tabela fora do schema
// cache do PostgREST. Qualquer outro erro é falha de verdade.
export function tabelaInexistente(erro: ErroSupabase | null): boolean {
  return erro?.code === '42P01' || erro?.code === 'PGRST205';
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

  if (!error) {
    const linhas = (data ?? []) as Array<{ token: string }>;
    return {
      tokens: linhas.map((l) => l.token),
      origem: 'push_tokens',
      erro: null,
    };
  }

  if (!tabelaInexistente(error)) {
    return { tokens: [], origem: 'push_tokens', erro: error.message };
  }

  const antiga = await cliente
    .from('usuarios')
    .select('push_token')
    .eq('id', usuarioId);
  if (antiga.error) {
    return { tokens: [], origem: 'coluna', erro: antiga.error.message };
  }
  const linhas = (antiga.data ?? []) as Array<{ push_token: string | null }>;
  return {
    tokens: linhas
      .map((l) => l.push_token)
      .filter((t): t is string => typeof t === 'string' && t.length > 0),
    origem: 'coluna',
    erro: null,
  };
}

// Token morto sai de onde veio, e só se ainda for desta conta: o aparelho
// pode ter passado a outra conta enquanto o envio estava no ar. Devolve a
// mensagem de erro (ou null), sem lançar.
export async function apagarTokenMorto(
  cliente: ClienteTokens,
  usuarioId: string,
  token: string,
  origem: OrigemDoToken,
): Promise<string | null> {
  const { error } =
    origem === 'push_tokens'
      ? await cliente
          .from('push_tokens')
          .delete()
          .eq('token', token)
          .eq('usuario_id', usuarioId)
      : await cliente
          .from('usuarios')
          .update({ push_token: null })
          .eq('id', usuarioId)
          .eq('push_token', token);
  return error ? error.message : null;
}
