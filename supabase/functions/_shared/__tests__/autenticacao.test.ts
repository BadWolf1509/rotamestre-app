// `exigirUsuario` roda em Deno; a validação do JWT (supabase-js por esm.sh) é
// injetada, então aqui ela é uma função simples. O que importa provar: sem
// `Authorization: Bearer`, ou com JWT que o Auth não reconhece, ninguém passa —
// e a validação nem é chamada quando falta o cabeçalho.
import { criarValidadorDeUsuario, exigirUsuario } from '../autenticacao';

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

const cors = { 'Access-Control-Allow-Origin': '*' };

function req(headers: Record<string, string> = {}): Request {
  return new Request('https://exemplo.test/fn', { method: 'POST', headers });
}

describe('exigirUsuario', () => {
  it('recusa com 401 sem Authorization, sem chamar a validação', async () => {
    const validar = jest.fn();
    const resp = await exigirUsuario(req(), validar, cors);
    expect(resp?.status).toBe(401);
    expect(validar).not.toHaveBeenCalled();
  });

  it('recusa com 401 quando o Authorization não é Bearer', async () => {
    const validar = jest.fn();
    const resp = await exigirUsuario(
      req({ Authorization: 'Basic abc' }),
      validar,
      cors,
    );
    expect(resp?.status).toBe(401);
    expect(validar).not.toHaveBeenCalled();
  });

  it('recusa com 401 quando o JWT não corresponde a um usuário', async () => {
    const validar = jest.fn().mockResolvedValue(false);
    const resp = await exigirUsuario(
      req({ Authorization: 'Bearer sb_publishable_xyz' }),
      validar,
      cors,
    );
    expect(resp?.status).toBe(401);
    expect(validar).toHaveBeenCalledWith('Bearer sb_publishable_xyz');
  });

  it('recusa com 401 quando a validação lança, sem vazar a mensagem', async () => {
    const validar = jest
      .fn()
      .mockRejectedValue(new Error('detalhe interno do Auth'));
    const resp = await exigirUsuario(
      req({ Authorization: 'Bearer x' }),
      validar,
      cors,
    );
    expect(resp?.status).toBe(401);
    expect(await resp?.text()).not.toContain('detalhe interno');
  });

  it('a resposta de recusa leva os cabeçalhos de CORS', async () => {
    const resp = await exigirUsuario(req(), jest.fn(), cors);
    expect(resp?.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('deixa passar (null) com usuário válido', async () => {
    const validar = jest.fn().mockResolvedValue(true);
    const resp = await exigirUsuario(
      req({ Authorization: 'Bearer jwt.do.usuario' }),
      validar,
      cors,
    );
    expect(resp).toBeNull();
  });
});

describe('criarValidadorDeUsuario', () => {
  const clienteCom = (resposta: {
    data: { user: unknown };
    error: unknown;
  }) => {
    const getUser = jest.fn().mockResolvedValue(resposta);
    const createClient = jest.fn(() => ({ auth: { getUser } }));
    return { createClient, getUser };
  };

  it('cria o cliente com a chave publicável e o Authorization recebido', async () => {
    const { createClient } = clienteCom({
      data: { user: { id: 'u' } },
      error: null,
    });
    const validar = criarValidadorDeUsuario(
      createClient,
      'https://p',
      () => 'sb_publishable_x',
    );
    await expect(validar('Bearer t')).resolves.toBe(true);
    expect(createClient).toHaveBeenCalledWith(
      'https://p',
      'sb_publishable_x',
      expect.objectContaining({
        global: { headers: { Authorization: 'Bearer t' } },
      }),
    );
  });

  it('recusa quando o getUser devolve erro ou nenhum usuário', async () => {
    const semUsuario = clienteCom({ data: { user: null }, error: null });
    const comErro = clienteCom({
      data: { user: { id: 'u' } },
      error: { message: 'x' },
    });
    await expect(
      criarValidadorDeUsuario(
        semUsuario.createClient,
        'u',
        () => 'k',
      )('Bearer t'),
    ).resolves.toBe(false);
    await expect(
      criarValidadorDeUsuario(comErro.createClient, 'u', () => 'k')('Bearer t'),
    ).resolves.toBe(false);
  });
});
