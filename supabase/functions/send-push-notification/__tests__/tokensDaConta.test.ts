// Leitura dos tokens da conta e limpeza do token morto, só em push_tokens.
// R-DB-1: a reserva para a coluna antiga (usuarios.push_token, enquanto a
// Migration 45 não estivesse aplicada) saiu — a migration está aplicada, o
// banco é único e a CHECK usuarios_push_token_vazio mantém a coluna NULL.
//
// O cliente é um dublê mínimo da cadeia do supabase-js (from/select/eq/
// delete/update), que só grava o que foi pedido e devolve a resposta
// programada para a tabela — o que se testa é a decisão do módulo.
import {
  apagarTokenMorto,
  lerTokensDaConta,
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

  it.each(['PGRST205', '42P01'])(
    'tabela ausente (%s) é erro: não cai na coluna antiga',
    async (code) => {
      const { cliente, chamadas } = clienteFalso({
        push_tokens: { error: { code, message: 'tabela ausente' } },
        usuarios: { data: [{ push_token: T1 }], error: null },
      });

      const r = await lerTokensDaConta(cliente, 'u1');

      expect(r).toEqual({
        tokens: [],
        origem: 'push_tokens',
        erro: 'tabela ausente',
      });
      expect(chamadas).toHaveLength(1);
    },
  );

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

  it('devolve a mensagem de erro, sem lançar', async () => {
    const { cliente } = clienteFalso({
      push_tokens: { error: { message: 'offline' } },
    });

    await expect(
      apagarTokenMorto(cliente, 'u1', T1, 'push_tokens'),
    ).resolves.toBe('offline');
  });
});
