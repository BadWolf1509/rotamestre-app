/**
 * useMapaRotaHandlers - parada feita não se edita nem se remove (G4)
 *
 * O gestor clica em Editar/Remover num retrato velho: o motorista acabou de
 * concluir a parada. O clique chega com a parada "pendente" na mão, mas a
 * tela viva (realtime) já sabe que está concluída — e a decisão vale pelo
 * estado vivo, não pelo objeto do clique.
 */

import { renderHook, act } from '@testing-library/react-native';

import { removerParadaERecalcular } from '@/lib/routeUtils';

import { useMapaRotaHandlers } from '../useMapaRotaHandlers';

import type { Parada, Rota } from '../../types';

const mockShowToast = jest.fn();
jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: { id: 'user-1', nome: 'Gestor' } }),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn() },
}));

jest.mock('@/lib/routeUtils', () => ({
  removerParadaERecalcular: jest.fn(),
  reordenarParadas: jest.fn(),
  recalcularRota: jest.fn(),
  notificarMotoristaRotaEditada: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const MENSAGEM =
  'Esta parada já foi finalizada pelo motorista e não pode mais ser alterada. A tela foi atualizada.';

const MENSAGEM_INICIADA =
  'O motorista já iniciou esta parada e ela não pode mais ser alterada. A tela foi atualizada.';

const parada = (id: string, ordem: number, status = 'pendente'): Parada => ({
  id,
  ordem,
  endereco: `Rua ${ordem}`,
  tipo: 'entrega',
  status,
  latitude: -23.5,
  longitude: -46.6,
});

const rotaEmAndamento: Rota = {
  id: 'rota-1',
  data: '2026-10-24',
  status: 'em_andamento',
  motorista_id: 'm-1',
};

function montar(
  paradasVivas: Parada[],
  rota: Rota = rotaEmAndamento,
  recarregar = jest.fn().mockResolvedValue(undefined),
) {
  const hook = renderHook(
    (props: { paradas: Parada[]; rota: Rota }) =>
      useMapaRotaHandlers({
        showToast: mockShowToast,
        rotaId: 'rota-1',
        rota: props.rota,
        paradas: props.paradas,
        paradasReais: props.paradas,
        enderecoUnidade: { latitude: -23.5, longitude: -46.6 },
        loadRotaEParadas: recarregar,
      }),
    { initialProps: { paradas: paradasVivas, rota } },
  );
  return { ...hook, recarregar };
}

describe('useMapaRotaHandlers: parada feita', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Editar com a parada já concluída na tela viva: recusa, avisa e recarrega', () => {
    const { result, recarregar } = montar([parada('p1', 1, 'concluida')]);

    act(() => {
      result.current.handleEditStop(parada('p1', 1, 'pendente')); // clique velho
    });

    expect(result.current.paradaToEdit).toBeNull();
    expect(mockShowToast).toHaveBeenCalledWith(MENSAGEM, 'error');
    expect(recarregar).toHaveBeenCalled();
  });

  it('Remover com a parada já pulada na tela viva: recusa, avisa e recarrega', () => {
    const { result, recarregar } = montar([parada('p1', 1, 'pulada')]);

    act(() => {
      result.current.handleRemoveStopRequest(parada('p1', 1, 'pendente'));
    });

    expect(result.current.paradaToRemove).toBeNull();
    expect(mockShowToast).toHaveBeenCalledWith(MENSAGEM, 'error');
    expect(recarregar).toHaveBeenCalled();
  });

  it('parada pendente em rota em andamento: segue abrindo Editar e Remover', () => {
    const { result } = montar([parada('p1', 1)]);

    act(() => {
      result.current.handleEditStop(parada('p1', 1));
      result.current.handleRemoveStopRequest(parada('p1', 1));
    });

    expect(result.current.paradaToEdit?.id).toBe('p1');
    expect(result.current.paradaToRemove?.id).toBe('p1');
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it('rota cancelada: Remover e Editar não abrem, com aviso próprio', () => {
    const { result } = montar([parada('p1', 1)], {
      ...rotaEmAndamento,
      status: 'cancelada',
    });

    act(() => {
      result.current.handleEditStop(parada('p1', 1));
      result.current.handleRemoveStopRequest(parada('p1', 1));
    });

    expect(result.current.paradaToEdit).toBeNull();
    expect(result.current.paradaToRemove).toBeNull();
    expect(mockShowToast).toHaveBeenCalledWith(
      'Esta rota não aceita mais alterações nas paradas.',
      'error',
    );
  });

  it('diálogo de Remover já aberto quando o motorista conclui: fecha e avisa', () => {
    const { result, rerender } = montar([parada('p1', 1)]);
    act(() => {
      result.current.handleRemoveStopRequest(parada('p1', 1));
    });
    expect(result.current.paradaToRemove?.id).toBe('p1');

    rerender({
      paradas: [parada('p1', 1, 'concluida')],
      rota: rotaEmAndamento,
    });

    expect(result.current.paradaToRemove).toBeNull();
    expect(mockShowToast).toHaveBeenCalledWith(MENSAGEM, 'error');
  });

  it('modal de Editar já aberto quando o motorista conclui: fecha e avisa', () => {
    const { result, rerender } = montar([parada('p1', 1)]);
    act(() => {
      result.current.handleEditStop(parada('p1', 1));
    });

    rerender({
      paradas: [parada('p1', 1, 'concluida')],
      rota: rotaEmAndamento,
    });

    expect(result.current.paradaToEdit).toBeNull();
    expect(mockShowToast).toHaveBeenCalledWith(MENSAGEM, 'error');
  });

  it('confirmar a remoção de parada que ficou concluída: nem chama o banco', async () => {
    // Estado vivo muda ENTRE o pedido e a confirmação, sem a tela reagir
    // (ex.: o efeito de fechar ainda não rodou).
    const { result, rerender } = montar([parada('p1', 1)]);
    act(() => {
      result.current.handleRemoveStopRequest(parada('p1', 1));
    });
    rerender({
      paradas: [parada('p1', 1, 'concluida')],
      rota: rotaEmAndamento,
    });
    mockShowToast.mockClear();

    await act(async () => {
      await result.current.handleConfirmRemoveStop();
    });

    expect(removerParadaERecalcular).not.toHaveBeenCalled();
  });

  it('o banco recusa a remoção: mostra o erro em português e recarrega a tela', async () => {
    (removerParadaERecalcular as jest.Mock).mockResolvedValue({
      success: false,
      error:
        'Esta parada já foi finalizada pelo motorista e não pode ser removida.',
    });
    const { result, recarregar } = montar([parada('p1', 1)]);
    act(() => {
      result.current.handleRemoveStopRequest(parada('p1', 1));
    });

    await act(async () => {
      await result.current.handleConfirmRemoveStop();
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      'Esta parada já foi finalizada pelo motorista e não pode ser removida.',
      'error',
    );
    expect(recarregar).toHaveBeenCalled();
  });

  it('parada que o motorista iniciou (em andamento): Editar e Remover recusam com aviso próprio, sem dizer que foi finalizada', () => {
    const { result, recarregar } = montar([parada('p1', 1, 'em_andamento')]);

    act(() => {
      result.current.handleEditStop(parada('p1', 1, 'pendente'));
      result.current.handleRemoveStopRequest(parada('p1', 1, 'pendente'));
    });

    expect(result.current.paradaToEdit).toBeNull();
    expect(result.current.paradaToRemove).toBeNull();
    expect(mockShowToast).toHaveBeenCalledWith(MENSAGEM_INICIADA, 'error');
    expect(mockShowToast).not.toHaveBeenCalledWith(MENSAGEM, 'error');
    expect(recarregar).toHaveBeenCalled();
  });

  it('diálogo aberto quando o motorista INICIA a parada: fecha com o aviso de iniciada', () => {
    const { result, rerender } = montar([parada('p1', 1)]);
    act(() => {
      result.current.handleRemoveStopRequest(parada('p1', 1));
    });

    rerender({
      paradas: [parada('p1', 1, 'em_andamento')],
      rota: rotaEmAndamento,
    });

    expect(result.current.paradaToRemove).toBeNull();
    expect(mockShowToast).toHaveBeenCalledWith(MENSAGEM_INICIADA, 'error');
  });
});
