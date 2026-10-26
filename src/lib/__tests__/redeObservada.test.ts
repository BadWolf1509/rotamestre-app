import {
  _resetRedeObservada,
  aoCairRede,
  criarFetchObservandoRede,
  JANELA_REDE_CAIDA_MS,
  redeCaidaObservada,
  registrarFalhaDeRede,
} from '../redeObservada';

const URL_REST = 'https://x.supabase.co/rest/v1/rotas?select=*';

beforeEach(() => _resetRedeObservada());

/**
 * Wi-Fi sem internet: o NetInfo diz "conectado" e nenhum atalho de "sem rede"
 * disparava. O sinal passa a vir da própria falha do `fetch` do Supabase.
 */
describe('redeObservada', () => {
  it('falha de rede liga o sinal e a resposta desliga', async () => {
    const base = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(new Response('', { status: 503 }));
    const observando = criarFetchObservandoRede(
      base as unknown as typeof fetch,
    );

    await expect(observando(URL_REST)).rejects.toThrow(
      'Network request failed',
    );
    expect(redeCaidaObservada()).toBe(true);

    // Qualquer status prova que o Supabase respondeu: a rede voltou.
    const res = await observando(URL_REST);
    expect(res.status).toBe(503);
    expect(redeCaidaObservada()).toBe(false);
  });

  it('abort não conta', async () => {
    const base = jest.fn().mockRejectedValue({ name: 'AbortError' });
    const observando = criarFetchObservandoRede(
      base as unknown as typeof fetch,
    );

    await expect(observando(URL_REST)).rejects.toEqual({
      name: 'AbortError',
    });
    expect(redeCaidaObservada()).toBe(false);
  });

  it('cancelamento pelo signal do chamador não conta, qualquer que seja o erro', async () => {
    const controller = new AbortController();
    controller.abort();
    const base = jest.fn().mockRejectedValue(new TypeError('Aborted'));
    const observando = criarFetchObservandoRede(
      base as unknown as typeof fetch,
    );

    await expect(
      observando(URL_REST, { signal: controller.signal }),
    ).rejects.toThrow('Aborted');
    expect(redeCaidaObservada()).toBe(false);
  });

  it('expira na janela', () => {
    registrarFalhaDeRede(1000);
    expect(redeCaidaObservada(1000 + JANELA_REDE_CAIDA_MS - 1)).toBe(true);
    expect(redeCaidaObservada(1000 + JANELA_REDE_CAIDA_MS)).toBe(false);
  });

  it('aoCairRede avisa uma vez e cancela', () => {
    const ouvinte = jest.fn();
    const cancelar = aoCairRede(ouvinte);
    expect(ouvinte).not.toHaveBeenCalled();

    registrarFalhaDeRede();
    expect(ouvinte).toHaveBeenCalledTimes(1);

    cancelar();
    _resetRedeObservada();
    registrarFalhaDeRede();
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });

  it('cancelado antes da queda, o ouvinte nunca é chamado', () => {
    const ouvinte = jest.fn();
    aoCairRede(ouvinte)();
    registrarFalhaDeRede();
    expect(ouvinte).not.toHaveBeenCalled();
  });

  it('rede já caída: aoCairRede chama na hora', () => {
    registrarFalhaDeRede();
    const ouvinte = jest.fn();
    aoCairRede(ouvinte);
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });

  it('base lazy: usa o fetch global da hora da chamada', async () => {
    const original = global.fetch;
    const trocado = jest.fn().mockResolvedValue(new Response('{}'));
    try {
      const observando = criarFetchObservandoRede();
      global.fetch = trocado as unknown as typeof fetch;
      await observando(URL_REST);
      expect(trocado).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = original;
    }
  });
});
