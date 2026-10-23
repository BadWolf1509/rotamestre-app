import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

import { FalhaAoCarregarPerfil } from '../falhaPerfil';
import { exigirSessaoDe, lerSessao } from '../sessao';

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
