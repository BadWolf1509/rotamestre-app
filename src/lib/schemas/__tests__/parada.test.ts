import { paradaSchema } from '../parada';

describe('paradaSchema', () => {
  const validParada = {
    endereco: 'Rua das Flores, 123',
    tipo: 'entrega' as const,
    destinatario: 'João Silva',
    telefone: '11999887766',
    observacoes: 'Entregar na portaria',
  };

  it('accepts valid parada (entrega)', () => {
    const result = paradaSchema.safeParse(validParada);
    expect(result.success).toBe(true);
  });

  it('accepts tipo "retirada"', () => {
    const result = paradaSchema.safeParse({ ...validParada, tipo: 'retirada' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid tipo', () => {
    const result = paradaSchema.safeParse({ ...validParada, tipo: 'visita' });
    expect(result.success).toBe(false);
  });

  it('rejects short endereco (< 5 chars)', () => {
    const result = paradaSchema.safeParse({ ...validParada, endereco: 'Rua' });
    expect(result.success).toBe(false);
  });

  it('rejects empty destinatario', () => {
    const result = paradaSchema.safeParse({ ...validParada, destinatario: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('obrigatório');
    }
  });

  it('rejects destinatario longer than 100 chars', () => {
    const result = paradaSchema.safeParse({
      ...validParada,
      destinatario: 'A'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('trims destinatario', () => {
    const result = paradaSchema.parse({ ...validParada, destinatario: '  João  ' });
    expect(result.destinatario).toBe('João');
  });

  it('accepts optional latitude and longitude', () => {
    const result = paradaSchema.safeParse({
      ...validParada,
      latitude: -23.55,
      longitude: -46.63,
    });
    expect(result.success).toBe(true);
  });

  it('accepts missing latitude and longitude', () => {
    const { latitude: _lat, longitude: _lng, ...withoutCoords } = validParada as Record<string, unknown>;
    const result = paradaSchema.safeParse(withoutCoords);
    expect(result.success).toBe(true);
  });

  it('accepts optional observacoes', () => {
    const { observacoes: _obs, ...withoutObs } = validParada;
    const result = paradaSchema.safeParse(withoutObs);
    expect(result.success).toBe(true);
  });

  it('rejects observacoes longer than 500 chars', () => {
    const result = paradaSchema.safeParse({
      ...validParada,
      observacoes: 'A'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('validates phone format (strips non-digits)', () => {
    const result = paradaSchema.parse({
      ...validParada,
      telefone: '(11) 99988-7766',
    });
    expect(result.telefone).toBe('11999887766');
  });
});
