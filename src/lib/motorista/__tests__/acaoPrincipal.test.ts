import { acaoPrincipal, formatarTempoDecorrido } from '../acaoPrincipal';

describe('acaoPrincipal', () => {
  it.each([
    ['pending', 'Iniciar', 'play-circle', 'success', 'iniciar-rota'],
    ['active', 'Navegar', 'navigate', 'secondary', 'navegar'],
    ['last-stop', 'Navegar', 'navigate', 'secondary', 'navegar'],
    [
      'ready-to-complete',
      'Finalizar',
      'checkmark-circle',
      'success',
      'finalizar-rota',
    ],
    ['completed', 'Detalhes', 'document-text', 'primary', 'ver-resumo'],
    ['no-route', 'Histórico', 'time', 'primary', 'ver-historico'],
  ] as const)('%s → %s', (status, rotulo, icone, cor, destino) => {
    expect(acaoPrincipal(status)).toEqual({ rotulo, icone, cor, destino });
  });
});

describe('formatarTempoDecorrido', () => {
  const inicio = '2026-11-05T10:00:00.000Z';
  const em = (ms: number) => new Date(Date.parse(inicio) + ms);

  it('sem início, não mostra nada', () => {
    expect(formatarTempoDecorrido(null, em(0))).toBeNull();
    expect(formatarTempoDecorrido(undefined, em(0))).toBeNull();
  });

  it('menos de 1 hora não mostra "0h"', () => {
    expect(formatarTempoDecorrido(inicio, em(5 * 60_000))).toBe('5min');
  });

  it('a partir de 1 hora mostra horas e minutos', () => {
    expect(formatarTempoDecorrido(inicio, em(123 * 60_000))).toBe('2h 3min');
  });

  it('relógio do aparelho atrás do início não vira tempo negativo', () => {
    expect(formatarTempoDecorrido(inicio, em(-60_000))).toBe('0min');
  });
});
