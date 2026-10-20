import { mensagemRegraDoBanco } from '../mensagemRegraDoBanco';

describe('mensagemRegraDoBanco', () => {
  it('devolve a frase de regra de negócio (P0001) como o banco escreveu', () => {
    expect(
      mensagemRegraDoBanco({
        code: 'P0001',
        message: 'Motorista não encontrado nesta loja.',
      }),
    ).toBe('Motorista não encontrado nesta loja.');
  });

  it('ignora outros códigos e formatos', () => {
    expect(
      mensagemRegraDoBanco({ code: '42501', message: 'permission denied' }),
    ).toBeNull();
    expect(mensagemRegraDoBanco(new Error('P0001'))).toBeNull();
    expect(mensagemRegraDoBanco(null)).toBeNull();
    expect(mensagemRegraDoBanco({ code: 'P0001' })).toBeNull();
  });
});
