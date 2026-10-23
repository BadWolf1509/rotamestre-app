/**
 * Equipe de uma loja: mesma fonte para a tela Equipe e para o número de
 * "Membros da Equipe" da Minha Unidade, e "gestor principal" medido NA loja.
 */
import {
  carregarEquipeDaLoja,
  ehGestorPrincipalDaLoja,
  resumoDaEquipe,
} from '../equipeDaLoja';

const mockRpc = jest.fn();
const mockEq = jest.fn();
let mockGestores: unknown[] = [];

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => {
      const consulta = {
        select: () => consulta,
        eq: (col: string, val: unknown) => {
          mockEq(col, val);
          return consulta;
        },
        then: (resolve: (v: unknown) => void) =>
          resolve({ data: mockGestores, error: null }),
      };
      return consulta;
    },
  },
}));

const gestor = (id: string, extra: Record<string, unknown> = {}) => ({
  usuarios: {
    id,
    nome: id,
    email: `${id}@x.com`,
    papel: 'gestor',
    is_gestor_principal: false,
    unidade_id: 'loja-a',
    ativo: true,
    created_at: '2026-07-01T00:00:00Z',
    foto_url: null,
    ...extra,
  },
});
const motorista = (id: string, ativo: boolean) => ({
  id,
  nome: id,
  email: `${id}@x.com`,
  ativo,
  vinculo_ativo: ativo,
  created_at: '2026-08-01T00:00:00Z',
  foto_url: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGestores = [];
});

describe('ehGestorPrincipalDaLoja', () => {
  it('é principal só na loja do flag (o flag vive no slot de usuarios.unidade_id)', () => {
    const u = { is_gestor_principal: true, unidade_id: 'loja-a' };
    expect(ehGestorPrincipalDaLoja(u, 'loja-a')).toBe(true);
    expect(ehGestorPrincipalDaLoja(u, 'loja-b')).toBe(false);
  });

  it('sem flag, ou sem loja aberta, não é principal', () => {
    expect(
      ehGestorPrincipalDaLoja(
        { is_gestor_principal: false, unidade_id: 'loja-a' },
        'loja-a',
      ),
    ).toBe(false);
    expect(
      ehGestorPrincipalDaLoja(
        { is_gestor_principal: true, unidade_id: 'loja-a' },
        null,
      ),
    ).toBe(false);
    expect(ehGestorPrincipalDaLoja(null, 'loja-a')).toBe(false);
  });
});

describe('carregarEquipeDaLoja', () => {
  it('junta gestores do vínculo ativo e motoristas da RPC (inclusive inativos nesta loja)', async () => {
    mockGestores = [gestor('g1')];
    mockRpc.mockResolvedValue({
      data: [motorista('m1', true), motorista('m2', false)],
      error: null,
    });

    const membros = await carregarEquipeDaLoja('loja-a');

    expect(mockRpc).toHaveBeenCalledWith('listar_motoristas_unidade', {
      p_unidade_id: 'loja-a',
    });
    expect(mockEq).toHaveBeenCalledWith('unidade_id', 'loja-a');
    expect(membros.map((m) => m.id).sort()).toEqual(['g1', 'm1', 'm2']);
    expect(resumoDaEquipe(membros)).toEqual({
      total: 3,
      ativos: 2,
      inativos: 1,
    });
  });

  it('marca como principal só quem é principal DESTA loja', async () => {
    mockGestores = [
      gestor('g-daqui', { is_gestor_principal: true, unidade_id: 'loja-a' }),
      gestor('g-de-outra', {
        is_gestor_principal: true,
        unidade_id: 'loja-b',
      }),
    ];
    mockRpc.mockResolvedValue({ data: [], error: null });

    const membros = await carregarEquipeDaLoja('loja-a');
    const principal = Object.fromEntries(
      membros.map((m) => [m.id, m.is_gestor_principal]),
    );

    expect(principal).toEqual({ 'g-daqui': true, 'g-de-outra': false });
  });

  it('erro de qualquer das duas consultas sobe (a tela mostra o toast)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('rpc') });
    await expect(carregarEquipeDaLoja('loja-a')).rejects.toThrow('rpc');
  });
});
