/**
 * "Sair" do menu: com entregas, fotos ou trajeto ainda no aparelho, o diálogo
 * diz o que fica para trás (e o app tenta enviar), em vez de só perguntar.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useDrawerLogout } from '../useDrawerLogout';

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('@/lib/auth', () => ({
  authService: { signOut: jest.fn(() => Promise.resolve()) },
}));
const mockContar = jest.fn();
jest.mock('@/lib/motorista/pendenciasDoAparelho', () => {
  const real = jest.requireActual('@/lib/motorista/pendenciasDoAparelho');
  return {
    ...real,
    contarPendenciasDaConta: (...a: unknown[]) => mockContar(...a),
  };
});
const mockEnviar = jest.fn(() => Promise.resolve({ fotos: 0, acoes: 0 }));
jest.mock('@/lib/offline', () => ({
  solicitarEnvioFila: () => mockEnviar(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockContar.mockResolvedValue({ acoes: 0, fotos: 0, posicoes: 0 });
});

describe('useDrawerLogout — aviso de pendências', () => {
  it('sem pendência: a pergunta de sempre, sem disparar envio', async () => {
    const { result } = renderHook(() =>
      useDrawerLogout({ onClose: jest.fn(), motoristaId: 'm1' }),
    );
    await act(async () => {
      result.current.handleLogoutPress();
    });

    expect(result.current.showLogoutDialog).toBe(true);
    expect(result.current.logoutMessage).toBe(
      'Deseja realmente encerrar sua sessão?',
    );
    expect(mockEnviar).not.toHaveBeenCalled();
  });

  it('com entregas na fila: avisa quantas e tenta enviar', async () => {
    mockContar.mockResolvedValue({ acoes: 3, fotos: 2, posicoes: 0 });
    const { result } = renderHook(() =>
      useDrawerLogout({ onClose: jest.fn(), motoristaId: 'm1' }),
    );
    await act(async () => {
      result.current.handleLogoutPress();
    });

    await waitFor(() =>
      expect(result.current.logoutMessage).toContain('3 registros de parada'),
    );
    expect(result.current.logoutConfirmText).toBe('Sair mesmo assim');
    expect(mockContar).toHaveBeenCalledWith('m1');
    expect(mockEnviar).toHaveBeenCalled();
  });

  it('"Sair" fica desabilitado até a contagem terminar, e não sai antes', async () => {
    let terminar: (v: unknown) => void = () => undefined;
    mockContar.mockReturnValue(
      new Promise((r) => {
        terminar = r;
      }),
    );
    const { authService } = jest.requireMock('@/lib/auth') as {
      authService: { signOut: jest.Mock };
    };
    const { result } = renderHook(() =>
      useDrawerLogout({ onClose: jest.fn(), motoristaId: 'm1' }),
    );
    await act(async () => {
      result.current.handleLogoutPress();
    });
    expect(result.current.contandoPendencias).toBe(true);

    await act(async () => {
      await result.current.handleLogoutConfirm();
    });
    expect(authService.signOut).not.toHaveBeenCalled();

    await act(async () => {
      terminar({ acoes: 0, fotos: 0, posicoes: 0 });
    });
    expect(result.current.contandoPendencias).toBe(false);
  });

  it('só trajeto pendente: avisa, mas não dispara o envio (ele não manda posições)', async () => {
    mockContar.mockResolvedValue({ acoes: 0, fotos: 0, posicoes: 4 });
    const { result } = renderHook(() =>
      useDrawerLogout({ onClose: jest.fn(), motoristaId: 'm1' }),
    );
    await act(async () => {
      result.current.handleLogoutPress();
    });

    await waitFor(() =>
      expect(result.current.logoutMessage).toContain('trajeto'),
    );
    expect(mockEnviar).not.toHaveBeenCalled();
  });

  it('sem motorista (gestor): não consulta as filas', async () => {
    const { result } = renderHook(() =>
      useDrawerLogout({ onClose: jest.fn() }),
    );
    await act(async () => {
      result.current.handleLogoutPress();
    });

    expect(mockContar).not.toHaveBeenCalled();
    expect(result.current.logoutConfirmText).toBe('Sair');
  });
});
