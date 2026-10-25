import { paradaModalSchema, paradaSchema } from '../parada';

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
    const result = paradaSchema.parse({
      ...validParada,
      destinatario: '  João  ',
    });
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
    const {
      latitude: _lat,
      longitude: _lng,
      ...withoutCoords
    } = validParada as Record<string, unknown>;
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

describe('paradaModalSchema (modais de adicionar e editar parada da rota)', () => {
  const valida = {
    endereco: 'Rua das Flores, 123',
    tipo: 'entrega' as const,
    destinatario: '',
    telefone: '',
    observacoes: '',
  };

  function mensagens(valores: unknown): Record<string, string> {
    const r = paradaModalSchema.safeParse(valores);
    if (r.success) return {};
    return Object.fromEntries(
      r.error.issues.map((i) => [String(i.path[0]), i.message]),
    );
  }

  it('só endereço e tipo são obrigatórios: destinatário e telefone vazios passam', () => {
    expect(paradaModalSchema.safeParse(valida).success).toBe(true);
  });

  it('endereço curto ou só espaços: erro no campo endereco', () => {
    expect(mensagens({ ...valida, endereco: 'Rua' }).endereco).toBe(
      'Informe um endereço válido.',
    );
    expect(mensagens({ ...valida, endereco: '     ' }).endereco).toBe(
      'Informe um endereço válido.',
    );
  });

  it('telefone preenchido precisa de DDD e 10 ou 11 dígitos', () => {
    expect(mensagens({ ...valida, telefone: '(11) 9999' }).telefone).toBe(
      'Telefone deve ter DDD e 10 ou 11 dígitos.',
    );
    expect(
      paradaModalSchema.safeParse({ ...valida, telefone: '(11) 99999-8888' })
        .success,
    ).toBe(true);
    expect(
      paradaModalSchema.safeParse({ ...valida, telefone: '(11) 9999-8888' })
        .success,
    ).toBe(true);
  });

  it('não transforma o telefone: a máscara digitada chega intacta ao banco', () => {
    const r = paradaModalSchema.parse({
      ...valida,
      telefone: '(11) 99999-8888',
    });
    expect(r.telefone).toBe('(11) 99999-8888');
  });

  it('observações passam de 300 caracteres: erro (o limite do campo)', () => {
    expect(
      mensagens({ ...valida, observacoes: 'x'.repeat(301) }).observacoes,
    ).toBe('As observações devem ter no máximo 300 caracteres.');
    expect(
      paradaModalSchema.safeParse({ ...valida, observacoes: 'x'.repeat(300) })
        .success,
    ).toBe(true);
  });

  it('não exige coordenadas: quem decide é o salvar, que geocodifica o endereço digitado', () => {
    expect(
      paradaModalSchema.safeParse({ ...valida, latitude: undefined }).success,
    ).toBe(true);
  });
});
