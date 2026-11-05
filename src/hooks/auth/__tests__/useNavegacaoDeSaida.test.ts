/**
 * R-NUC-1: uma só dona da navegação "a conta saiu → login".
 *
 * Conta as chamadas de `router.replace`: cada saída (logout, sessão revogada)
 * leva ao login UMA vez, e só depois de os modais terem tempo de fechar.
 */
import { act, renderHook } from '@testing-library/react-native';

import {
  PRAZO_FECHAR_MODAIS_MS,
  useNavegacaoDeSaida,
} from '../useNavegacaoDeSaida';

const mockReplace = jest.fn();
let mockSegments: string[] = ['gestor'];

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSegments: () => mockSegments,
}));

let mockUser: { id: string } | null = { id: 'gestor-1' };
let mockLoading = false;
let mockUsuarioOfflineId: string | null = null;

jest.mock('../../useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: mockLoading,
    usuarioOfflineId: mockUsuarioOfflineId,
  }),
}));

function esperarModais() {
  act(() => {
    jest.advanceTimersByTime(PRAZO_FECHAR_MODAIS_MS);
  });
}

describe('useNavegacaoDeSaida', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReplace.mockClear();
    mockSegments = ['gestor'];
    mockUser = { id: 'gestor-1' };
    mockLoading = false;
    mockUsuarioOfflineId = null;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('com sessão, não navega', () => {
    renderHook(() => useNavegacaoDeSaida());
    esperarModais();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('a conta sai numa área protegida: um replace para o login, depois do prazo dos modais', () => {
    const { rerender } = renderHook(() => useNavegacaoDeSaida());
    mockUser = null;
    rerender({});

    // Antes do prazo, os modais (menu lateral e diálogo) ainda estão saindo
    act(() => {
      jest.advanceTimersByTime(PRAZO_FECHAR_MODAIS_MS - 1);
    });
    expect(mockReplace).not.toHaveBeenCalled();

    esperarModais();
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/auth/login');
  });

  it('re-renders e troca de segmento durante a espera não repetem o replace', () => {
    const { rerender } = renderHook(() => useNavegacaoDeSaida());
    mockUser = null;
    rerender({});
    mockSegments = ['unidade'];
    rerender({});
    rerender({});
    esperarModais();
    esperarModais();
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('nova saída depois de um novo login navega de novo (uma por episódio)', () => {
    const { rerender } = renderHook(() => useNavegacaoDeSaida());
    mockUser = null;
    rerender({});
    esperarModais();

    mockSegments = ['auth', 'login'];
    rerender({});
    mockUser = { id: 'motorista-1' };
    mockSegments = ['motorista'];
    rerender({});
    mockUser = null;
    rerender({});
    esperarModais();

    expect(mockReplace).toHaveBeenCalledTimes(2);
  });

  it('a sessão volta antes do prazo (refresh): não navega', () => {
    const { rerender } = renderHook(() => useNavegacaoDeSaida());
    mockUser = null;
    rerender({});
    mockUser = { id: 'gestor-1' };
    rerender({});
    esperarModais();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it.each([
    [['auth', 'login']],
    [['onboarding', 'criar-unidade']],
    [[]],
    [['politica-de-privacidade']],
  ])('fora das áreas protegidas (%j), não navega', (segmentos) => {
    mockSegments = segmentos;
    mockUser = null;
    renderHook(() => useNavegacaoDeSaida());
    esperarModais();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('enquanto a sessão carrega, não navega', () => {
    mockUser = null;
    mockLoading = true;
    renderHook(() => useNavegacaoDeSaida());
    esperarModais();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('offline com o último usuário não é "deslogado"', () => {
    mockUser = null;
    mockUsuarioOfflineId = 'motorista-1';
    renderHook(() => useNavegacaoDeSaida());
    esperarModais();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('abrir direto uma área protegida sem sessão leva ao login uma vez', () => {
    mockUser = null;
    mockSegments = ['perfil'];
    renderHook(() => useNavegacaoDeSaida());
    esperarModais();
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });
});
