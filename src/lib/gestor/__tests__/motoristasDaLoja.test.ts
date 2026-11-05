import { criarCadeia } from '@/__tests__/helpers/cadeiaSupabase';

import { buscarMotoristasAtivosDaLoja } from '../motoristasDaLoja';

const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));

const u = (id: string, nome: string, ativo = true) => ({
  id,
  nome,
  email: `${id}@x.com`,
  telefone: null,
  ativo,
  ultimo_login: null,
});

beforeEach(() => jest.clearAllMocks());

describe('buscarMotoristasAtivosDaLoja', () => {
  it('consulta o vínculo ativo de motorista da loja pedida', async () => {
    const cadeia = criarCadeia({ data: [], error: null });
    mockFrom.mockReturnValue(cadeia);

    await buscarMotoristasAtivosDaLoja('loja-1');

    expect(mockFrom).toHaveBeenCalledWith('usuario_unidades');
    expect(cadeia.eq).toHaveBeenCalledWith('unidade_id', 'loja-1');
    expect(cadeia.eq).toHaveBeenCalledWith('papel', 'motorista');
    expect(cadeia.eq).toHaveBeenCalledWith('ativo', true);
  });

  it('devolve ativos em ordem alfabética e descarta embed nulo e inativo', async () => {
    mockFrom.mockReturnValue(
      criarCadeia({
        data: [
          { usuario_id: 'b', usuarios: u('b', 'Bruno') },
          { usuario_id: 'x', usuarios: null },
          { usuario_id: 'i', usuarios: u('i', 'Inativo', false) },
          { usuario_id: 'a', usuarios: u('a', 'Ana') },
        ],
        error: null,
      }),
    );

    const lista = await buscarMotoristasAtivosDaLoja('loja-1');

    expect(lista.map((m) => m.nome)).toEqual(['Ana', 'Bruno']);
  });

  it('lança o erro do Supabase', async () => {
    mockFrom.mockReturnValue(
      criarCadeia({ data: null, error: new Error('rede') }),
    );

    await expect(buscarMotoristasAtivosDaLoja('loja-1')).rejects.toThrow(
      'rede',
    );
  });
});
