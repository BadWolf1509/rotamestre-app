/**
 * Rota em andamento com a partida ainda pendente: o início foi interrompido
 * depois do passo 1 (a rede caiu) e a tela recarregou já "em andamento", sem
 * o botão Iniciar para tentar de novo. Sem este reparo a partida ficava
 * pendente para sempre aos olhos do gestor (a `finalizar_rota` só conclui a
 * chegada).
 */
import { renderHook, waitFor } from '@testing-library/react-native';

import type { ParadaData, RouteData } from '@/context/route-status/types';

import { useCompletarPartidaPendente } from '../useCompletarPartidaPendente';

const mockConcluirPartida = jest.fn();

const rota = (over: Partial<RouteData> = {}): RouteData => ({
  id: 'r1',
  unidade_id: 'u1',
  status: 'em_andamento',
  unidade_nome: 'Loja',
  iniciada_em: '2026-10-26T12:00:00.000Z',
  ...over,
});
const parada = (over: Partial<ParadaData>): ParadaData => ({
  id: 'p',
  endereco: 'Rua',
  ordem: 1,
  status: 'pendente',
  tipo: 'entrega',
  latitude: 0,
  longitude: 0,
  ...over,
});
const PARTIDA = parada({ id: 'cp', ordem: 0, is_checkpoint: false });

function montar(
  props: Partial<Parameters<typeof useCompletarPartidaPendente>[0]> = {},
) {
  const loadActiveRoute = jest.fn().mockResolvedValue(undefined);
  const r = renderHook(
    (p: Parameters<typeof useCompletarPartidaPendente>[0]) =>
      useCompletarPartidaPendente(p),
    {
      initialProps: {
        route: rota(),
        paradas: [PARTIDA, parada({ id: 'p1' })],
        cargaConfirmada: true,
        loadActiveRoute,
        concluirPartida: mockConcluirPartida,
        ...props,
      },
    },
  );
  return { ...r, loadActiveRoute };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockConcluirPartida.mockResolvedValue('gravou');
});

describe('useCompletarPartidaPendente', () => {
  it('conclui a partida pendente com a hora do início e recarrega', async () => {
    const { loadActiveRoute } = montar();
    await waitFor(() => expect(loadActiveRoute).toHaveBeenCalled());
    expect(mockConcluirPartida).toHaveBeenCalledWith(
      'cp',
      '2026-10-26T12:00:00.000Z',
    );
  });

  it('não faz nada com a partida já concluída, rota não iniciada ou carga não confirmada', () => {
    montar({
      paradas: [{ ...PARTIDA, status: 'concluida' }],
    });
    montar({ route: rota({ status: 'pendente' }) });
    montar({ cargaConfirmada: false });
    expect(mockConcluirPartida).not.toHaveBeenCalled();
  });

  /** Nova carga confirmada: passa por "carregando" e volta. */
  function recarregar(
    rerender: (p: Parameters<typeof useCompletarPartidaPendente>[0]) => void,
    loadActiveRoute: jest.Mock,
  ) {
    const props = {
      route: rota(),
      paradas: [{ ...PARTIDA }, parada({ id: 'p1' })],
      loadActiveRoute,
      concluirPartida: mockConcluirPartida,
    };
    rerender({ ...props, cargaConfirmada: false });
    rerender({ ...props, cargaConfirmada: true });
  }

  it('recusa do servidor: uma vez por rota, sem laço de escrita', async () => {
    mockConcluirPartida.mockResolvedValue('recusada');
    const { rerender, loadActiveRoute } = montar();
    await waitFor(() => expect(mockConcluirPartida).toHaveBeenCalledTimes(1));
    recarregar(rerender, loadActiveRoute);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockConcluirPartida).toHaveBeenCalledTimes(1);
    expect(loadActiveRoute).not.toHaveBeenCalled();
  });

  it('falha de rede não marca como tentada: a próxima carga confirmada tenta de novo', async () => {
    mockConcluirPartida.mockResolvedValueOnce('rede');
    const { rerender, loadActiveRoute } = montar();
    await waitFor(() => expect(mockConcluirPartida).toHaveBeenCalledTimes(1));
    expect(loadActiveRoute).not.toHaveBeenCalled();

    recarregar(rerender, loadActiveRoute);
    await waitFor(() => expect(mockConcluirPartida).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(loadActiveRoute).toHaveBeenCalled());
  });
});
