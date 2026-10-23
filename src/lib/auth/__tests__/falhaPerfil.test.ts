import { AuthRetryableFetchError } from '@supabase/supabase-js';

import { classificarFalhaPerfil, FalhaAoCarregarPerfil } from '../falhaPerfil';

/**
 * Só a falha SEM resposta útil (rede, timeout, 5xx, token vencido) deixa o
 * perfil conhecido responder. 4xx de schema/permissão é defeito de verdade:
 * entrar com o perfil velho o esconderia para sempre.
 */
describe('classificarFalhaPerfil', () => {
  const postgrest = (code = '') => ({
    message: 'x',
    details: '',
    hint: '',
    code,
  });

  it.each([
    ['sem resposta (status 0, falha do fetch)', postgrest(), 0],
    ['timeout (408)', postgrest(), 408],
    ['limite de requisições (429)', postgrest(), 429],
    ['token vencido (401)', postgrest(), 401],
    ['JWT expirado (PGRST301)', postgrest('PGRST301'), 401],
    ['erro do servidor (500)', postgrest(), 500],
    ['indisponível (503)', postgrest(), 503],
  ])('%s é transitória', (_nome, erro, status) => {
    const falha = classificarFalhaPerfil(erro, status);
    expect(falha).toBeInstanceOf(FalhaAoCarregarPerfil);
    expect(falha.transitoria).toBe(true);
    expect(falha.status).toBe(status);
  });

  it.each([
    ['coluna inexistente (400)', postgrest('42703'), 400],
    ['permissão negada (42501)', postgrest('42501'), 403],
    ['não aceitável (406)', postgrest('PGRST116'), 406],
  ])('%s NÃO é transitória', (_nome, erro, status) => {
    const falha = classificarFalhaPerfil(erro, status);
    expect(falha.transitoria).toBe(false);
    expect(falha.code).toBe(erro.code);
  });

  it('refresh de sessão sem rede (AuthRetryableFetchError) é transitória', () => {
    expect(
      classificarFalhaPerfil(new AuthRetryableFetchError('Failed to fetch', 0))
        .transitoria,
    ).toBe(true);
  });

  it('exceção do fetch (TypeError) é transitória', () => {
    expect(
      classificarFalhaPerfil(new TypeError('Network request failed'))
        .transitoria,
    ).toBe(true);
  });

  it('erro qualquer sem status é tratado como defeito, não como rede', () => {
    expect(classificarFalhaPerfil(new Error('boom')).transitoria).toBe(false);
  });

  it('uma falha já classificada passa direto', () => {
    const falha = new FalhaAoCarregarPerfil('sem sessão', {
      transitoria: true,
    });
    expect(classificarFalhaPerfil(falha)).toBe(falha);
  });
});
