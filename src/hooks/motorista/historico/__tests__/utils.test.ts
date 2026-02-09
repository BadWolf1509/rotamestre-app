import { calcularTempoTotal, formatarTempo } from '../utils';

import type { RotaHistorico } from '../types';

function makeRota(overrides: Partial<RotaHistorico> = {}): RotaHistorico {
  return {
    id: '1',
    data: '2026-01-15',
    status: 'concluida',
    unidades: { nome: 'Unidade A' },
    ...overrides,
  };
}

describe('calcularTempoTotal', () => {
  it('returns null when iniciada_em is missing', () => {
    expect(calcularTempoTotal(makeRota({ concluida_em: '2026-01-15T14:00:00Z' }))).toBeNull();
  });

  it('returns null when concluida_em is missing', () => {
    expect(calcularTempoTotal(makeRota({ iniciada_em: '2026-01-15T10:00:00Z' }))).toBeNull();
  });

  it('returns null when both timestamps are missing', () => {
    expect(calcularTempoTotal(makeRota())).toBeNull();
  });

  it('calculates exact hours', () => {
    const rota = makeRota({
      iniciada_em: '2026-01-15T08:00:00Z',
      concluida_em: '2026-01-15T11:00:00Z',
    });
    expect(calcularTempoTotal(rota)).toBe('3h 0min');
  });

  it('calculates hours and minutes', () => {
    const rota = makeRota({
      iniciada_em: '2026-01-15T08:00:00Z',
      concluida_em: '2026-01-15T10:30:00Z',
    });
    expect(calcularTempoTotal(rota)).toBe('2h 30min');
  });

  it('calculates minutes only (less than 1 hour)', () => {
    const rota = makeRota({
      iniciada_em: '2026-01-15T08:00:00Z',
      concluida_em: '2026-01-15T08:45:00Z',
    });
    expect(calcularTempoTotal(rota)).toBe('0h 45min');
  });

  it('returns 0h 0min for same start and end time', () => {
    const rota = makeRota({
      iniciada_em: '2026-01-15T08:00:00Z',
      concluida_em: '2026-01-15T08:00:00Z',
    });
    expect(calcularTempoTotal(rota)).toBe('0h 0min');
  });

  it('handles multi-day durations', () => {
    const rota = makeRota({
      iniciada_em: '2026-01-15T08:00:00Z',
      concluida_em: '2026-01-16T10:30:00Z',
    });
    expect(calcularTempoTotal(rota)).toBe('26h 30min');
  });
});

describe('formatarTempo', () => {
  it('returns dash for 0 minutes', () => {
    expect(formatarTempo(0)).toBe('-');
  });

  it('formats minutes only (less than 60)', () => {
    expect(formatarTempo(45)).toBe('45min');
  });

  it('formats exactly 1 minute', () => {
    expect(formatarTempo(1)).toBe('1min');
  });

  it('formats exactly 59 minutes', () => {
    expect(formatarTempo(59)).toBe('59min');
  });

  it('formats exact hours (no remaining minutes)', () => {
    expect(formatarTempo(60)).toBe('1h 0min');
  });

  it('formats hours and minutes', () => {
    expect(formatarTempo(90)).toBe('1h 30min');
  });

  it('formats multiple hours', () => {
    expect(formatarTempo(150)).toBe('2h 30min');
  });

  it('formats large values', () => {
    expect(formatarTempo(600)).toBe('10h 0min');
  });
});
