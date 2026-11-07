/**
 * Testes de useAddStopForm: recálculo da rota depois de inserir parada.
 *
 * Usa o routeUtils REAL (só supabase e o serviço de rotas são simulados) para
 * provar o que chega ao banco: a polyline e a distância saem da ordem NOVA.
 */

import { act, renderHook } from '@testing-library/react-native';

import { useAddStopForm } from '../useAddStopForm';

const mockRpc = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const mockMarcarOtimizacao = jest.fn();
jest.mock('@/lib/gestor/otimizacaoRota', () => ({
  marcarOtimizacaoAlterada: (...args: unknown[]) =>
    mockMarcarOtimizacao(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/lib/photon', () => ({
  photonService: { geocodeAddress: jest.fn() },
}));

const mockGetDirectionsSequential = jest.fn();
jest.mock('@/lib/google', () => ({
  googleMapsService: {
    getDirectionsSequential: (...args: unknown[]) =>
      mockGetDirectionsSequential(...args),
  },
}));

const UNIDADE = { latitude: -23.5, longitude: -46.6 };

// Quatro paradas reais como a tela as conhece ANTES da inserção.
function parada(id: string, ordem: number) {
  return {
    id,
    ordem,
    latitude: -23 - ordem / 100,
    longitude: -46 - ordem / 100,
    is_checkpoint: true,
    status: 'pendente',
  };
}
const ANTES = [
  parada('p1', 1),
  parada('p2', 2),
  parada('p3', 3),
  parada('p4', 4),
];

// Como o banco fica depois do inserir_parada na posição 2: a nova é a 2 e as
// que estavam em >= 2 foram empurradas uma casa.
const NOVA = {
  id: 'nova',
  ordem: 2,
  latitude: -10,
  longitude: -20,
  is_checkpoint: true,
};
const DEPOIS = [
  { ...ANTES[0] },
  NOVA,
  { ...ANTES[1], ordem: 3 },
  { ...ANTES[2], ordem: 4 },
  { ...ANTES[3], ordem: 5 },
  // partida e chegada: não entram nos waypoints
  { id: 'ini', ordem: 0, latitude: -1, longitude: -1, is_checkpoint: false },
  { id: 'fim', ordem: 6, latitude: -1, longitude: -1, is_checkpoint: false },
];

let rotasUpdates: Record<string, unknown>[];

function prepararBanco(opts: { releituraFalha?: boolean } = {}) {
  rotasUpdates = [];
  mockFrom.mockImplementation((tabela: string) => {
    if (tabela === 'rotas') {
      return {
        update: (valores: Record<string, unknown>) => {
          rotasUpdates.push(valores);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
    }
    if (tabela === 'paradas') {
      return {
        select: () => ({
          eq: () => ({
            returns: () =>
              Promise.resolve(
                opts.releituraFalha
                  ? { data: null, error: { message: 'falhou' } }
                  : { data: DEPOIS, error: null },
              ),
          }),
        }),
      };
    }
    return { insert: jest.fn().mockResolvedValue({ error: null }) };
  });
  mockRpc.mockResolvedValue({
    data: { success: true, parada_id: 'nova', ordem: 2 },
    error: null,
  });
  mockGetDirectionsSequential.mockResolvedValue({
    distancia_total_metros: 12000,
    duracao_total_segundos: 1800,
    polyline: 'polyline-ordem-nova',
  });
}

async function inserirNaPosicao2() {
  return (await inserirNaPosicao2ComResultado()).onSave;
}

async function inserirNaPosicao2ComResultado() {
  const onSave = jest.fn();
  const { result } = renderHook(() =>
    useAddStopForm({
      visible: true,
      rotaId: 'rota-1',
      enderecoUnidade: UNIDADE,
      currentParadasCount: 4,
      allParadas: ANTES as never,
      onSave,
    }),
  );
  act(() => {
    result.current.handleAddressSelect('Rua Nova, 1', 'x', {
      latitude: NOVA.latitude,
      longitude: NOVA.longitude,
    });
    result.current.setPosicaoInsercao(2);
  });
  await act(async () => {
    await result.current.handleSave();
  });
  return { onSave, result };
}

const ordemEsperada = [
  { latitude: ANTES[0].latitude, longitude: ANTES[0].longitude },
  { latitude: NOVA.latitude, longitude: NOVA.longitude },
  { latitude: ANTES[1].latitude, longitude: ANTES[1].longitude },
  { latitude: ANTES[2].latitude, longitude: ANTES[2].longitude },
  { latitude: ANTES[3].latitude, longitude: ANTES[3].longitude },
];

describe('useAddStopForm: recálculo depois de inserir no meio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('inserir na posição 2 de 4 grava polyline e distância na ordem nova', async () => {
    prepararBanco();

    const onSave = await inserirNaPosicao2();

    expect(mockGetDirectionsSequential).toHaveBeenCalledTimes(1);
    expect(mockGetDirectionsSequential).toHaveBeenCalledWith(
      UNIDADE,
      UNIDADE,
      ordemEsperada,
    );
    expect(rotasUpdates[rotasUpdates.length - 1]).toEqual({
      distancia_total: 12,
      tempo_total: 30,
      polyline: 'polyline-ordem-nova',
    });
    expect(onSave).toHaveBeenCalledWith({ routeRecalculationFailed: false });
  });

  it('se a releitura das paradas falhar, projeta a ordem nova localmente', async () => {
    prepararBanco({ releituraFalha: true });

    await inserirNaPosicao2();

    expect(mockGetDirectionsSequential).toHaveBeenCalledWith(
      UNIDADE,
      UNIDADE,
      ordemEsperada,
    );
  });
});

describe('useAddStopForm: rota otimizada vira otimizada_alterada (G12)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockMarcarOtimizacao.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('marca a rota depois de inserir a parada', async () => {
    prepararBanco();

    await inserirNaPosicao2();

    expect(mockMarcarOtimizacao).toHaveBeenCalledTimes(1);
    expect(mockMarcarOtimizacao).toHaveBeenCalledWith('rota-1');
  });

  it('marca mesmo se o recálculo do trajeto falhar: a ordem já mudou', async () => {
    prepararBanco();
    mockGetDirectionsSequential.mockResolvedValue(null);

    await inserirNaPosicao2();

    expect(mockMarcarOtimizacao).toHaveBeenCalledWith('rota-1');
  });

  it('não marca se a RPC recusou a inserção', async () => {
    prepararBanco();
    mockRpc.mockResolvedValue({
      data: { success: false, error: 'rota fechada' },
      error: null,
    });

    await inserirNaPosicao2();

    expect(mockMarcarOtimizacao).not.toHaveBeenCalled();
  });

  it('recusa com code ROTA_ENCERRADA mostra o motivo, não o texto genérico (Migration 81)', async () => {
    prepararBanco();
    mockRpc.mockResolvedValue({
      data: {
        success: false,
        code: 'ROTA_ENCERRADA',
        error: 'qualquer texto do servidor',
      },
      error: null,
    });

    const { onSave, result } = await inserirNaPosicao2ComResultado();

    expect(result.current.error).toBe(
      'Esta rota já foi encerrada e não aceita mudanças. Recarregue a rota.',
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it('recusa sem code (servidor antigo) segue no genérico e nunca mostra o error cru', async () => {
    prepararBanco();
    mockRpc.mockResolvedValue({
      data: { success: false, error: 'rota fechada' },
      error: null,
    });

    const { result } = await inserirNaPosicao2ComResultado();

    expect(result.current.error).toBe(
      'Erro ao adicionar parada. Tente novamente.',
    );
  });
});

describe('useAddStopForm: validação Zod e erro cruzado (G14)', () => {
  const geocode = jest.requireMock('@/lib/photon').photonService
    .geocodeAddress as jest.Mock;

  function montar(count = 4) {
    const onSave = jest.fn();
    const hook = renderHook(() =>
      useAddStopForm({
        visible: true,
        rotaId: 'rota-1',
        enderecoUnidade: UNIDADE,
        currentParadasCount: count,
        allParadas: ANTES as never,
        onSave,
      }),
    );
    return { ...hook, onSave };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockMarcarOtimizacao.mockResolvedValue(true);
    prepararBanco();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('endereço vazio: erro no campo, sem RPC', async () => {
    const { result, onSave } = montar();

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.errors.endereco?.message).toBe(
      'Informe um endereço válido.',
    );
    expect(mockRpc).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('telefone incompleto: erro no campo, sem RPC', async () => {
    const { result } = montar();

    act(() => {
      result.current.handleAddressSelect('Rua Nova, 1', 'x', {
        latitude: -7,
        longitude: -34,
      });
      result.current.handlePhoneChange('1199');
    });
    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.errors.telefone?.message).toBe(
      'Telefone deve ter DDD e 10 ou 11 dígitos.',
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('digitado sem sugestão e sem achar no geocoder: erro em endereco; escolher sugestão limpa (clearErrors)', async () => {
    geocode.mockResolvedValue(null);
    const { result } = montar();

    act(() => result.current.handleAddressChange('Rua Fantasma, 123'));
    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.errors.endereco?.message).toMatch(
      /Não foi possível encontrar as coordenadas/,
    );
    expect(mockRpc).not.toHaveBeenCalled();

    act(() => {
      result.current.handleAddressSelect('Rua Real, 10', 'x', {
        latitude: -7.3,
        longitude: -34.7,
      });
    });
    expect(result.current.errors.endereco).toBeUndefined();
    expect(result.current.hasValidCoordinates).toBe(true);
  });

  it('digitar depois de escolher sugestão invalida o selo Validado', () => {
    const { result } = montar();

    act(() => {
      result.current.handleAddressSelect('Rua Real, 10', 'x', {
        latitude: -7.3,
        longitude: -34.7,
      });
    });
    expect(result.current.hasValidCoordinates).toBe(true);

    act(() => result.current.handleAddressChange('Rua Real, 10 A'));
    expect(result.current.hasValidCoordinates).toBe(false);
  });

  it('com 50 paradas o salvar recusa pelo limite único, sem RPC', async () => {
    const { result } = montar(50);
    act(() => {
      result.current.handleAddressSelect('Rua Nova, 1', 'x', {
        latitude: -7,
        longitude: -34,
      });
    });

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.error).toBe('Limite de 50 paradas atingido');
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('useAddStopForm: auditoria da parada adicionada (B7)', () => {
  const { logger } = jest.requireMock('@/lib/logger') as {
    logger: { warn: jest.Mock };
  };

  async function inserirComUsuario() {
    const onSave = jest.fn();
    const { result } = renderHook(() =>
      useAddStopForm({
        visible: true,
        rotaId: 'rota-1',
        enderecoUnidade: UNIDADE,
        currentParadasCount: 4,
        allParadas: ANTES as never,
        onSave,
        usuarioId: 'u-1',
      }),
    );
    act(() => {
      result.current.handleAddressSelect('Rua Nova, 1', 'x', {
        latitude: NOVA.latitude,
        longitude: NOVA.longitude,
      });
      result.current.setPosicaoInsercao(2);
    });
    await act(async () => {
      await result.current.handleSave();
    });
    return onSave;
  }

  function bancoComLogs(insertLogs: jest.Mock) {
    prepararBanco();
    const base = mockFrom.getMockImplementation() as (t: string) => unknown;
    mockFrom.mockImplementation((tabela: string) =>
      tabela === 'logs' ? { insert: insertLogs } : base(tabela),
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('log recusado pelo banco vira logger.warn e a parada continua adicionada', async () => {
    const insertLogs = jest.fn().mockResolvedValue({
      error: { message: 'new row violates row-level security policy' },
    });
    bancoComLogs(insertLogs);

    const onSave = await inserirComUsuario();

    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to log action:',
      expect.objectContaining({ evento: 'parada_adicionada' }),
    );
    expect(onSave).toHaveBeenCalledWith({ routeRecalculationFailed: false });
  });

  it('o insert de logs não tem coluna parada_id: ela vai em detalhes', async () => {
    const insertLogs = jest.fn().mockResolvedValue({ error: null });
    bancoComLogs(insertLogs);

    await inserirComUsuario();

    expect(insertLogs).toHaveBeenCalledTimes(1);
    const linha = insertLogs.mock.calls[0][0];
    expect(linha).not.toHaveProperty('parada_id');
    expect(linha).toMatchObject({
      usuario_id: 'u-1',
      rota_id: 'rota-1',
      evento: 'parada_adicionada',
    });
    expect(linha.detalhes.parada_id).toBe('nova');
  });
});
