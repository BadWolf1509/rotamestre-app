import {
  CODIGO_TELEFONE_JA_CADASTRADO,
  ehViolacaoTelefoneUnico,
  respostaTelefoneDuplicado,
} from '../telefoneDuplicado';

const OUTRA_LOJA =
  'Este motorista já usa o RotaMestre em outra loja. Para usar o mesmo motorista em mais de uma loja, fale com o suporte.';
const MESMA_LOJA = 'Já existe um motorista com este telefone na sua loja.';

describe('respostaTelefoneDuplicado', () => {
  it('devolve null quando nada foi encontrado', () => {
    expect(respostaTelefoneDuplicado([], 'u1', {})).toBeNull();
  });

  it('avisa "outra loja" quando o motorista é de outra unidade', () => {
    expect(
      respostaTelefoneDuplicado([{ id: 'm1', unidade_id: 'u2' }], 'u1', {}),
    ).toEqual({
      status: 409,
      error: OUTRA_LOJA,
      codigo: CODIGO_TELEFONE_JA_CADASTRADO,
    });
  });

  it('avisa "mesma loja" quando unidade_id é a do gestor', () => {
    const r = respostaTelefoneDuplicado(
      [{ id: 'm1', unidade_id: 'u1' }],
      'u1',
      {},
    );
    expect(r?.error).toBe(MESMA_LOJA);
    expect(r?.status).toBe(409);
  });

  it('avisa "mesma loja" quando o vínculo ativo é com a unidade do gestor', () => {
    const r = respostaTelefoneDuplicado(
      [{ id: 'm1', unidade_id: 'u2' }],
      'u1',
      {
        m1: ['u2', 'u1'],
      },
    );
    expect(r?.error).toBe(MESMA_LOJA);
  });

  it('avisa "mesma loja" quando qualquer um de vários encontrados é da unidade do gestor', () => {
    const r = respostaTelefoneDuplicado(
      [
        { id: 'm1', unidade_id: 'u2' },
        { id: 'm2', unidade_id: 'u1' },
      ],
      'u1',
      {},
    );
    expect(r?.error).toBe(MESMA_LOJA);
  });

  it('tolera unidade_id nulo', () => {
    const r = respostaTelefoneDuplicado(
      [{ id: 'm1', unidade_id: null }],
      'u1',
      {},
    );
    expect(r?.error).toBe(OUTRA_LOJA);
  });
});

describe('ehViolacaoTelefoneUnico', () => {
  it('true para 23505 do índice de telefone', () => {
    expect(
      ehViolacaoTelefoneUnico({
        code: '23505',
        message:
          'duplicate key value violates unique constraint "usuarios_motorista_telefone_unico"',
      }),
    ).toBe(true);
  });

  it('false para outro índice, outro código ou nulo', () => {
    expect(
      ehViolacaoTelefoneUnico({
        code: '23505',
        message: 'violates "usuarios_email_key"',
      }),
    ).toBe(false);
    expect(
      ehViolacaoTelefoneUnico({
        code: '23503',
        message: 'usuarios_motorista_telefone_unico',
      }),
    ).toBe(false);
    expect(ehViolacaoTelefoneUnico(null)).toBe(false);
  });
});
