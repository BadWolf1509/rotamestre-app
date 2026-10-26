import { perfilMotoristaSchema } from '../perfilMotorista';

describe('perfilMotoristaSchema', () => {
  it('aceita nome e telefone celular ou fixo mascarados', () => {
    expect(
      perfilMotoristaSchema.safeParse({
        nome: 'João',
        telefone: '(11) 99999-9999',
      }).success,
    ).toBe(true);
    expect(
      perfilMotoristaSchema.safeParse({
        nome: 'João',
        telefone: '(11) 3999-9999',
      }).success,
    ).toBe(true);
  });

  it('aceita telefone vazio (campo opcional)', () => {
    expect(
      perfilMotoristaSchema.safeParse({ nome: 'João', telefone: '' }).success,
    ).toBe(true);
  });

  it('recusa nome vazio ou só com espaços', () => {
    for (const nome of ['', '   ']) {
      const r = perfilMotoristaSchema.safeParse({ nome, telefone: '' });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe('O nome é obrigatório.');
      }
    }
  });

  it('recusa telefone incompleto ou fora do formato', () => {
    for (const telefone of ['(11) 9999', '11999999999', '(11) 99999-99']) {
      const r = perfilMotoristaSchema.safeParse({ nome: 'João', telefone });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe(
          'Use o formato (11) 99999-9999.',
        );
      }
    }
  });
});
