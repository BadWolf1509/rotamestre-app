/**
 * AN7: ao conferir a senha atual (`signIn`) numa troca de senha, a falha tem
 * quatro leituras — e só uma delas é "senha incorreta". A tela do gestor dizia
 * "Senha atual incorreta" para QUALQUER falha (rede fora, servidor fora).
 */
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';

import { ContaDesativada } from '../contaAtiva';
import { FalhaAoCarregarPerfil } from '../falhaPerfil';
import { classificarFalhaSenhaAtual } from '../falhaSenhaAtual';

describe('classificarFalhaSenhaAtual', () => {
  it('credencial recusada (código do Supabase) é senha incorreta', () => {
    const f = classificarFalhaSenhaAtual(
      new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
    );
    expect(f?.tipo).toBe('incorreta');
    expect(f?.titulo).toBe('Senha atual incorreta');
  });

  it('credencial recusada sem código (resposta antiga) também é incorreta', () => {
    expect(
      classificarFalhaSenhaAtual(new Error('Invalid login credentials'))?.tipo,
    ).toBe('incorreta');
  });

  it.each([
    ['fetch repetível do supabase-js', new AuthRetryableFetchError('x', 0)],
    ['TypeError do fetch', new TypeError('Failed to fetch')],
    ['mensagem de rede', new Error('Network request failed')],
  ])('falta de rede (%s) nunca é "senha incorreta"', (_n, erro) => {
    const f = classificarFalhaSenhaAtual(erro);
    expect(f?.tipo).toBe('sem_rede');
    expect(f?.titulo).toBe('Sem conexão');
    expect(f?.mensagem).toMatch(/conferir sua senha atual/);
  });

  it.each([
    ['5xx do Auth', new AuthApiError('boom', 500, 'unexpected_failure')],
    ['limite de requisições', new AuthApiError('slow', 429, 'over_request_rate_limit')],
    ['erro qualquer', new Error('algo inesperado')],
    ['valor que nem é Error', 'falhou'],
  ])('erro do servidor (%s) não é "senha incorreta"', (_n, erro) => {
    const f = classificarFalhaSenhaAtual(erro);
    expect(f?.tipo).toBe('indisponivel');
    expect(f?.titulo).not.toBe('Senha atual incorreta');
  });

  it('conta desativada leva a mensagem própria', () => {
    const f = classificarFalhaSenhaAtual(new ContaDesativada());
    expect(f?.tipo).toBe('conta_desativada');
    expect(f?.mensagem).toBe('Sua conta está desativada. Fale com o gestor.');
  });

  // A senha foi ACEITA (sessão criada); só o perfil não carregou, e a troca
  // não depende dele. null = seguir com a troca.
  it('perfil não carregado depois da senha aceita não é falha: devolve null', () => {
    expect(
      classificarFalhaSenhaAtual(
        new FalhaAoCarregarPerfil('sem resposta', { transitoria: true }),
      ),
    ).toBeNull();
  });
});
