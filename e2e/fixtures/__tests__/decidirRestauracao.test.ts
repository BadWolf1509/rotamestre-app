import { decidirRestauracao, diaLocal } from '../decidirRestauracao';

// Datas em hora LOCAL (`new Date(a, m, d, h)`), nunca string ISO com Z: o CI
// roda em UTC e o código decide por dia do calendário local.
const agora = new Date(2026, 9, 25, 12);
const hoje = diaLocal(agora);
const haSeteDias = diaLocal(new Date(2026, 9, 18, 12));
const haSeisDias = diaLocal(new Date(2026, 9, 19, 12));

const rotaBoa = {
  status: 'em_andamento',
  data: hoje,
  iniciada_em: new Date(2026, 9, 25, 8).toISOString(),
  concluida_em: null as string | null,
};

describe('decidirRestauracao (o que o fixture do mapa precisa consertar)', () => {
  it('rota em andamento de hoje, coerente, com pendente: nada a fazer', () => {
    expect(decidirRestauracao(rotaBoa, 1, agora)).toEqual({
      restaurarRota: false,
      reabrirParadas: false,
    });
  });

  it('rota concluída: restaura', () => {
    const r = { ...rotaBoa, status: 'concluida' };
    expect(decidirRestauracao(r, 1, agora).restaurarRota).toBe(true);
  });

  it('em andamento com data 7 dias atrás (a expiração a pega): restaura', () => {
    const r = { ...rotaBoa, data: haSeteDias };
    expect(decidirRestauracao(r, 1, agora).restaurarRota).toBe(true);
  });

  it('em andamento com data 6 dias atrás ainda serve', () => {
    const r = { ...rotaBoa, data: haSeisDias };
    expect(decidirRestauracao(r, 1, agora).restaurarRota).toBe(false);
  });

  it('iniciada_em nulo: restaura', () => {
    const r = { ...rotaBoa, iniciada_em: null };
    expect(decidirRestauracao(r, 1, agora).restaurarRota).toBe(true);
  });

  it('iniciada_em velho (vestígio da execução original): restaura', () => {
    const r = {
      ...rotaBoa,
      iniciada_em: new Date(2026, 8, 11, 8).toISOString(),
    };
    expect(decidirRestauracao(r, 1, agora).restaurarRota).toBe(true);
  });

  it('concluida_em preenchido: restaura', () => {
    const r = {
      ...rotaBoa,
      concluida_em: new Date(2026, 9, 25, 9).toISOString(),
    };
    expect(decidirRestauracao(r, 1, agora).restaurarRota).toBe(true);
  });

  it('zero entregas abertas: reabre as paradas, sem mexer na rota', () => {
    expect(decidirRestauracao(rotaBoa, 0, agora)).toEqual({
      restaurarRota: false,
      reabrirParadas: true,
    });
  });
});

describe('diaLocal', () => {
  it('formata o dia do calendário local com zeros à esquerda', () => {
    expect(diaLocal(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});
