// Leitura dos tokens da conta e limpeza do token morto, com o fallback para a
// coluna antiga enquanto a Migration 45 não estiver aplicada: a função pode
// ser publicada ANTES da migration sem janela de push calado.
//
// O cliente é um dublê mínimo da cadeia do supabase-js (from/select/eq/
// delete/update), que só grava o que foi pedido e devolve a resposta
// programada para a tabela — o que se testa é a decisão do módulo.
import {
  apagarTokenMorto,
  lerTokensDaConta,
  tabelaInexistente,
  tokenNoFormatoExpo,
} from '../tokensDaConta';

type Resposta = {
  data?: unknown;
  error: { code?: string; message: string } | null;
};

function clienteFalso(respostas: Record<string, Resposta>) {
  const chamadas: Array<{
    tabela: string;
    op: string;
    payload?: unknown;
    eq: Array<[string, unknown]>;
  }> = [];
  const cliente = {
    from(tabela: string) {
      const montar = (op: string, payload?: unknown) => {
        const registro = {
          tabela,
          op,
          payload,
          eq: [] as Array<[string, unknown]>,
        };
        chamadas.push(registro);
        const builder = {
          eq(col: string, val: unknown) {
            registro.eq.push([col, val]);
            return builder;
          },
          then(resolve: (v: Resposta) => unknown) {
            return resolve(respostas[tabela] ?? { data: [], error: null });
          },
        };
        return builder;
      };
      return {
        select: (colunas: string) => montar(`select:${colunas}`),
        delete: () => montar('delete'),
        update: (payload: unknown) => montar('update', payload),
      };
    },
  };
  return { cliente, chamadas };
}

const T1 = 'ExponentPushToken[aaaaaaaaaaaa]';
const T2 = 'ExpoPushToken[bbbbbbbbbbbb]';

describe('tabelaInexistente', () => {
  it('reconhece a tabela ausente no Postgres (42P01) e no PostgREST (PGRST205)', () => {
    expect(tabelaInexistente({ code: '42P01', message: 'x' })).toBe(true);
    expect(tabelaInexistente({ code: 'PGRST205', message: 'x' })).toBe(true);
  });

  it('qualquer outro erro não é tabela ausente', () => {
    expect(tabelaInexistente({ code: '42501', message: 'x' })).toBe(false);
    expect(tabelaInexistente({ message: 'offline' })).toBe(false);
    expect(tabelaInexistente(null)).toBe(false);
  });
});

describe('tokenNoFormatoExpo', () => {
  it('aceita os dois prefixos que o Expo emite', () => {
    expect(tokenNoFormatoExpo(T1)).toBe(true);
    expect(tokenNoFormatoExpo(T2)).toBe(true);
  });

  it('recusa o resto', () => {
    expect(tokenNoFormatoExpo('qualquer-coisa')).toBe(false);
    expect(tokenNoFormatoExpo('ExponentPushToken[]')).toBe(false);
    expect(tokenNoFormatoExpo('fcm:ExponentPushToken[a]')).toBe(false);
  });
});

describe('lerTokensDaConta', () => {
  it('lê todos os aparelhos de push_tokens', async () => {
    const { cliente, chamadas } = clienteFalso({
      push_tokens: { data: [{ token: T1 }, { token: T2 }], error: null },
    });

    const r = await lerTokensDaConta(cliente, 'u1');

    expect(r).toEqual({ tokens: [T1, T2], origem: 'push_tokens', erro: null });
    expect(chamadas).toEqual([
      {
        tabela: 'push_tokens',
        op: 'select:token',
        payload: undefined,
        eq: [['usuario_id', 'u1']],
      },
    ]);
  });

  it('migration ainda não aplicada (PGRST205): cai na coluna antiga, um envio', async () => {
    const { cliente, chamadas } = clienteFalso({
      push_tokens: {
        error: {
          code: 'PGRST205',
          message:
            "Could not find the table 'public.push_tokens' in the schema cache",
        },
      },
      usuarios: { data: [{ push_token: T1 }], error: null },
    });

    const r = await lerTokensDaConta(cliente, 'u1');

    expect(r).toEqual({ tokens: [T1], origem: 'coluna', erro: null });
    expect(chamadas[1]).toEqual({
      tabela: 'usuarios',
      op: 'select:push_token',
      payload: undefined,
      eq: [['id', 'u1']],
    });
  });

  it('fallback com a coluna vazia: nenhum token', async () => {
    const { cliente } = clienteFalso({
      push_tokens: {
        error: { code: '42P01', message: 'relation does not exist' },
      },
      usuarios: { data: [{ push_token: null }], error: null },
    });

    await expect(lerTokensDaConta(cliente, 'u1')).resolves.toEqual({
      tokens: [],
      origem: 'coluna',
      erro: null,
    });
  });

  it('outro erro de push_tokens NÃO cai na coluna', async () => {
    const { cliente, chamadas } = clienteFalso({
      push_tokens: { error: { code: '57014', message: 'timeout' } },
    });

    const r = await lerTokensDaConta(cliente, 'u1');

    expect(r.tokens).toEqual([]);
    expect(r.erro).toBe('timeout');
    expect(chamadas).toHaveLength(1);
  });
});

describe('apagarTokenMorto', () => {
  it('de push_tokens: apaga a linha só se ainda for da mesma conta', async () => {
    const { cliente, chamadas } = clienteFalso({});

    await apagarTokenMorto(cliente, 'u1', T1, 'push_tokens');

    expect(chamadas).toEqual([
      {
        tabela: 'push_tokens',
        op: 'delete',
        payload: undefined,
        eq: [
          ['token', T1],
          ['usuario_id', 'u1'],
        ],
      },
    ]);
  });

  it('da coluna (fallback): zera só se ainda for o mesmo token', async () => {
    const { cliente, chamadas } = clienteFalso({});

    await apagarTokenMorto(cliente, 'u1', T1, 'coluna');

    expect(chamadas).toEqual([
      {
        tabela: 'usuarios',
        op: 'update',
        payload: { push_token: null },
        eq: [
          ['id', 'u1'],
          ['push_token', T1],
        ],
      },
    ]);
  });

  it('devolve a mensagem de erro, sem lançar', async () => {
    const { cliente } = clienteFalso({
      push_tokens: { error: { message: 'offline' } },
    });

    await expect(
      apagarTokenMorto(cliente, 'u1', T1, 'push_tokens'),
    ).resolves.toBe('offline');
  });
});
