import { supabase } from '@/lib/supabase';

import {
  _resetRedeObservada,
  _ouvintesDeQuedaAtivos,
  registrarFalhaDeRede,
} from '../../redeObservada';
import {
  descartarLeituraEmCurso,
  lerSessao,
  PRAZO_LEITURA_SESSAO_MS,
} from '../sessao';

const getSession = supabase.auth.getSession as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  _resetRedeObservada();
  // Cada teste deixa o getSession preso de propósito: a vaga não se libera sozinha.
  descartarLeituraEmCurso();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  _resetRedeObservada();
});

/** Avança o relógio falso e drena as microtarefas no meio. */
async function act(ms: number) {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  jest.advanceTimersByTime(ms);
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

/**
 * Wi-Fi sem internet, token vencido: o refresh do auth-js é a primeira
 * requisição a falhar, e o getSession fica preso no recuo dele. Observada a
 * queda, a leitura não espera o prazo de 10 s.
 */
describe('lerSessao com rede caída observada', () => {
  it('queda observada no meio da leitura: offline antes do prazo', async () => {
    getSession.mockReturnValue(new Promise(() => {}));
    let resultado: unknown = 'pendente';
    void lerSessao().then((r) => {
      resultado = r;
    });

    await act(100);
    expect(resultado).toBe('pendente');
    // Guarda contra teste vazio: 100 ms tem de estar longe do prazo.
    expect(100).toBeLessThan(PRAZO_LEITURA_SESSAO_MS);

    registrarFalhaDeRede();
    await act(0);
    expect(resultado).toEqual({ session: null, offline: true });
  });

  it('quem chega no meio herda a mesma corrida', async () => {
    getSession.mockReturnValue(new Promise(() => {}));
    const a = lerSessao();
    await act(100);
    const b = lerSessao();

    registrarFalhaDeRede();
    await act(0);
    await expect(a).resolves.toEqual({ session: null, offline: true });
    await expect(b).resolves.toEqual({ session: null, offline: true });
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  /**
   * A queda observada só encurta a espera do REFRESH; não substitui a leitura
   * local. Com o token válido o getSession nem vai à rede — responder offline
   * deixaria o useAuth sem sessão (e sem realtime) por até 20 s com rede boa.
   */
  it('sinal JÁ ligado e getSession com sessão válida: devolve a sessão', async () => {
    registrarFalhaDeRede();
    getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
      error: null,
    });

    await expect(lerSessao()).resolves.toEqual({
      session: { user: { id: 'u1' } },
      offline: false,
    });
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it('sinal JÁ ligado e getSession preso: só o prazo (ou queda nova) decide', async () => {
    registrarFalhaDeRede();
    getSession.mockReturnValue(new Promise(() => {}));
    let resultado: unknown = 'pendente';
    void lerSessao().then((r) => {
      resultado = r;
    });

    await act(100);
    expect(resultado).toBe('pendente');

    // Queda registrada DEPOIS do início da leitura encurta a espera.
    registrarFalhaDeRede();
    await act(0);
    expect(resultado).toEqual({ session: null, offline: true });
  });

  it('consulta terminada: o ouvinte da queda é cancelado (não vaza)', async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
      error: null,
    });
    await expect(lerSessao()).resolves.toEqual({
      session: { user: { id: 'u1' } },
      offline: false,
    });
    await act(0);

    expect(_ouvintesDeQuedaAtivos()).toBe(0);
    // Nem o timer do prazo nem o da guarda do NetInfo sobrevivem.
    expect(jest.getTimerCount()).toBe(0);
  });
});
