import { motoristaEdicaoSchema, motoristaSchema } from '../motorista';

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

describe('motoristaSchema: regra única de senha', () => {
  const base = {
    nome: 'Carlos Eduardo',
    email: 'carlos@example.com',
    telefone: '',
    senha: 'Abcdef1!',
  };

  it('recusa "123456" com a mensagem do passwordSchema (não a antiga de 6)', () => {
    const result = motoristaSchema.safeParse({ ...base, senha: '123456' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const mensagens = result.error.issues
      .filter((i) => i.path[0] === 'senha')
      .map((i) => i.message);
    expect(mensagens).toContain('Senha deve ter no mínimo 8 caracteres');
  });

  it('aceita telefone vazio (campo opcional do formulário chega como "")', () => {
    expect(motoristaSchema.safeParse(base).success).toBe(true);
  });

  it('recusa telefone incompleto', () => {
    const result = motoristaSchema.safeParse({
      ...base,
      telefone: '(11) 9999',
    });
    expect(result.success).toBe(false);
  });
});

describe('motoristaEdicaoSchema', () => {
  it('aceita sem senha e sem e-mail', () => {
    const result = motoristaEdicaoSchema.safeParse({
      nome: 'Carlos Eduardo',
      telefone: '(11) 99988-7766',
    });
    expect(result.success).toBe(true);
  });

  it('aceita telefone vazio', () => {
    expect(
      motoristaEdicaoSchema.safeParse({ nome: 'Carlos Eduardo', telefone: '' })
        .success,
    ).toBe(true);
  });

  it('continua exigindo nome válido', () => {
    expect(motoristaEdicaoSchema.safeParse({ nome: 'Ca' }).success).toBe(false);
  });
});
