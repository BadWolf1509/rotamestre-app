/**
 * R-NUC-2: uma fonte só para "isto é falha de rede?" — tabela com as formas
 * reais que cada runtime e biblioteca produz.
 */
import { AuthRetryableFetchError } from '@supabase/supabase-js';

import { ehFalhaDeRede, ehMensagemDeFalhaDeRede } from '../falhaDeRede';

const comNome = (nome: string, mensagem: string) => {
  const e = new Error(mensagem);
  e.name = nome;
  return e;
};

describe('ehMensagemDeFalhaDeRede', () => {
  it.each([
    'TypeError: Network request failed', // RN (postgrest-js monta assim)
    'Network request failed', // RN, fetch cru
    'TypeError: Failed to fetch', // Chrome
    'Load failed', // Safari
    'NetworkError when attempting to fetch resource.', // Firefox
    'Sem conexão com a internet',
    'connect ECONNREFUSED 127.0.0.1:54321',
    'Failed to send a request to the Edge Function', // FunctionsFetchError
  ])('rede: %s', (mensagem) => {
    expect(ehMensagemDeFalhaDeRede(mensagem)).toBe(true);
  });

  it.each([
    'JWT expired',
    'new row violates row-level security policy',
    'duplicate key value violates unique constraint',
    'timeout',
    'Cannot read properties of undefined (reading "fetch")',
    'prefetch de rotas falhou ao montar a lista',
    '',
  ])('não é rede: %j', (mensagem) => {
    expect(ehMensagemDeFalhaDeRede(mensagem)).toBe(false);
  });
});

describe('ehFalhaDeRede', () => {
  it('AuthRetryableFetchError (refresh do auth-js sem rede)', () => {
    expect(
      ehFalhaDeRede(new AuthRetryableFetchError('Failed to fetch', 0)),
    ).toBe(true);
  });

  it('FunctionsFetchError (Edge Function sem resposta)', () => {
    expect(
      ehFalhaDeRede(comNome('FunctionsFetchError', 'Failed to send a request')),
    ).toBe(true);
  });

  it('TypeError do fetch do RN', () => {
    expect(ehFalhaDeRede(new TypeError('Network request failed'))).toBe(true);
  });

  it('objeto do postgrest com a mensagem de rede', () => {
    expect(
      ehFalhaDeRede({ message: 'TypeError: Network request failed', code: '' }),
    ).toBe(true);
  });

  it.each([
    ['TypeError de programação', new TypeError('x is not a function')],
    ['sessão (PGRST301)', { code: 'PGRST301', message: 'JWT expired' }],
    ['nosso prazo do fetch', comNome('AbortError', 'timeout')],
    ['nulo', null],
    ['texto', 'qualquer coisa'],
  ])('não é rede: %s', (_nome, erro) => {
    expect(ehFalhaDeRede(erro)).toBe(false);
  });
});
