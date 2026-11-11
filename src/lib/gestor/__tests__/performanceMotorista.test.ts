/**
 * Performance do motorista no perfil (gestor), pela RPC
 * `desempenho_motorista_na_loja` (Migration 89).
 *
 * A `vw_performance_motoristas` somava as rotas de todas as lojas que o RLS
 * deixasse ver: o motorista que atende duas lojas aparecia com as duas
 * somadas. A RPC conta só as rotas da loja aberta e recusa quem não é gestor
 * ativo dela. Recusa, erro ou loja ainda não carregada: nada de número
 * inventado — zeros e taxa nula (a tela mostra "—").
 */
import { buscarPerformanceMotorista } from '../performanceMotorista';

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
const mockWarn = jest.fn();
jest.mock('@/lib/logger', () => ({
  logger: {
    warn: (...args: unknown[]) => mockWarn(...args),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

const NOVEMBRO = { de: '2026-11-01', ate: '2026-11-10' };

const DA_LOJA = {
  success: true,
  total_rotas: 4,
  rotas_concluidas: 3,
  rotas_em_andamento: 0,
  rotas_nao_executadas: 1,
  rotas_canceladas: 0,
  taxa_execucao: 75.0,
  distancia_total_km: 10.5,
  tempo_medio_minutos: 30.25,
};

beforeEach(() => {
  mockRpc.mockReset();
  mockWarn.mockReset();
});

describe('buscarPerformanceMotorista', () => {
  it('pede à RPC os números do motorista na loja aberta', async () => {
    mockRpc.mockResolvedValue({ data: DA_LOJA, error: null });

    const perf = await buscarPerformanceMotorista(
      'm1',
      'Ana',
      'loja-a',
      NOVEMBRO,
    );

    expect(mockRpc).toHaveBeenCalledWith('desempenho_motorista_na_loja', {
      p_motorista_id: 'm1',
      p_unidade_id: 'loja-a',
      p_de: '2026-11-01',
      p_ate: '2026-11-10',
    });
    expect(perf).toEqual({
      id: 'm1',
      nome: 'Ana',
      unidade_id: 'loja-a',
      unidade_nome: '',
      total_rotas: 4,
      rotas_concluidas: 3,
      rotas_em_andamento: 0,
      rotas_nao_executadas: 1,
      rotas_canceladas: 0,
      taxa_execucao: 75,
      distancia_total_km: 10.5,
      tempo_medio_minutos: 30.25,
    });
  });

  it('Todo o período manda p_de e p_ate nulos (lados abertos)', async () => {
    mockRpc.mockResolvedValue({ data: DA_LOJA, error: null });

    await buscarPerformanceMotorista('m1', 'Ana', 'loja-a', {
      de: null,
      ate: '2026-11-10',
    });

    expect(mockRpc).toHaveBeenCalledWith('desempenho_motorista_na_loja', {
      p_motorista_id: 'm1',
      p_unidade_id: 'loja-a',
      p_de: null,
      p_ate: '2026-11-10',
    });
  });

  it('sem rota concluída: distância e tempo nulos', async () => {
    mockRpc.mockResolvedValue({
      data: {
        ...DA_LOJA,
        total_rotas: 0,
        rotas_concluidas: 0,
        rotas_nao_executadas: 0,
        taxa_execucao: 100,
        distancia_total_km: null,
        tempo_medio_minutos: null,
      },
      error: null,
    });

    const perf = await buscarPerformanceMotorista(
      'm1',
      'Ana',
      'loja-a',
      NOVEMBRO,
    );

    expect(perf.distancia_total_km).toBeNull();
    expect(perf.tempo_medio_minutos).toBeNull();
    expect(perf.total_rotas).toBe(0);
  });

  it('loja ainda não carregada: não consulta e devolve sem dados', async () => {
    const perf = await buscarPerformanceMotorista('m1', 'Ana', null, NOVEMBRO);

    expect(mockRpc).not.toHaveBeenCalled();
    expect(perf).toMatchObject({
      id: 'm1',
      total_rotas: 0,
      taxa_execucao: null,
    });
  });

  it('recusa (SEM_PERMISSAO): sem dados, com aviso no log', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, code: 'SEM_PERMISSAO', error: 'x' },
      error: null,
    });

    const perf = await buscarPerformanceMotorista(
      'm1',
      'Ana',
      'loja-b',
      NOVEMBRO,
    );

    expect(perf).toMatchObject({ total_rotas: 0, taxa_execucao: null });
    expect(mockWarn).toHaveBeenCalledWith(
      '[performanceMotorista] RPC recusou',
      'SEM_PERMISSAO',
    );
  });

  it('erro da chamada: sem dados, com aviso no log', async () => {
    const erro = { message: 'falhou' };
    mockRpc.mockResolvedValue({ data: null, error: erro });

    const perf = await buscarPerformanceMotorista(
      'm1',
      'Ana',
      'loja-a',
      NOVEMBRO,
    );

    expect(perf).toMatchObject({ total_rotas: 0, taxa_execucao: null });
    expect(mockWarn).toHaveBeenCalledWith(
      '[performanceMotorista] RPC falhou',
      erro,
    );
  });

  it('resposta fora do formato: sem dados, nunca número inventado', async () => {
    mockRpc.mockResolvedValue({ data: 'inesperado', error: null });

    const perf = await buscarPerformanceMotorista(
      'm1',
      'Ana',
      'loja-a',
      NOVEMBRO,
    );

    expect(perf).toMatchObject({ total_rotas: 0, taxa_execucao: null });
    // Registra só o tipo do que veio, nunca a resposta inteira.
    expect(mockWarn).toHaveBeenCalledWith(
      '[performanceMotorista] RPC recusou',
      'string',
    );
  });
});
