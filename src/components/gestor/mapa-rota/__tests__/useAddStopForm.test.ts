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
  return onSave;
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
