import { criarUnidadeSchema } from '../onboarding';

const base = {
  gestorNome: 'Maria Souza',
  unidadeNome: 'Transportes Souza',
  cidade: 'João Pessoa',
  uf: 'PB',
  endereco: 'Av. Epitácio Pessoa, 100',
  telefone: '',
};

describe('criarUnidadeSchema', () => {
  it('rejeita endereço digitado sem selecionar sugestão (sem coordenadas)', () => {
    const r = criarUnidadeSchema.safeParse(base);

    expect(r.success).toBe(false);
    if (!r.success) {
      // A mensagem aparece no campo de endereço, que é onde o usuário age.
      expect(r.error.issues[0].path).toContain('endereco');
      expect(r.error.issues[0].message).toMatch(/sugest/i);
    }
  });

  it('aceita quando as coordenadas vieram da sugestão', () => {
    const r = criarUnidadeSchema.safeParse({
      ...base,
      latitude: -7.1195,
      longitude: -34.845,
    });

    expect(r.success).toBe(true);
  });
});
