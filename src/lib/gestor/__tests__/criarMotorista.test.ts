import {
  chamarCriarMotorista,
  MSG_FALHA_CRIAR,
  MSG_SEM_CONEXAO,
  MSG_SESSAO_EXPIRADA,
} from '../criarMotorista';

const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => mockInvoke(...a) } },
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const dados = {
  nome: 'Ana',
  email: 'ana@x.com',
  senha: 'senha123',
  telefone: null,
  unidade_id: 'loja-1',
};

function erroHttp(status: number, corpo: string) {
  return Object.assign(new Error('non-2xx'), {
    name: 'FunctionsHttpError',
    context: new Response(corpo, { status }),
  });
}

beforeEach(() => jest.clearAllMocks());

describe('chamarCriarMotorista (B-GES-7 / R-DB-6)', () => {
  it('chama pelo cliente do Supabase (que aplica o prazo), não por fetch cru', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

    const r = await chamarCriarMotorista(dados);

    expect(r).toEqual({ ok: true });
    expect(mockInvoke).toHaveBeenCalledWith('criar-motorista', {
      method: 'POST',
      body: dados,
    });
  });

  it('409 com texto da função: devolve o texto', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: erroHttp(409, JSON.stringify({ error: 'E-mail já tem conta.' })),
    });
    expect(await chamarCriarMotorista(dados)).toEqual({
      ok: false,
      mensagem: 'E-mail já tem conta.',
    });
  });

  it('401 sem texto: sessão expirada', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: erroHttp(401, '{}') });
    expect(await chamarCriarMotorista(dados)).toEqual({
      ok: false,
      mensagem: MSG_SESSAO_EXPIRADA,
    });
  });

  it('500 sem texto: mensagem genérica', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: erroHttp(500, '{}') });
    expect(await chamarCriarMotorista(dados)).toEqual({
      ok: false,
      mensagem: MSG_FALHA_CRIAR,
    });
  });

  it('FunctionsFetchError (rede/prazo): sem conexão', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error('Failed to send'), {
        name: 'FunctionsFetchError',
      }),
    });
    expect(await chamarCriarMotorista(dados)).toEqual({
      ok: false,
      mensagem: MSG_SEM_CONEXAO,
    });
  });

  it('exceção de rede vira sem conexão; outra, a genérica', async () => {
    mockInvoke.mockRejectedValueOnce(new TypeError('Network request failed'));
    expect((await chamarCriarMotorista(dados)).ok).toBe(false);
    mockInvoke.mockRejectedValueOnce(new TypeError('Network request failed'));
    expect(await chamarCriarMotorista(dados)).toEqual({
      ok: false,
      mensagem: MSG_SEM_CONEXAO,
    });
    mockInvoke.mockRejectedValueOnce(new Error('algo estranho'));
    expect(await chamarCriarMotorista(dados)).toEqual({
      ok: false,
      mensagem: MSG_FALHA_CRIAR,
    });
  });

  it('2xx sem corpo: a função respondeu, o motorista foi criado', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    expect(await chamarCriarMotorista(dados)).toEqual({ ok: true });
  });

  it('2xx com corpo que não é JSON: falha genérica', async () => {
    mockInvoke.mockResolvedValue({ data: '<html>502</html>', error: null });
    expect(await chamarCriarMotorista(dados)).toEqual({
      ok: false,
      mensagem: MSG_FALHA_CRIAR,
    });
  });
});
