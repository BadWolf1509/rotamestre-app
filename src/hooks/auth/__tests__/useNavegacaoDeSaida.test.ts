/**
 * R-NUC-1: uma só dona da navegação "a conta saiu → login".
 *
 * Conta as chamadas de `router.replace`: cada saída (logout, sessão revogada)
 * leva ao login UMA vez, e só depois de os modais terem tempo de fechar.
 */
import { act, renderHook } from '@testing-library/react-native';

import { logger } from '@/lib/logger';

import {
  haSaidaEmCurso,
  PRAZO_FECHAR_MODAIS_MS,
  useNavegacaoDeSaida,
} from '../useNavegacaoDeSaida';

const mockReplace = jest.fn();
let mockSegments: string[] = ['gestor'];

// Container do expo-router: uma rota interna (o layout raiz) com a pilha de
// `app/_layout.tsx` aninhada. O comportamento real está medido em
// navegacao-de-saida-pilha-real.test.tsx.
let mockPilhaRaiz:
  | {
      key: string;
      index: number;
      stale?: false;
      routes?: { key: string; name: string }[];
    }
  | undefined;
let mockProntoParaNavegar = true;
const mockContainer = {
  isReady: () => mockProntoParaNavegar,
  getRootState: () => ({
    index: 0,
    routes: [{ name: '__root', state: mockPilhaRaiz }],
  }),
  dispatch: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSegments: () => mockSegments,
  useNavigationContainerRef: () => mockContainer,
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
    mockPilhaRaiz = { key: 'pilha-raiz', index: 0 };
    mockProntoParaNavegar = true;
    mockContainer.dispatch.mockClear();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
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

  // N-1: o replace só troca o topo da pilha raiz; o que a conta abriu antes
  // ficava montado embaixo do login.
  it('pilha raiz com telas empilhadas: esvazia a pilha raiz uma vez e então troca pelo login', () => {
    mockPilhaRaiz = { key: 'pilha-raiz', index: 2 };
    const { rerender } = renderHook(() => useNavegacaoDeSaida());
    mockUser = null;
    rerender({});
    esperarModais();

    expect(mockContainer.dispatch).toHaveBeenCalledTimes(1);
    expect(mockContainer.dispatch).toHaveBeenCalledWith({
      type: 'POP_TO_TOP',
      target: 'pilha-raiz',
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/auth/login');
    // Na ordem: primeiro esvazia, depois troca a tela que sobrou.
    expect(mockContainer.dispatch.mock.invocationCallOrder[0]).toBeLessThan(
      mockReplace.mock.invocationCallOrder[0],
    );
  });

  it('pilha raiz com uma tela só: basta o replace (POP_TO_TOP sobraria sem quem o trate)', () => {
    const { rerender } = renderHook(() => useNavegacaoDeSaida());
    mockUser = null;
    rerender({});
    esperarModais();
    expect(mockContainer.dispatch).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('container ainda sem estado: não esvazia, mas leva ao login', () => {
    mockProntoParaNavegar = false;
    const { rerender } = renderHook(() => useNavegacaoDeSaida());
    mockUser = null;
    rerender({});
    esperarModais();
    expect(mockContainer.dispatch).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledTimes(1);
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

  // A index pode estar na tela durante a espera (até 07/11 a troca de geração
  // remontava a pilha na saída; hoje a geração só muda na troca A→B). A
  // espera não pode morrer ali: era a index quem navegava, sem esperar os
  // modais.
  it('a pilha passa pela index durante a espera: navega mesmo assim, uma vez', () => {
    const { rerender } = renderHook(() => useNavegacaoDeSaida());
    mockUser = null;
    rerender({});
    mockSegments = [];
    rerender({});
    esperarModais();
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/auth/login');
  });

  it('a pilha está na index ANTES de a sessão sair: a dona navega (teve sessão)', () => {
    const { rerender } = renderHook(() => useNavegacaoDeSaida());
    mockSegments = [];
    rerender({});
    mockUser = null;
    rerender({});
    esperarModais();
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('abertura do app na index sem sessão é da index (nunca houve sessão)', () => {
    mockUser = null;
    mockSegments = [];
    renderHook(() => useNavegacaoDeSaida());
    esperarModais();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(haSaidaEmCurso()).toBe(false);
  });

  it('haSaidaEmCurso: verdadeiro durante a espera, falso depois', () => {
    const { rerender } = renderHook(() => useNavegacaoDeSaida());
    expect(haSaidaEmCurso()).toBe(false);
    mockUser = null;
    rerender({});
    expect(haSaidaEmCurso()).toBe(true);
    esperarModais();
    expect(haSaidaEmCurso()).toBe(false);
  });

  it('se outra parte já levou ao login durante a espera, não navega de novo', () => {
    const { rerender } = renderHook(() => useNavegacaoDeSaida());
    mockUser = null;
    rerender({});
    mockSegments = ['auth', 'login'];
    rerender({});
    esperarModais();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  // Rodada 1 da revisão: as exceções (exclusão de conta, conta desativada)
  // levam ao login sozinhas; a dona limpa o que ficou embaixo, sem replace.
  const PILHA_COM_LOGIN_NO_TOPO = {
    key: 'pilha-raiz',
    index: 2,
    stale: false as const,
    routes: [
      { key: 'gestor-1', name: 'gestor' },
      { key: 'perfil-1', name: 'perfil/index' },
      { key: 'auth-1', name: 'auth' },
    ],
  };

  it('a sessão acabou e outra parte abriu o login: limpa embaixo dele, mantendo o próprio login', () => {
    mockPilhaRaiz = PILHA_COM_LOGIN_NO_TOPO;
    mockSegments = ['exclusao-de-conta'];
    const { rerender } = renderHook(() => useNavegacaoDeSaida());
    mockUser = null;
    rerender({});
    esperarModais();
    // Fora das áreas protegidas: a tela segue (o diálogo de sucesso).
    expect(mockContainer.dispatch).not.toHaveBeenCalled();

    mockSegments = ['auth', 'login'];
    rerender({});
    esperarModais();

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockContainer.dispatch).toHaveBeenCalledTimes(1);
    expect(mockContainer.dispatch).toHaveBeenCalledWith({
      type: 'RESET',
      payload: {
        ...PILHA_COM_LOGIN_NO_TOPO,
        index: 0,
        routes: [{ key: 'auth-1', name: 'auth' }],
      },
      target: 'pilha-raiz',
    });

    // Re-renders no login não limpam de novo (uma vez por episódio).
    rerender({});
    esperarModais();
    expect(mockContainer.dispatch).toHaveBeenCalledTimes(1);
  });

  it('login aberto sem a sessão ter acabado neste app (botão "Entrar"): a dona não mexe', () => {
    mockPilhaRaiz = PILHA_COM_LOGIN_NO_TOPO;
    mockUser = null;
    mockSegments = ['exclusao-de-conta'];
    const { rerender } = renderHook(() => useNavegacaoDeSaida());
    mockSegments = ['auth', 'login'];
    rerender({});
    esperarModais();

    expect(mockContainer.dispatch).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('estado da pilha ainda parcial: não limpa (o RESET exige estado completo)', () => {
    mockPilhaRaiz = { key: 'pilha-raiz', index: 2 };
    const { rerender } = renderHook(() => useNavegacaoDeSaida());
    mockUser = null;
    mockSegments = ['auth', 'login'];
    rerender({});
    esperarModais();
    expect(mockContainer.dispatch).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('estado parcial ao limpar embaixo do login: registra logger.warn, sem dispatch', () => {
    const aviso = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    mockPilhaRaiz = { key: 'pilha-raiz', index: 2 };
    const { rerender } = renderHook(() => useNavegacaoDeSaida());
    mockUser = null;
    mockSegments = ['auth', 'login'];
    rerender({});
    esperarModais();

    expect(mockContainer.dispatch).not.toHaveBeenCalled();
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(aviso.mock.calls[0][0]).toContain('[useNavegacaoDeSaida]');
    expect(aviso.mock.calls[0]).toHaveLength(2);
    aviso.mockRestore();
  });

  it('container indisponível ao limpar embaixo do login: registra logger.warn', () => {
    const aviso = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    mockPilhaRaiz = PILHA_COM_LOGIN_NO_TOPO;
    const { rerender } = renderHook(() => useNavegacaoDeSaida());
    mockUser = null;
    mockSegments = ['auth', 'login'];
    mockProntoParaNavegar = false;
    rerender({});
    esperarModais();

    expect(mockContainer.dispatch).not.toHaveBeenCalled();
    expect(aviso).toHaveBeenCalledTimes(1);
    aviso.mockRestore();
  });

  it('login já sozinho na pilha: nada a limpar, sem aviso', () => {
    const aviso = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    mockPilhaRaiz = {
      key: 'pilha-raiz',
      index: 0,
      stale: false,
      routes: [{ key: 'auth-1', name: 'auth' }],
    };
    const { rerender } = renderHook(() => useNavegacaoDeSaida());
    mockUser = null;
    mockSegments = ['auth', 'login'];
    rerender({});
    esperarModais();

    expect(mockContainer.dispatch).not.toHaveBeenCalled();
    expect(aviso).not.toHaveBeenCalled();
    aviso.mockRestore();
  });

  it('abrir direto uma área protegida sem sessão leva ao login uma vez', () => {
    mockUser = null;
    mockSegments = ['perfil'];
    renderHook(() => useNavegacaoDeSaida());
    esperarModais();
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });
});
