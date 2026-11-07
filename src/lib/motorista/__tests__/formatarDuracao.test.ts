import { formatarDuracao } from '../formatarDuracao';

const MIN = 60_000;
const HORA = 60 * MIN;

describe('formatarDuracao (M-5)', () => {
  it.each([
    ['zero', 0, '0min'],
    ['menos de 1 min', 30_000, '0min'],
    ['1 min', MIN, '1min'],
    ['45 min', 45 * MIN, '45min'],
    ['59 min 59 s', 59 * MIN + 59_000, '59min'],
    ['1 h exata', HORA, '1h 0min'],
    ['1h05', HORA + 5 * MIN, '1h 5min'],
    ['2h30', 2 * HORA + 30 * MIN, '2h 30min'],
    ['mais de 24 h acumula horas', 26 * HORA + 30 * MIN, '26h 30min'],
  ])('%s', (_nome, ms, esperado) => {
    expect(formatarDuracao(ms)).toBe(esperado);
  });

  it('negativo (relógio do aparelho atrás) não vira tempo negativo', () => {
    expect(formatarDuracao(-5 * MIN)).toBe('0min');
  });

  it('valor inválido (NaN) vira 0min', () => {
    expect(formatarDuracao(Number.NaN)).toBe('0min');
  });
});
