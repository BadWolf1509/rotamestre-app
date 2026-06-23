import {
  emailSchema,
  passwordSchema,
  nomeSchema,
  enderecoSchema,
  observacoesSchema,
  coordenadasSchema,
  validatePassword,
  isValidCoordinates,
  isValidEmail,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
} from '../basic';

// ============================================================================
// CONSTANTS
// ============================================================================

describe('constants', () => {
  it('PASSWORD_MIN_LENGTH is 8', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });

  it('PASSWORD_REQUIREMENTS has correct shape', () => {
    expect(PASSWORD_REQUIREMENTS).toEqual({
      minLength: 8,
      requireUppercase: true,
      requireNumber: true,
      requireSpecial: true,
    });
  });
});

// ============================================================================
// emailSchema
// ============================================================================

describe('emailSchema', () => {
  it('accepts valid email', () => {
    expect(emailSchema.parse('user@example.com')).toBe('user@example.com');
  });

  it('converts to lowercase', () => {
    expect(emailSchema.parse('User@Example.COM')).toBe('user@example.com');
  });

  it('trims leading/trailing spaces before validating', () => {
    expect(emailSchema.parse('  user@example.com  ')).toBe('user@example.com');
  });

  it('rejects empty string', () => {
    const result = emailSchema.safeParse('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('E-mail é obrigatório');
    }
  });

  it('rejects invalid format — missing @', () => {
    const result = emailSchema.safeParse('userexample.com');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('E-mail inválido');
    }
  });

  it('rejects invalid format — missing domain', () => {
    expect(emailSchema.safeParse('user@').success).toBe(false);
  });

  it('rejects invalid format — missing user', () => {
    expect(emailSchema.safeParse('@example.com').success).toBe(false);
  });
});

// ============================================================================
// passwordSchema
// ============================================================================

describe('passwordSchema', () => {
  it('accepts strong password', () => {
    const result = passwordSchema.safeParse('Abc123!@');
    expect(result.success).toBe(true);
  });

  it('rejects short password', () => {
    const result = passwordSchema.safeParse('Ab1!');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('8 caracteres');
    }
  });

  it('rejects password without uppercase', () => {
    const result = passwordSchema.safeParse('abc12345!');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes('maiúscula')),
      ).toBe(true);
    }
  });

  it('rejects password without number', () => {
    const result = passwordSchema.safeParse('Abcdefgh!');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes('número')),
      ).toBe(true);
    }
  });

  it('rejects password without special character', () => {
    const result = passwordSchema.safeParse('Abcdefg1');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes('especial')),
      ).toBe(true);
    }
  });

  it('accepts password with exactly 8 characters', () => {
    expect(passwordSchema.safeParse('Abcdef1!').success).toBe(true);
  });

  it('accepts password with various special characters', () => {
    expect(passwordSchema.safeParse('Abcdef1@').success).toBe(true);
    expect(passwordSchema.safeParse('Abcdef1#').success).toBe(true);
    expect(passwordSchema.safeParse('Abcdef1_').success).toBe(true);
    expect(passwordSchema.safeParse('Abcdef1-').success).toBe(true);
  });

  it('rejects password that only has lowercase + length', () => {
    const result = passwordSchema.safeParse('abcdefghij');
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// validatePassword
// ============================================================================

describe('validatePassword', () => {
  it('returns valid=true for strong password', () => {
    const result = validatePassword('Abc123!@');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid=false for empty string', () => {
    const result = validatePassword('');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('collects all errors for bad password', () => {
    const result = validatePassword('ab');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Mínimo 8 caracteres');
    expect(result.errors).toContain('Precisa de letra maiúscula');
    expect(result.errors).toContain('Precisa de número');
    expect(result.errors).toContain('Precisa de caractere especial (!@#$%...)');
  });

  it('returns strength "weak" for 2 or fewer criteria met', () => {
    // Only lowercase + short → score 1 (hasLower)
    const result = validatePassword('abc');
    expect(result.strength).toBe('weak');
  });

  it('returns strength "medium" for 3 criteria met', () => {
    // lowercase + uppercase + number (8 chars but <12) → score 3
    const result = validatePassword('Abcdefg1');
    expect(result.strength).toBe('medium');
  });

  it('returns strength "strong" for 4+ criteria met', () => {
    // lowercase + uppercase + number + special → score 4
    const result = validatePassword('Abcdef1!');
    expect(result.strength).toBe('strong');
  });

  it('returns strength "strong" for long password with all criteria', () => {
    // lowercase + uppercase + number + special + long(12+) → score 5
    const result = validatePassword('Abcdefghij1!');
    expect(result.strength).toBe('strong');
  });

  it('length >= 12 adds to score (isLong)', () => {
    // lowercase + uppercase + isLong → score 3 = medium
    const result = validatePassword('Abcdefghijkl');
    expect(result.strength).toBe('medium');
  });

  it('error for missing uppercase', () => {
    const result = validatePassword('abcdef1!');
    expect(result.errors).toContain('Precisa de letra maiúscula');
  });

  it('error for missing number', () => {
    const result = validatePassword('Abcdefg!');
    expect(result.errors).toContain('Precisa de número');
  });

  it('error for missing special char', () => {
    const result = validatePassword('Abcdefg1');
    expect(result.errors).toContain('Precisa de caractere especial (!@#$%...)');
  });

  it('error for too short', () => {
    const result = validatePassword('Ab1!');
    expect(result.errors).toContain('Mínimo 8 caracteres');
  });
});

// ============================================================================
// nomeSchema
// ============================================================================

describe('nomeSchema', () => {
  it('accepts valid name', () => {
    expect(nomeSchema.parse('João Silva')).toBe('João Silva');
  });

  it('accepts accented characters', () => {
    expect(nomeSchema.parse('José André Ñ')).toBe('José André Ñ');
  });

  it('trims whitespace', () => {
    expect(nomeSchema.parse('  Ana Maria  ')).toBe('Ana Maria');
  });

  it('rejects name shorter than 3 chars', () => {
    const result = nomeSchema.safeParse('AB');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('3 caracteres');
    }
  });

  it('accepts name with exactly 3 chars', () => {
    expect(nomeSchema.safeParse('Ana').success).toBe(true);
  });

  it('rejects name longer than 100 chars', () => {
    const longName = 'A'.repeat(101);
    expect(nomeSchema.safeParse(longName).success).toBe(false);
  });

  it('accepts name with exactly 100 chars', () => {
    const name100 = 'A'.repeat(100);
    expect(nomeSchema.safeParse(name100).success).toBe(true);
  });

  it('rejects name with numbers', () => {
    const result = nomeSchema.safeParse('João 123');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes('apenas letras')),
      ).toBe(true);
    }
  });

  it('rejects name with special characters', () => {
    expect(nomeSchema.safeParse('João@Silva').success).toBe(false);
  });
});

// ============================================================================
// enderecoSchema
// ============================================================================

describe('enderecoSchema', () => {
  it('accepts valid address', () => {
    expect(enderecoSchema.parse('Rua das Flores, 123')).toBe(
      'Rua das Flores, 123',
    );
  });

  it('trims whitespace', () => {
    expect(enderecoSchema.parse('  Rua A, 1  ')).toBe('Rua A, 1');
  });

  it('rejects address shorter than 5 chars', () => {
    const result = enderecoSchema.safeParse('Rua');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('5 caracteres');
    }
  });

  it('accepts address with exactly 5 chars', () => {
    expect(enderecoSchema.safeParse('Rua A').success).toBe(true);
  });

  it('rejects address longer than 200 chars', () => {
    const longAddr = 'A'.repeat(201);
    expect(enderecoSchema.safeParse(longAddr).success).toBe(false);
  });

  it('accepts address with exactly 200 chars', () => {
    expect(enderecoSchema.safeParse('A'.repeat(200)).success).toBe(true);
  });
});

// ============================================================================
// observacoesSchema
// ============================================================================

describe('observacoesSchema', () => {
  it('accepts valid observation', () => {
    const result = observacoesSchema.safeParse('Entregar na portaria');
    expect(result.success).toBe(true);
  });

  it('accepts undefined (optional)', () => {
    const result = observacoesSchema.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it('accepts empty string', () => {
    const result = observacoesSchema.safeParse('');
    expect(result.success).toBe(true);
  });

  it('trims whitespace', () => {
    const result = observacoesSchema.parse('  Nota  ');
    expect(result).toBe('Nota');
  });

  it('rejects text longer than 500 chars', () => {
    const result = observacoesSchema.safeParse('A'.repeat(501));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('500 caracteres');
    }
  });

  it('accepts text with exactly 500 chars', () => {
    expect(observacoesSchema.safeParse('A'.repeat(500)).success).toBe(true);
  });
});

// ============================================================================
// coordenadasSchema
// ============================================================================

describe('coordenadasSchema', () => {
  it('accepts valid coordinates', () => {
    const result = coordenadasSchema.safeParse({
      latitude: -23.55,
      longitude: -46.63,
    });
    expect(result.success).toBe(true);
  });

  it('accepts boundary values (min)', () => {
    const result = coordenadasSchema.safeParse({
      latitude: -90,
      longitude: -180,
    });
    expect(result.success).toBe(true);
  });

  it('accepts boundary values (max)', () => {
    const result = coordenadasSchema.safeParse({
      latitude: 90,
      longitude: 180,
    });
    expect(result.success).toBe(true);
  });

  it('accepts zero coordinates', () => {
    const result = coordenadasSchema.safeParse({ latitude: 0, longitude: 0 });
    expect(result.success).toBe(true);
  });

  it('rejects latitude out of range (< -90)', () => {
    expect(
      coordenadasSchema.safeParse({ latitude: -91, longitude: 0 }).success,
    ).toBe(false);
  });

  it('rejects latitude out of range (> 90)', () => {
    expect(
      coordenadasSchema.safeParse({ latitude: 91, longitude: 0 }).success,
    ).toBe(false);
  });

  it('rejects longitude out of range (< -180)', () => {
    expect(
      coordenadasSchema.safeParse({ latitude: 0, longitude: -181 }).success,
    ).toBe(false);
  });

  it('rejects longitude out of range (> 180)', () => {
    expect(
      coordenadasSchema.safeParse({ latitude: 0, longitude: 181 }).success,
    ).toBe(false);
  });

  it('rejects missing latitude', () => {
    expect(coordenadasSchema.safeParse({ longitude: 0 }).success).toBe(false);
  });

  it('rejects missing longitude', () => {
    expect(coordenadasSchema.safeParse({ latitude: 0 }).success).toBe(false);
  });
});

// ============================================================================
// isValidCoordinates
// ============================================================================

describe('isValidCoordinates', () => {
  it('returns true for valid coordinates', () => {
    expect(isValidCoordinates(-23.55, -46.63)).toBe(true);
  });

  it('returns true for boundary min values', () => {
    expect(isValidCoordinates(-90, -180)).toBe(true);
  });

  it('returns true for boundary max values', () => {
    expect(isValidCoordinates(90, 180)).toBe(true);
  });

  it('returns true for zero', () => {
    expect(isValidCoordinates(0, 0)).toBe(true);
  });

  it('returns false for lat < -90', () => {
    expect(isValidCoordinates(-91, 0)).toBe(false);
  });

  it('returns false for lat > 90', () => {
    expect(isValidCoordinates(91, 0)).toBe(false);
  });

  it('returns false for lng < -180', () => {
    expect(isValidCoordinates(0, -181)).toBe(false);
  });

  it('returns false for lng > 180', () => {
    expect(isValidCoordinates(0, 181)).toBe(false);
  });
});

// ============================================================================
// isValidEmail
// ============================================================================

describe('isValidEmail', () => {
  it('returns true for valid email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('returns true for uppercase email (lowered internally)', () => {
    expect(isValidEmail('USER@EXAMPLE.COM')).toBe(true);
  });

  it('returns false for invalid email', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });
});
