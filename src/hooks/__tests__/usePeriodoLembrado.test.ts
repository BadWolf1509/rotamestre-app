import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { logger } from '@/lib/logger';
import { resolverPeriodo } from '@/lib/periodo';

import { chavePeriodo, usePeriodoLembrado } from '../usePeriodoLembrado';

let mockUsuarioId: string | undefined = 'u1';
let mockCarregandoUsuario = false;
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    userData: mockUsuarioId ? { id: mockUsuarioId } : null,
    loading: mockCarregandoUsuario,
  }),
}));

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const armazem = new Map<string, string>();
const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;

beforeEach(() => {
  armazem.clear();
  mockUsuarioId = 'u1';
  mockCarregandoUsuario = false;
  jest.clearAllMocks();
  getItem.mockImplementation(async (k: string) => armazem.get(k) ?? null);
  setItem.mockImplementation(async (k: string, v: string) => {
    armazem.set(k, v);
  });
});

async function montar(
  tela: Parameters<typeof usePeriodoLembrado>[0] = 'gestao_rotas',
) {
  const hook = renderHook(() => usePeriodoLembrado(tela));
  await waitFor(() => expect(hook.result.current.carregado).toBe(true));
  return hook;
}

describe('chavePeriodo', () => {
  it('segue o formato por tela e usuário', () => {
    expect(chavePeriodo('gestao_rotas', 'u1')).toBe(
      '@rotamestre:periodo:gestao_rotas:u1',
    );
  });
});

describe('usePeriodoLembrado', () => {
  it('sem nada gravado devolve o padrão e carregado', async () => {
    const { result } = await montar();
    expect(result.current.periodo).toEqual({ tipo: 'este_mes' });
  });

  it('antes de carregar, o período é o padrão', async () => {
    const { result } = renderHook(() => usePeriodoLembrado('gestao_rotas'));
    expect(result.current.carregado).toBe(false);
    expect(result.current.periodo).toEqual({ tipo: 'este_mes' });
    await waitFor(() => expect(result.current.carregado).toBe(true));
  });

  it('definirPeriodo grava o JSON na chave da tela e do usuário', async () => {
    const { result } = await montar();
    act(() => result.current.definirPeriodo({ tipo: 'mes_passado' }));
    expect(result.current.periodo).toEqual({ tipo: 'mes_passado' });
    expect(setItem).toHaveBeenCalledWith(
      '@rotamestre:periodo:gestao_rotas:u1',
      JSON.stringify({ tipo: 'mes_passado' }),
    );
  });

  it('lê o que estava gravado', async () => {
    armazem.set(
      chavePeriodo('gestao_rotas', 'u1'),
      JSON.stringify({ tipo: 'hoje' }),
    );
    const { result } = await montar();
    expect(result.current.periodo).toEqual({ tipo: 'hoje' });
  });

  it('Review Focus 2: atalho gravado em outro mês resolve para o mês atual', async () => {
    jest.useFakeTimers({
      doNotFake: [
        'hrtime',
        'nextTick',
        'performance',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
      ],
    });
    try {
      jest.setSystemTime(new Date(2026, 9, 31, 12, 0, 0));
      const a = await montar();
      act(() => a.result.current.definirPeriodo({ tipo: 'este_mes' }));
      a.unmount();

      jest.setSystemTime(new Date(2027, 0, 15, 9, 0, 0));
      const b = await montar();
      expect(b.result.current.periodo).toEqual({ tipo: 'este_mes' });
      expect(resolverPeriodo(b.result.current.periodo)).toEqual({
        de: '2027-01-01',
        ate: '2027-01-31',
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('o personalizado volta com as mesmas datas', async () => {
    const p = {
      tipo: 'personalizado',
      de: '2026-10-01',
      ate: '2026-10-15',
    } as const;
    const a = await montar();
    act(() => a.result.current.definirPeriodo(p));
    a.unmount();
    const b = await montar();
    expect(b.result.current.periodo).toEqual(p);
  });

  it('Review Focus 3: JSON quebrado volta ao padrão sem lançar', async () => {
    armazem.set(chavePeriodo('gestao_rotas', 'u1'), '{quebrado');
    const { result } = await montar();
    expect(result.current.periodo).toEqual({ tipo: 'este_mes' });
  });

  it('Review Focus 3: personalizado com de > ate volta ao padrão', async () => {
    armazem.set(
      chavePeriodo('gestao_rotas', 'u1'),
      JSON.stringify({
        tipo: 'personalizado',
        de: '2026-11-10',
        ate: '2026-11-01',
      }),
    );
    const { result } = await montar();
    expect(result.current.periodo).toEqual({ tipo: 'este_mes' });
  });

  it('usuários e telas diferentes não se veem', async () => {
    const a = await montar();
    act(() => a.result.current.definirPeriodo({ tipo: 'ontem' }));
    a.unmount();

    mockUsuarioId = 'u2';
    const outroUsuario = await montar();
    expect(outroUsuario.result.current.periodo).toEqual({ tipo: 'este_mes' });
    outroUsuario.unmount();

    mockUsuarioId = 'u1';
    const outraTela = await montar('incidentes');
    expect(outraTela.result.current.periodo).toEqual({ tipo: 'este_mes' });
  });

  it('sem usuário não grava e usa o padrão', async () => {
    mockUsuarioId = undefined;
    const { result } = await montar();
    act(() => result.current.definirPeriodo({ tipo: 'hoje' }));
    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });

  it('falha de leitura vira warn e segue com o padrão', async () => {
    getItem.mockRejectedValueOnce(new Error('disco'));
    const { result } = await montar();
    expect(result.current.periodo).toEqual({ tipo: 'este_mes' });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('falha de gravação vira warn e o período em memória vale', async () => {
    setItem.mockRejectedValueOnce(new Error('cheio'));
    const { result } = await montar();
    act(() => result.current.definirPeriodo({ tipo: 'ontem' }));
    await waitFor(() => expect(logger.warn).toHaveBeenCalled());
    expect(result.current.periodo).toEqual({ tipo: 'ontem' });
  });

  it('carregado é false enquanto o usuário carrega e vira true com o período lembrado', async () => {
    armazem.set(
      chavePeriodo('gestao_rotas', 'u1'),
      JSON.stringify({ tipo: 'hoje' }),
    );
    mockUsuarioId = undefined;
    mockCarregandoUsuario = true;
    const hook = renderHook(() => usePeriodoLembrado('gestao_rotas'));
    await act(async () => {});
    expect(hook.result.current.carregado).toBe(false);
    expect(getItem).not.toHaveBeenCalled();

    mockUsuarioId = 'u1';
    mockCarregandoUsuario = false;
    hook.rerender({});
    await waitFor(() => expect(hook.result.current.carregado).toBe(true));
    expect(hook.result.current.periodo).toEqual({ tipo: 'hoje' });
  });

  it('usuário definitivamente ausente: padrão e carregado', async () => {
    mockUsuarioId = undefined;
    mockCarregandoUsuario = false;
    const { result } = await montar();
    expect(result.current.periodo).toEqual({ tipo: 'este_mes' });
  });

  it('escolha feita antes da leitura terminar não é sobrescrita pela leitura tardia', async () => {
    armazem.set(
      chavePeriodo('gestao_rotas', 'u1'),
      JSON.stringify({ tipo: 'hoje' }),
    );
    let liberar: (v: string | null) => void = () => {};
    getItem.mockImplementationOnce(
      () => new Promise<string | null>((r) => (liberar = r)),
    );
    const { result } = renderHook(() => usePeriodoLembrado('gestao_rotas'));
    act(() => result.current.definirPeriodo({ tipo: 'ontem' }));
    await act(async () => {
      liberar(JSON.stringify({ tipo: 'hoje' }));
    });
    expect(result.current.periodo).toEqual({ tipo: 'ontem' });
    expect(result.current.carregado).toBe(true);
  });

  it('troca de usuário por rerender não expõe o período do anterior', async () => {
    armazem.set(
      chavePeriodo('gestao_rotas', 'u1'),
      JSON.stringify({ tipo: 'ontem' }),
    );
    const vistos: { periodo: unknown; carregado: boolean }[] = [];
    const hook = renderHook(() => {
      const r = usePeriodoLembrado('gestao_rotas');
      vistos.push({ periodo: r.periodo, carregado: r.carregado });
      return r;
    });
    await waitFor(() => expect(hook.result.current.carregado).toBe(true));
    expect(hook.result.current.periodo).toEqual({ tipo: 'ontem' });

    vistos.length = 0;
    mockUsuarioId = 'u2';
    hook.rerender({});
    await waitFor(() => expect(hook.result.current.carregado).toBe(true));
    expect(hook.result.current.periodo).toEqual({ tipo: 'este_mes' });
    // Nenhum render pronto (carregado) trouxe o período de u1.
    expect(
      vistos.filter(
        (v) => v.carregado && (v.periodo as { tipo: string }).tipo === 'ontem',
      ),
    ).toEqual([]);
    // O primeiro render após a troca já não está pronto.
    expect(vistos[0].carregado).toBe(false);
  });
});
