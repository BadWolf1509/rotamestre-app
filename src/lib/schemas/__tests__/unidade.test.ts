import { unidadeSchema } from '../unidade';

const VALIDA = {
  nome: 'Loja Centro',
  telefone: '(83) 99999-8888',
  endereco: 'Rua Um, 100',
  cidade: 'João Pessoa',
  estado: 'PB',
  cep: '58039-000',
};

function errosDe(dados: Partial<typeof VALIDA>) {
  const resultado = unidadeSchema.safeParse({ ...VALIDA, ...dados });
  if (resultado.success) return {};
  return Object.fromEntries(
    resultado.error.issues.map((issue) => [issue.path[0], issue.message]),
  );
}

describe('unidadeSchema (Minha Unidade)', () => {
  it('aceita a ficha completa e válida', () => {
    expect(unidadeSchema.safeParse(VALIDA).success).toBe(true);
  });

  it('aceita telefone, CEP, UF, cidade e endereço vazios', () => {
    expect(
      unidadeSchema.safeParse({
        nome: 'Loja Centro',
        telefone: '',
        endereco: '',
        cidade: '',
        estado: '',
        cep: '',
      }).success,
    ).toBe(true);
  });

  it('exige o nome', () => {
    expect(errosDe({ nome: '   ' }).nome).toBe('Informe o nome da unidade');
  });

  it('recusa CEP com menos de 8 dígitos', () => {
    expect(errosDe({ cep: '1234' }).cep).toBe('CEP deve ter 8 dígitos');
  });

  it('recusa UF que não é sigla de estado', () => {
    expect(errosDe({ estado: 'XX' }).estado).toBe('UF inválida');
  });

  it('aceita a sigla em minúsculas (o teclado da web não força caixa)', () => {
    expect(errosDe({ estado: 'pb' }).estado).toBeUndefined();
  });

  it('recusa telefone curto com a mensagem do phoneSchema', () => {
    expect(errosDe({ telefone: '123' }).telefone).toBe(
      'Telefone deve ter 10 ou 11 dígitos',
    );
  });
});
