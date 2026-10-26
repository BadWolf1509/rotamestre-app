import {
  LIMITE_OBSERVACOES_INCIDENTE,
  observacoesIncidenteSchema,
} from '../incidente';

describe('observacoesIncidenteSchema', () => {
  it('limite é 1000 caracteres', () => {
    expect(LIMITE_OBSERVACOES_INCIDENTE).toBe(1000);
  });

  it('aceita exatamente 1000 caracteres e o campo vazio', () => {
    expect(observacoesIncidenteSchema.safeParse('a'.repeat(1000)).success).toBe(
      true,
    );
    expect(observacoesIncidenteSchema.safeParse('').success).toBe(true);
  });

  it('recusa 1001 caracteres', () => {
    const resultado = observacoesIncidenteSchema.safeParse('a'.repeat(1001));
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0].message).toBe(
      'Observações devem ter no máximo 1000 caracteres',
    );
  });
});
