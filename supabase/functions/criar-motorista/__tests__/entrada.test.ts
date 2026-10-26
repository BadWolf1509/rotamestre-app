import {
  decidirPermissao,
  MSG_CORPO_INVALIDO,
  MSG_OBRIGATORIOS,
  msgCampoInvalido,
  validarCorpo,
} from '../entrada';

const UID = '11111111-2222-3333-4444-555555555555';
const base = {
  nome: 'Ana',
  email: 'a@x.com',
  senha: 'segredo1',
  telefone: '(83) 99999-0000',
  unidade_id: UID,
};

describe('validarCorpo', () => {
  it('aceita o corpo que o app manda', () => {
    expect(validarCorpo(base)).toEqual({
      ok: true,
      dados: {
        nome: 'Ana',
        email: 'a@x.com',
        senha: 'segredo1',
        telefone: '(83) 99999-0000',
        unidadeId: UID,
      },
    });
  });

  it('telefone e unidade_id ausentes viram null (app antigo)', () => {
    const { telefone: _t, unidade_id: _u, ...semOpcionais } = base;
    expect(validarCorpo(semOpcionais)).toEqual({
      ok: true,
      dados: {
        nome: 'Ana',
        email: 'a@x.com',
        senha: 'segredo1',
        telefone: null,
        unidadeId: null,
      },
    });
    const comNulls = validarCorpo({ ...base, telefone: null, unidade_id: null });
    expect(comNulls).toMatchObject({
      ok: true,
      dados: { telefone: null, unidadeId: null },
    });
  });

  it('telefone só com espaços vira null e o preenchido sai com trim', () => {
    expect(validarCorpo({ ...base, telefone: '   ' })).toMatchObject({
      ok: true,
      dados: { telefone: null },
    });
    expect(validarCorpo({ ...base, telefone: ' 8399 ' })).toMatchObject({
      ok: true,
      dados: { telefone: '8399' },
    });
  });

  it('devolve nome, email e senha sem trim', () => {
    expect(
      validarCorpo({ ...base, nome: ' Ana ', email: ' A@x.com ', senha: ' s ' }),
    ).toMatchObject({
      ok: true,
      dados: { nome: ' Ana ', email: ' A@x.com ', senha: ' s ' },
    });
  });

  it('aceita uuid em maiúsculas', () => {
    const maiusculo = UID.toUpperCase();
    expect(validarCorpo({ ...base, unidade_id: maiusculo })).toMatchObject({
      ok: true,
      dados: { unidadeId: maiusculo },
    });
  });

  it('recusa corpo que não é objeto', () => {
    for (const c of [null, 'x', 1, [], undefined]) {
      expect(validarCorpo(c)).toEqual({
        ok: false,
        status: 400,
        error: MSG_CORPO_INVALIDO,
      });
    }
  });

  it('obrigatório ausente, nulo ou vazio', () => {
    const esperado = { ok: false, status: 400, error: MSG_OBRIGATORIOS };
    expect(validarCorpo({ ...base, senha: '  ' })).toEqual(esperado);
    expect(validarCorpo({ ...base, nome: null })).toEqual(esperado);
    expect(validarCorpo({ ...base, email: undefined })).toEqual(esperado);
  });

  it('recusa nome, email ou senha que não são texto, dizendo o campo', () => {
    expect(validarCorpo({ ...base, senha: 123 })).toEqual({
      ok: false,
      status: 400,
      error: 'Campo inválido: senha.',
    });
    expect(validarCorpo({ ...base, nome: { a: 1 } })).toEqual({
      ok: false,
      status: 400,
      error: msgCampoInvalido('nome'),
    });
  });

  it('recusa unidade_id que não é uuid', () => {
    for (const v of ['abc', 123, {}]) {
      expect(validarCorpo({ ...base, unidade_id: v })).toEqual({
        ok: false,
        status: 400,
        error: 'Campo inválido: unidade_id.',
      });
    }
  });

  it('recusa telefone que não é texto', () => {
    expect(validarCorpo({ ...base, telefone: 8399 })).toEqual({
      ok: false,
      status: 400,
      error: 'Campo inválido: telefone.',
    });
  });
});

describe('decidirPermissao', () => {
  const gestorOk = { papel: 'gestor', ativo: true };
  const ok = {
    erroGestor: null,
    gestor: gestorOk,
    unidadeId: UID,
    erroVinculo: null,
    vinculo: { id: 'v1' },
  };

  it('falha na consulta do vínculo é indisponível, não proibido', () => {
    expect(
      decidirPermissao({ ...ok, erroVinculo: { code: '57014' }, vinculo: null }),
    ).toBe('indisponivel');
  });

  it('falha na consulta do gestor é indisponível', () => {
    expect(
      decidirPermissao({ ...ok, erroGestor: { code: '08006' }, gestor: null }),
    ).toBe('indisponivel');
  });

  it('sem perfil (PGRST116) é proibido', () => {
    expect(
      decidirPermissao({ ...ok, erroGestor: { code: 'PGRST116' }, gestor: null }),
    ).toBe('proibido');
  });

  it('motorista, gestor inativo, sem loja ou sem vínculo é proibido', () => {
    expect(
      decidirPermissao({ ...ok, gestor: { papel: 'motorista', ativo: true } }),
    ).toBe('proibido');
    expect(
      decidirPermissao({ ...ok, gestor: { papel: 'gestor', ativo: false } }),
    ).toBe('proibido');
    expect(decidirPermissao({ ...ok, gestor: null })).toBe('proibido');
    expect(decidirPermissao({ ...ok, unidadeId: null })).toBe('proibido');
    expect(decidirPermissao({ ...ok, vinculo: null })).toBe('proibido');
  });

  it('gestor ativo com vínculo é ok', () => {
    expect(decidirPermissao(ok)).toBe('ok');
  });
});
