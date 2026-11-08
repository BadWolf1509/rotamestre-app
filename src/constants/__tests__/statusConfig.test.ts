import { comporSobre, contraste } from '@/test-utils/contraste';
import { STATUS_PARADA } from '@/types/rota';
import { darkTheme, defaultTheme as lightTheme } from '@/utils/styles.base';

import {
  OPACIDADE_FUNDO_STATUS_SOFT,
  ROUTE_STATUS_CONFIG,
  STOP_STATUS_CONFIG,
  type StatusColorKey,
  corDeTextoDoStatus,
  coresPorStatusDaRota,
  getStatusColorKey,
  rotuloDoStatus,
} from '../statusConfig';

describe('rotuloDoStatus', () => {
  it.each([
    ['nao_executada', 'Não executada'],
    ['em_andamento', 'Em andamento'],
    ['pendente', 'Pendente'],
    ['concluida', 'Concluída'],
    ['cancelada', 'Cancelada'],
    ['pulada', 'Pulada'],
    ['CONCLUIDA', 'Concluída'],
    ['status_novo', 'status novo'],
  ])('%s → %s', (s, r) => expect(rotuloDoStatus(s)).toBe(r));
  it.each([undefined, null, ''])('%p → "-"', (s) =>
    expect(rotuloDoStatus(s)).toBe('-'),
  );
});

it('rota: a config cobre os 5 valores do CHECK rotas_status_check', () =>
  expect(Object.keys(ROUTE_STATUS_CONFIG).sort()).toEqual([
    'cancelada',
    'concluida',
    'em_andamento',
    'nao_executada',
    'pendente',
  ]));

it('parada: a config cobre os 4 status, inclusive em_andamento', () =>
  expect(Object.keys(STOP_STATUS_CONFIG).sort()).toEqual([
    'concluida',
    'em_andamento',
    'pendente',
    'pulada',
  ]));

it('coresPorStatusDaRota: nao_executada é error e em_andamento é info', () => {
  const cores = coresPorStatusDaRota((k) => `cor-${k}`);
  expect(cores).toEqual({
    pendente: 'cor-warning',
    em_andamento: 'cor-info',
    concluida: 'cor-success',
    cancelada: 'cor-error',
    nao_executada: 'cor-error',
  });
});

it('getStatusColorKey de em_andamento segue info (marcadores do mapa intactos)', () =>
  expect(getStatusColorKey('em_andamento')).toBe('info'));

it('STOP_STATUS_CONFIG tem exatamente STATUS_PARADA', () =>
  expect(Object.keys(STOP_STATUS_CONFIG).sort()).toEqual(
    [...STATUS_PARADA].sort(),
  ));

describe('corDeTextoDoStatus — contraste do selo soft', () => {
  const temas = [
    ['claro', lightTheme],
    ['escuro', darkTheme],
  ] as const;
  const chaves: StatusColorKey[] = [
    'warning',
    'info',
    'success',
    'error',
    'gray600',
  ];

  // O selo fica sobre cartão ou superfície; mede contra o pior dos dois.
  it.each(
    temas.flatMap(([nome, tema]) =>
      chaves.map((chave) => [nome, chave, tema] as const),
    ),
  )(
    'tema %s, %s: texto com pelo menos 4,5:1 sobre o fundo do selo',
    (_nome, chave, tema) => {
      const texto = corDeTextoDoStatus(chave, tema.colors);
      const piores = [tema.colors.surface, tema.colors.card].map((base) =>
        contraste(
          texto,
          comporSobre(tema.colors[chave], base, OPACIDADE_FUNDO_STATUS_SOFT),
        ),
      );
      expect(Math.min(...piores)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('usa os tons de texto do tema, não a cor do status', () => {
    expect(corDeTextoDoStatus('warning', lightTheme.colors)).toBe(
      lightTheme.colors.warningText,
    );
    expect(corDeTextoDoStatus('info', lightTheme.colors)).toBe(
      lightTheme.colors.infoText,
    );
    expect(corDeTextoDoStatus('success', lightTheme.colors)).toBe(
      lightTheme.colors.successDark,
    );
    expect(corDeTextoDoStatus('error', lightTheme.colors)).toBe(
      lightTheme.colors.errorText,
    );
    expect(corDeTextoDoStatus('gray600', lightTheme.colors)).toBe(
      lightTheme.colors.gray600,
    );
  });
});
