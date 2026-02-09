import { loginSchema, registerSchema } from '../auth';

// ============================================================================
// loginSchema
// ============================================================================

describe('loginSchema', () => {
  it('accepts valid login data', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'anypassword',
    });
    expect(result.success).toBe(true);
  });

  it('lowercases email', () => {
    const result = loginSchema.parse({
      email: 'USER@EXAMPLE.COM',
      password: '123',
    });
    expect(result.email).toBe('user@example.com');
  });

  it('rejects missing email', () => {
    const result = loginSchema.safeParse({ password: '123' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-email',
      password: '123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Senha é obrigatória');
    }
  });

  it('accepts any non-empty password (no strength check)', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'a',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// registerSchema
// ============================================================================

describe('registerSchema', () => {
  const validData = {
    nome: 'João Silva',
    email: 'joao@example.com',
    password: 'Abcdef1!',
    confirmPassword: 'Abcdef1!',
    tipo: 'gestor' as const,
  };

  it('accepts valid registration data', () => {
    const result = registerSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('accepts tipo "motorista"', () => {
    const result = registerSchema.safeParse({ ...validData, tipo: 'motorista' });
    expect(result.success).toBe(true);
  });

  it('rejects password mismatch', () => {
    const result = registerSchema.safeParse({
      ...validData,
      confirmPassword: 'DifferentPass1!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const pathIssue = result.error.issues.find(
        (i) => i.path.includes('confirmPassword'),
      );
      expect(pathIssue?.message).toBe('As senhas não coincidem');
    }
  });

  it('rejects invalid tipo', () => {
    const result = registerSchema.safeParse({ ...validData, tipo: 'admin' });
    expect(result.success).toBe(false);
  });

  it('rejects weak password (no uppercase)', () => {
    const result = registerSchema.safeParse({
      ...validData,
      password: 'abcdef1!',
      confirmPassword: 'abcdef1!',
    });
    expect(result.success).toBe(false);
  });

  it('inherits nomeSchema validation (rejects numbers)', () => {
    const result = registerSchema.safeParse({ ...validData, nome: 'João 123' });
    expect(result.success).toBe(false);
  });

  it('inherits emailSchema validation', () => {
    const result = registerSchema.safeParse({ ...validData, email: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = registerSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects short nome', () => {
    const result = registerSchema.safeParse({ ...validData, nome: 'AB' });
    expect(result.success).toBe(false);
  });

  it('lowercases email in register', () => {
    const result = registerSchema.parse({
      ...validData,
      email: 'JOAO@EXAMPLE.COM',
    });
    expect(result.email).toBe('joao@example.com');
  });

  it('password match check uses exact match (case-sensitive)', () => {
    const result = registerSchema.safeParse({
      ...validData,
      password: 'Abcdef1!',
      confirmPassword: 'abcdef1!',
    });
    expect(result.success).toBe(false);
  });
});
