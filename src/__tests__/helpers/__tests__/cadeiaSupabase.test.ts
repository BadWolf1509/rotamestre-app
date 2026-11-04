import { criarCadeia } from '../cadeiaSupabase';

describe('criarCadeia', () => {
  const resultado = { data: [{ id: 1 }], error: null };

  it('resolve o resultado quando a cadeia é aguardada sem terminal', async () => {
    await expect(criarCadeia(resultado).select('*').eq('a', 1)).resolves.toBe(
      resultado,
    );
  });

  it('resolve o resultado nos terminais single e maybeSingle', async () => {
    await expect(criarCadeia(resultado).maybeSingle()).resolves.toBe(resultado);
    await expect(criarCadeia(resultado).select('*').single()).resolves.toBe(
      resultado,
    );
  });

  it('registra as chamadas de cada método', () => {
    const cadeia = criarCadeia(resultado);
    cadeia.eq('a', 1);
    expect(cadeia.eq).toHaveBeenCalledWith('a', 1);
  });

  it('todo método encadeável devolve a própria cadeia', () => {
    const cadeia = criarCadeia(resultado);
    const encadeaveis = [
      'select',
      'insert',
      'update',
      'delete',
      'upsert',
      'eq',
      'neq',
      'gt',
      'gte',
      'lt',
      'lte',
      'in',
      'is',
      'not',
      'or',
      'order',
      'limit',
      'range',
      'returns',
    ] as const;
    for (const metodo of encadeaveis) {
      expect((cadeia[metodo] as jest.Mock)()).toBe(cadeia);
    }
  });

  it('repassa count quando informado', async () => {
    const comContagem = { data: null, error: null, count: 7 };
    await expect(
      criarCadeia(comContagem).select('*', { count: 'exact', head: true }),
    ).resolves.toEqual(comContagem);
  });

  it('then devolve o que o callback devolver', async () => {
    const valor = await criarCadeia(resultado).then((r) => r.data);
    expect(valor).toEqual([{ id: 1 }]);
  });
});
