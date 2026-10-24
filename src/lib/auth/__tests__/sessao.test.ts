import NetInfo from '@react-native-community/netinfo';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

import { FalhaAoCarregarPerfil } from '../falhaPerfil';
import {
  descartarLeituraEmCurso,
  exigirSessaoDe,
  lerSessao,
  PRAZO_LEITURA_SESSAO_MS,
} from '../sessao';

const getSession = supabase.auth.getSession as jest.Mock;
const sessaoDe = (id: string) => ({ user: { id } });
const semRede = () => new AuthRetryableFetchError('Failed to fetch', 0);

beforeEach(() => jest.clearAllMocks());

/**
 * auth-js 2.x: access token vencido + refresh sem rede devolve
 * `{ session: null, error: AuthRetryableFetchError }` e NÃO apaga a sessão do
 * storage. Descartar o `error` lia isso como "deslogado" e mandava ao login.
 */
describe('lerSessao', () => {
  it('com sessão: devolve a sessão, online', async () => {
    getSession.mockResolvedValue({
      data: { session: sessaoDe('u1') },
      error: null,
    });
    await expect(lerSessao()).resolves.toEqual({
      session: sessaoDe('u1'),
      offline: false,
    });
  });

  it('refresh sem rede: sem sessão, mas OFFLINE (não deslogado)', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: semRede() });
    await expect(lerSessao()).resolves.toEqual({
      session: null,
      offline: true,
    });
  });

  it('sessão revogada (erro não retryable): deslogado de verdade', async () => {
    getSession.mockResolvedValue({
      data: { session: null },
      error: new AuthApiError(
        'Invalid Refresh Token',
        400,
        'refresh_token_not_found',
      ),
    });
    await expect(lerSessao()).resolves.toEqual({
      session: null,
      offline: false,
    });
  });

  it('sem sessão e sem erro: deslogado', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(lerSessao()).resolves.toEqual({
      session: null,
      offline: false,
    });
  });
});

describe('exigirSessaoDe (a busca só vale autenticada)', () => {
  it('passa com a sessão do próprio usuário', async () => {
    getSession.mockResolvedValue({
      data: { session: sessaoDe('u1') },
      error: null,
    });
    await expect(exigirSessaoDe('u1')).resolves.toBeUndefined();
  });

  it('sem sessão: falha TRANSITÓRIA (a query sairia anônima e voltaria vazia)', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: semRede() });
    const erro = await exigirSessaoDe('u1').catch((e) => e);
    expect(erro).toBeInstanceOf(FalhaAoCarregarPerfil);
    expect(erro.transitoria).toBe(true);
  });

  it('sessão de outra conta: falha transitória (troca em curso)', async () => {
    getSession.mockResolvedValue({
      data: { session: sessaoDe('outra') },
      error: null,
    });
    const erro = await exigirSessaoDe('u1').catch((e) => e);
    expect(erro).toBeInstanceOf(FalhaAoCarregarPerfil);
    expect(erro.transitoria).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Espera na reabertura sem rede (1.14.5, Tarefa 3)
// ---------------------------------------------------------------------------

describe('lerSessao: sem rede e rede pendurada', () => {
  const fetchNetInfo = NetInfo.fetch as jest.Mock;

  function deferido<T>() {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }

  afterEach(() => {
    fetchNetInfo.mockReset();
    fetchNetInfo.mockResolvedValue({ isConnected: true, type: 'wifi' });
    jest.useRealTimers();
  });

  // Modo avião + token vencido: o auth-js tenta renovar por ~25 s e o
  // getSession espera junto. Com o NetInfo afirmando "sem rede", a resposta é
  // offline na hora — sem esperar prazo nenhum, sem nem perguntar ao auth-js.
  it('NetInfo desconectado: offline na hora, sem avançar relógio', async () => {
    jest.useFakeTimers();
    fetchNetInfo.mockResolvedValue({ isConnected: false, type: 'none' });
    getSession.mockReturnValue(new Promise(() => {}));

    await expect(lerSessao()).resolves.toEqual({
      session: null,
      offline: true,
    });
    expect(getSession).not.toHaveBeenCalled();
  });

  it('exigirSessaoDe com NetInfo desconectado: falha transitória na hora', async () => {
    jest.useFakeTimers();
    fetchNetInfo.mockResolvedValue({ isConnected: false, type: 'none' });

    const erro = await exigirSessaoDe('u1').catch((e) => e);
    expect(erro).toBeInstanceOf(FalhaAoCarregarPerfil);
    expect(erro.transitoria).toBe(true);
  });

  // Rede de uma barra: NetInfo "conectado", getSession pendurado. O prazo
  // continua valendo e leva ao modo offline — nunca a "deslogado".
  it('conectado + pendurado: offline no prazo, nunca deslogado', async () => {
    jest.useFakeTimers();
    const pendurado = deferido<unknown>();
    getSession.mockReturnValue(pendurado.promise);

    const leitura = lerSessao();
    await act(PRAZO_LEITURA_SESSAO_MS);
    await expect(leitura).resolves.toEqual({ session: null, offline: true });

    pendurado.resolve({ data: { session: null }, error: semRede() });
    await Promise.resolve();
  });

  // O que somava: index (10 s) e depois o useAuth do layout (mais 10 s),
  // e o `exigirSessaoDe` do useUser sem prazo nenhum, todos esperando o MESMO
  // getSession pendurado. Quem chega depois de o prazo estourar, com ele ainda
  // pendurado, recebe offline na hora.
  it('prazo já estourado e getSession ainda pendurado: o próximo é offline na hora', async () => {
    jest.useFakeTimers();
    const pendurado = deferido<unknown>();
    getSession.mockReturnValue(pendurado.promise);

    const primeira = lerSessao();
    await act(PRAZO_LEITURA_SESSAO_MS);
    await primeira;

    // Nenhum avanço de relógio daqui em diante.
    await expect(lerSessao()).resolves.toEqual({
      session: null,
      offline: true,
    });
    const erro = await exigirSessaoDe('u1').catch((e) => e);
    expect(erro).toBeInstanceOf(FalhaAoCarregarPerfil);
    expect(getSession).toHaveBeenCalledTimes(1);

    pendurado.resolve({ data: { session: null }, error: semRede() });
    await Promise.resolve();
  });

  it('chamadas simultâneas dividem o mesmo prazo (não somam)', async () => {
    jest.useFakeTimers();
    const pendurado = deferido<unknown>();
    getSession.mockReturnValue(pendurado.promise);

    const a = lerSessao();
    await act(PRAZO_LEITURA_SESSAO_MS / 2);
    const b = lerSessao();
    await act(PRAZO_LEITURA_SESSAO_MS / 2);

    await expect(a).resolves.toEqual({ session: null, offline: true });
    await expect(b).resolves.toEqual({ session: null, offline: true });
    expect(getSession).toHaveBeenCalledTimes(1);

    pendurado.resolve({ data: { session: null }, error: semRede() });
    await Promise.resolve();
  });

  it('quando o getSession pendurado enfim responde, a próxima leitura pergunta de novo', async () => {
    jest.useFakeTimers();
    const pendurado = deferido<unknown>();
    getSession.mockReturnValueOnce(pendurado.promise);

    const primeira = lerSessao();
    await act(PRAZO_LEITURA_SESSAO_MS);
    await primeira;

    pendurado.resolve({ data: { session: sessaoDe('u1') }, error: null });
    await act(0);

    getSession.mockResolvedValueOnce({
      data: { session: sessaoDe('u1') },
      error: null,
    });
    await expect(lerSessao()).resolves.toEqual({
      session: sessaoDe('u1'),
      offline: false,
    });
    expect(getSession).toHaveBeenCalledTimes(2);
  });
});

describe('descartarLeituraEmCurso (evento do auth mais novo que a leitura)', () => {
  afterEach(() => jest.useRealTimers());

  // Login ou TOKEN_REFRESHED com o getSession velho ainda preso: o "offline"
  // da leitura estourada não pode responder por quem acabou de entrar.
  it('depois do descarte, a próxima leitura pergunta de novo ao auth-js', async () => {
    jest.useFakeTimers();
    let soltar!: (v: unknown) => void;
    getSession.mockReturnValueOnce(
      new Promise((r) => {
        soltar = r;
      }),
    );

    const primeira = lerSessao();
    await act(PRAZO_LEITURA_SESSAO_MS);
    await primeira;

    descartarLeituraEmCurso();
    getSession.mockResolvedValueOnce({
      data: { session: sessaoDe('u1') },
      error: null,
    });
    await expect(lerSessao()).resolves.toEqual({
      session: sessaoDe('u1'),
      offline: false,
    });

    // A consulta velha terminando depois não apaga a vaga de ninguém.
    soltar({ data: { session: null }, error: semRede() });
    await act(0);
  });
});

/** Avança o relógio falso e drena as microtarefas no meio. */
async function act(ms: number) {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  jest.advanceTimersByTime(ms);
  for (let i = 0; i < 5; i++) await Promise.resolve();
}
