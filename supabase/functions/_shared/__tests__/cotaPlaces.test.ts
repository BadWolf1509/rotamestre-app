// `consumirCotaPlaces` roda em Deno; o `.rpc` do supabase-js (esm.sh) vem
// injetado, então aqui ele é uma função simples. O que importa provar: só o
// `true` do banco libera; `false` é cota esgotada; qualquer erro (do banco, da
// rede, resposta sem boolean) é 'indisponivel' — a função segue buscando
// (fail-open) e registra o motivo no log.
import {
  consumirCotaPlaces,
  PRAZO_COTA_MS,
  respostaCotaEsgotada,
} from '../cotaPlaces';

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('consumirCotaPlaces', () => {
  it('chama a RPC com o serviço e libera quando o banco devolve true', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: true, error: null });
    await expect(consumirCotaPlaces(rpc, 'autocomplete')).resolves.toBe('ok');
    expect(rpc).toHaveBeenCalledWith('consumir_cota_places', {
      p_servico: 'autocomplete',
    });
  });

  it('false do banco é cota esgotada', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: false, error: null });
    await expect(consumirCotaPlaces(rpc, 'details')).resolves.toBe('esgotada');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('erro do banco é indisponível, com o motivo no log', async () => {
    const erro = { code: '42883', message: 'function does not exist' };
    const rpc = jest.fn().mockResolvedValue({ data: null, error: erro });
    await expect(consumirCotaPlaces(rpc, 'details')).resolves.toBe(
      'indisponivel',
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[cotaPlaces]'),
      erro,
    );
  });

  it('exceção da chamada (rede) é indisponível, sem escapar', async () => {
    const rpc = jest.fn().mockRejectedValue(new Error('fetch failed'));
    await expect(consumirCotaPlaces(rpc, 'autocomplete')).resolves.toBe(
      'indisponivel',
    );
    expect(console.error).toHaveBeenCalled();
  });

  it('null do banco (sem usuário na sessão) é indisponível, não cota esgotada', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: null });
    await expect(consumirCotaPlaces(rpc, 'details')).resolves.toBe(
      'indisponivel',
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[cotaPlaces]'),
    );
  });

  it(`banco que não responde em ${PRAZO_COTA_MS} ms é indisponível (a busca segue)`, async () => {
    jest.useFakeTimers();
    try {
      const rpc = jest.fn(() => new Promise<never>(() => {}));
      const resultado = consumirCotaPlaces(rpc, 'autocomplete');
      await jest.advanceTimersByTimeAsync(PRAZO_COTA_MS - 1);
      let resolvido = false;
      void resultado.then(() => {
        resolvido = true;
      });
      await Promise.resolve();
      expect(resolvido).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await expect(resultado).resolves.toBe('indisponivel');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[cotaPlaces]'),
        expect.anything(),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('o prazo de 2000 ms é o padrão', () => {
    expect(PRAZO_COTA_MS).toBe(2000);
  });

  it('resposta dentro do prazo não deixa timer pendurado', async () => {
    jest.useFakeTimers();
    try {
      const rpc = jest.fn().mockResolvedValue({ data: true, error: null });
      await expect(consumirCotaPlaces(rpc, 'autocomplete')).resolves.toBe('ok');
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('resposta sem boolean é indisponível, não liberação', async () => {
    for (const data of [null, 'true', 1, {}]) {
      const rpc = jest.fn().mockResolvedValue({ data, error: null });
      await expect(consumirCotaPlaces(rpc, 'autocomplete')).resolves.toBe(
        'indisponivel',
      );
    }
  });
});

describe('respostaCotaEsgotada', () => {
  it('429 com a mensagem, o status OVER_QUERY_LIMIT, os extras e o CORS', async () => {
    const cors = { 'Access-Control-Allow-Origin': '*' };
    const resp = respostaCotaEsgotada(cors, { predictions: [] });
    expect(resp.status).toBe(429);
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(resp.headers.get('Content-Type')).toBe('application/json');
    await expect(resp.json()).resolves.toEqual({
      error:
        'Limite diário de buscas de endereço atingido. Tente de novo amanhã.',
      status: 'OVER_QUERY_LIMIT',
      predictions: [],
    });
  });

  it('sem extras, só a mensagem e o status', async () => {
    const resp = respostaCotaEsgotada({});
    await expect(resp.json()).resolves.toEqual({
      error:
        'Limite diário de buscas de endereço atingido. Tente de novo amanhã.',
      status: 'OVER_QUERY_LIMIT',
    });
  });
});
