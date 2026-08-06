import { renderHook, act } from '@testing-library/react-native';

import { supabase } from '@/lib/supabase';

import { useCriarUnidade } from '../useCriarUnidade';

jest.mock('@/lib/supabase');

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

const input = {
  gestorNome: 'Maria Souza',
  unidadeNome: 'Transportes Souza',
  cidade: 'João Pessoa',
  uf: 'PB',
  endereco: 'Av. Epitácio Pessoa, 100',
  latitude: -7.1195,
  longitude: -34.845,
  telefone: '',
};

describe('useCriarUnidade', () => {
  beforeEach(() => jest.clearAllMocks());

  it('envia os parâmetros da RPC sem papel e sem email', async () => {
    mockSupabase.rpc = jest
      .fn()
      .mockResolvedValue({ data: 'unidade-1', error: null });

    const { result } = renderHook(() => useCriarUnidade());
    await act(async () => {
      await result.current.criarUnidade(input);
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'criar_unidade_para_novo_gestor',
      expect.objectContaining({
        p_gestor_nome: 'Maria Souza',
        p_unidade_nome: 'Transportes Souza',
        p_cidade: 'João Pessoa',
        p_sede_latitude: -7.1195,
        p_sede_longitude: -34.845,
      }),
    );

    // Regressão: papel e email vêm da sessão no servidor. Se alguém adicionar
    // ao payload, o client volta a poder escolher o próprio papel.
    const payload = (mockSupabase.rpc as jest.Mock).mock.calls[0][1];
    expect(payload).not.toHaveProperty('p_papel');
    expect(payload).not.toHaveProperty('p_email');
  });

  it('trata PERFIL_JA_EXISTE como sucesso (duplo submit é idempotente)', async () => {
    mockSupabase.rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'PERFIL_JA_EXISTE', code: 'P0001' },
    });

    const { result } = renderHook(() => useCriarUnidade());

    let retorno: { ok: boolean } | undefined;
    await act(async () => {
      retorno = await result.current.criarUnidade(input);
    });

    expect(retorno).toEqual({ ok: true });
  });

  it('propaga erro real da RPC', async () => {
    mockSupabase.rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'COORDENADAS_OBRIGATORIAS', code: '22023' },
    });

    const { result } = renderHook(() => useCriarUnidade());

    await expect(
      act(async () => {
        await result.current.criarUnidade(input);
      }),
    ).rejects.toBeTruthy();
  });
});
