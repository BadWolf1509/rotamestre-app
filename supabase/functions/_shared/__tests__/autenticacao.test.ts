// `exigirUsuario` roda em Deno; a validação do JWT (supabase-js por esm.sh) é
// injetada, então aqui ela é uma função simples. O que importa provar: sem
// `Authorization: Bearer`, ou com JWT que o Auth não reconhece, ninguém passa —
// e a validação nem é chamada quando falta o cabeçalho. Com usuário válido a
// guarda devolve o próprio usuário (`{ usuario: { id } }`), para a função não
// precisar guardá-lo numa variável de fora da validação.
import {
  clienteDoUsuario,
  criarValidadorDeUsuario,
  exigirUsuario,
} from '../autenticacao';

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

const cors = { 'Access-Control-Allow-Origin': '*' };

function req(headers: Record<string, string> = {}): Request {
  return new Request('https://exemplo.test/fn', { method: 'POST', headers });
}

/** A recusa é uma Response 401; qualquer outra coisa falha o teste. */
function comoRecusa(resultado: unknown): Response {
  expect(resultado).toBeInstanceOf(Response);
  return resultado as Response;
}

describe('exigirUsuario', () => {
  it('recusa com 401 sem Authorization, sem chamar a validação', async () => {
    const validar = jest.fn();
    const resp = comoRecusa(await exigirUsuario(req(), validar, cors));
    expect(resp.status).toBe(401);
    expect(validar).not.toHaveBeenCalled();
  });

  it('recusa com 401 quando o Authorization não é Bearer', async () => {
    const validar = jest.fn();
    const resp = comoRecusa(
      await exigirUsuario(req({ Authorization: 'Basic abc' }), validar, cors),
    );
    expect(resp.status).toBe(401);
    expect(validar).not.toHaveBeenCalled();
  });

  it('recusa com 401 quando o JWT não corresponde a um usuário', async () => {
    const validar = jest.fn().mockResolvedValue(null);
    const resp = comoRecusa(
      await exigirUsuario(
        req({ Authorization: 'Bearer sb_publishable_xyz' }),
        validar,
        cors,
      ),
    );
    expect(resp.status).toBe(401);
    expect(validar).toHaveBeenCalledWith('Bearer sb_publishable_xyz');
  });

  it('recusa com 401 quando a validação lança, sem vazar a mensagem', async () => {
    const validar = jest
      .fn()
      .mockRejectedValue(new Error('detalhe interno do Auth'));
    const resp = comoRecusa(
      await exigirUsuario(req({ Authorization: 'Bearer x' }), validar, cors),
    );
    expect(resp.status).toBe(401);
    expect(await resp.text()).not.toContain('detalhe interno');
  });

  it('a resposta de recusa leva os cabeçalhos de CORS', async () => {
    const resp = comoRecusa(await exigirUsuario(req(), jest.fn(), cors));
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('devolve o usuário (id) quando a validação o reconhece', async () => {
    const validar = jest.fn().mockResolvedValue({ id: 'u-1' });
    const resultado = await exigirUsuario(
      req({ Authorization: 'Bearer jwt.do.usuario' }),
      validar,
      cors,
    );
    expect(resultado).toEqual({ usuario: { id: 'u-1' } });
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
      data: { user: { id: 'u', email: 'x@example.invalid' } },
      error: null,
    });
    const validar = criarValidadorDeUsuario(
      createClient,
      'https://p',
      () => 'sb_publishable_x',
    );
    // Só o id sai da validação.
    await expect(validar('Bearer t')).resolves.toEqual({ id: 'u' });
    expect(createClient).toHaveBeenCalledWith(
      'https://p',
      'sb_publishable_x',
      expect.objectContaining({
        global: { headers: { Authorization: 'Bearer t' } },
      }),
    );
  });

  it('recusa quando o getUser devolve erro, nenhum usuário ou usuário sem id', async () => {
    const semUsuario = clienteCom({ data: { user: null }, error: null });
    const comErro = clienteCom({
      data: { user: { id: 'u' } },
      error: { message: 'x' },
    });
    const semId = clienteCom({ data: { user: { email: 'x' } }, error: null });
    for (const { createClient } of [semUsuario, comErro, semId]) {
      await expect(
        criarValidadorDeUsuario(createClient, 'u', () => 'k')('Bearer t'),
      ).resolves.toBeNull();
    }
  });
});

describe('clienteDoUsuario', () => {
  const ambiente: Record<string, string | undefined> = {};
  let denoAntes: unknown;

  beforeAll(() => {
    denoAntes = (globalThis as { Deno?: unknown }).Deno;
    (globalThis as { Deno?: unknown }).Deno = {
      env: { get: (nome: string) => ambiente[nome] },
    };
  });

  afterAll(() => {
    (globalThis as { Deno?: unknown }).Deno = denoAntes;
  });

  it('cria o cliente com a chave publicável, o Authorization recebido e sem sessão persistida', () => {
    ambiente.SUPABASE_PUBLISHABLE_KEYS = JSON.stringify({
      default: 'sb_publishable_padrao',
    });
    const cliente = { marca: 'cliente' };
    const createClient = jest.fn(() => cliente);
    expect(
      clienteDoUsuario(createClient, 'https://p', 'Bearer jwt.do.usuario'),
    ).toBe(cliente);
    expect(createClient).toHaveBeenCalledWith(
      'https://p',
      'sb_publishable_padrao',
      {
        global: { headers: { Authorization: 'Bearer jwt.do.usuario' } },
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
  });

  it('aceita outra fonte da chave (o validador injeta a dele)', () => {
    const createClient = jest.fn(() => ({}));
    clienteDoUsuario(createClient, 'https://p', 'Bearer t', () => 'k');
    expect(createClient).toHaveBeenCalledWith(
      'https://p',
      'k',
      expect.objectContaining({
        global: { headers: { Authorization: 'Bearer t' } },
      }),
    );
  });
});
