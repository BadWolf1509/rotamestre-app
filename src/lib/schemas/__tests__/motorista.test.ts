import { motoristaSchema } from '../motorista';

describe('motoristaSchema', () => {
  const validMotorista = {
    nome: 'Carlos Eduardo',
    email: 'carlos@example.com',
    telefone: '11999887766',
    senha: 'Abcdef1!',
  };

  it('accepts valid motorista data', () => {
    const result = motoristaSchema.safeParse(validMotorista);
    expect(result.success).toBe(true);
  });

  it('rejects nome with numbers (inherits nomeSchema)', () => {
    const result = motoristaSchema.safeParse({
      ...validMotorista,
      nome: 'Carlos 123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email (inherits emailSchema)', () => {
    const result = motoristaSchema.safeParse({
      ...validMotorista,
      email: 'not-email',
    });
    expect(result.success).toBe(false);
  });

  it('lowercases email', () => {
    const result = motoristaSchema.parse({
      ...validMotorista,
      email: 'CARLOS@EXAMPLE.COM',
    });
    expect(result.email).toBe('carlos@example.com');
  });

  it('accepts optional telefone (undefined)', () => {
    const { telefone: _tel, ...withoutPhone } = validMotorista;
    const result = motoristaSchema.safeParse(withoutPhone);
    expect(result.success).toBe(true);
  });

  it('rejects weak senha (no special char)', () => {
    const result = motoristaSchema.safeParse({
      ...validMotorista,
      senha: 'Abcdefg1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short senha', () => {
    const result = motoristaSchema.safeParse({
      ...validMotorista,
      senha: 'Ab1!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = motoristaSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
