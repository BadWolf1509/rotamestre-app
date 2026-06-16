import { renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { useSessionRecovery } from '../useSessionRecovery';

// Captura o callback do onAuthStateChange pra dispará-lo manualmente.
let authCb: ((event: string, session: unknown) => void) | null = null;
const mockUnsub = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: jest.fn((cb: (e: string, s: unknown) => void) => {
        authCb = cb;
        return { data: { subscription: { unsubscribe: mockUnsub } } };
      }),
    },
  },
  isRecoveryRedirect: undefined,
}));

const mockHasRecoveryParams = jest.fn();
const mockTryRecovery = jest.fn();
jest.mock('@/lib/auth/sessionRecovery', () => ({
  getHashErrorParams: jest.fn(() => ({})),
  hasRecoveryParamsInCurrentUrl: () => mockHasRecoveryParams(),
  trySessionRecoveryFromUrl: () => mockTryRecovery(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('useSessionRecovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authCb = null;
    jest.replaceProperty(Platform, 'OS', 'web');
    mockHasRecoveryParams.mockReturnValue(true);
    mockTryRecovery.mockResolvedValue(true);
  });

  it('com tokens de recovery na URL, NÃO aceita a sessão da sobra — estabelece pela URL', async () => {
    renderHook(() => useSessionRecovery());
    expect(authCb).toBeTruthy();

    // INITIAL_SESSION com uma sessão existente = SOBRA de outro usuário (ex.: gestor
    // logado no mesmo navegador). Aceitá-la faria o updateUser redefinir a conta errada.
    authCb!('INITIAL_SESSION', { user: { id: 'gestor-1' } });

    // O fix deve forçar trySessionRecoveryFromUrl (override pela URL), não aceitar a sobra.
    await waitFor(() => expect(mockTryRecovery).toHaveBeenCalledTimes(1));
  });

  it('evento PASSWORD_RECOVERY resolve sem tentar recovery manual', async () => {
    renderHook(() => useSessionRecovery());
    expect(authCb).toBeTruthy();

    authCb!('PASSWORD_RECOVERY', { user: { id: 'motorista-1' } });

    // PASSWORD_RECOVERY é o sinal canônico — não precisa do recovery manual.
    await waitFor(() => expect(mockTryRecovery).not.toHaveBeenCalled());
  });
});
