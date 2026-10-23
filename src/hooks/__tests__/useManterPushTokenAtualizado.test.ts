/**
 * Monta o reenvio do registro de push: ao abrir (cold start) força; ao voltar
 * ao primeiro plano chama sem forçar (o intervalo mínimo vive na lib).
 */
import { renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useManterPushTokenAtualizado } from '../useManterPushTokenAtualizado';

const mockAtualizar = jest.fn().mockResolvedValue(true);
jest.mock('../../lib/notifications', () => ({
  atualizarRegistroDePush: (...a: unknown[]) => mockAtualizar(...a),
}));

describe('useManterPushTokenAtualizado', () => {
  let ouvinte: ((estado: string) => void) | undefined;
  const remove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    ouvinte = undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _: string,
      cb: (estado: string) => void,
    ) => {
      ouvinte = cb;
      return { remove };
    }) as never);
  });

  it('ao montar, reenvia forçando', () => {
    renderHook(() => useManterPushTokenAtualizado());
    expect(mockAtualizar).toHaveBeenCalledWith({ forcar: true });
  });

  it('ao voltar ao primeiro plano, chama sem forçar', () => {
    renderHook(() => useManterPushTokenAtualizado());
    mockAtualizar.mockClear();

    ouvinte?.('active');
    expect(mockAtualizar).toHaveBeenCalledWith({ forcar: false });
  });

  it('ao ir para segundo plano, não chama', () => {
    renderHook(() => useManterPushTokenAtualizado());
    mockAtualizar.mockClear();

    ouvinte?.('background');
    expect(mockAtualizar).not.toHaveBeenCalled();
  });

  it('remove o ouvinte ao desmontar', () => {
    const { unmount } = renderHook(() => useManterPushTokenAtualizado());
    unmount();
    expect(remove).toHaveBeenCalled();
  });
});
