import { obterSessaoComTimeout } from '../sessaoComTimeout';

describe('obterSessaoComTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('não anuncia expiração quando a sessão chega a tempo', async () => {
    // O `Promise.race` não cancela o perdedor: o timer disparava mesmo com a
    // sessão já resolvida, e o app logava "assuming not authenticated" em TODO
    // boot autenticado. Aviso que grita em toda inicialização deixa de ser
    // aviso — e foi o que me fez suspeitar de um bug que não existia.
    const aoExpirar = jest.fn();

    const promessa = obterSessaoComTimeout(
      async () => 'sessao-valida',
      10_000,
      aoExpirar,
    );

    await expect(promessa).resolves.toBe('sessao-valida');

    jest.advanceTimersByTime(20_000);
    await Promise.resolve();

    expect(aoExpirar).not.toHaveBeenCalled();
  });

  it('devolve null e anuncia quando a sessão não chega a tempo', async () => {
    // O timeout existe de verdade: sem ele o app trava quando o Supabase não
    // responde. O que não pode é mentir quando não foi ele que decidiu.
    const aoExpirar = jest.fn();
    const nuncaResolve = () => new Promise<string>(() => {});

    const promessa = obterSessaoComTimeout(nuncaResolve, 10_000, aoExpirar);
    jest.advanceTimersByTime(10_000);

    await expect(promessa).resolves.toBeNull();
    expect(aoExpirar).toHaveBeenCalledTimes(1);
  });

  it('propaga erro da sessão em vez de mascarar como não autenticado', async () => {
    // Falha de rede e "não tem sessão" são coisas diferentes; quem chama
    // precisa poder distinguir.
    const aoExpirar = jest.fn();

    await expect(
      obterSessaoComTimeout(
        async () => {
          throw new Error('rede caiu');
        },
        10_000,
        aoExpirar,
      ),
    ).rejects.toThrow('rede caiu');

    expect(aoExpirar).not.toHaveBeenCalled();
  });
});
