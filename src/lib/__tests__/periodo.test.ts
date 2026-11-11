// Fixa o fuso ANTES de qualquer Date. Se o runtime não obedecer, a
// pré-condição abaixo derruba os casos dependentes de fuso, em vez de passarem
// vazios.
process.env.TZ = 'America/Sao_Paulo';

import {
  ATALHOS_PERIODO,
  PERIODO_PADRAO,
  ROTULO_PERIODO,
  cortarEmHoje,
  lerPeriodo,
  limitesEmInstante,
  resolverPeriodo,
  textoPeriodo,
} from '../periodo';

describe('resolverPeriodo', () => {
  it('hoje', () => {
    expect(resolverPeriodo({ tipo: 'hoje' }, '2026-11-10')).toEqual({
      de: '2026-11-10',
      ate: '2026-11-10',
    });
  });

  it('ontem atravessa mês e ano bissexto', () => {
    expect(resolverPeriodo({ tipo: 'ontem' }, '2026-03-01').de).toBe(
      '2026-02-28',
    );
    expect(resolverPeriodo({ tipo: 'ontem' }, '2028-03-01').de).toBe(
      '2028-02-29',
    );
  });

  it('esta semana vai de segunda a domingo', () => {
    const p = { tipo: 'esta_semana' } as const;
    expect(resolverPeriodo(p, '2026-11-10')).toEqual({
      de: '2026-11-09',
      ate: '2026-11-15',
    });
    expect(resolverPeriodo(p, '2026-11-15')).toEqual({
      de: '2026-11-09',
      ate: '2026-11-15',
    });
    expect(resolverPeriodo(p, '2026-11-16')).toEqual({
      de: '2026-11-16',
      ate: '2026-11-22',
    });
  });

  it('semana passada', () => {
    const p = { tipo: 'semana_passada' } as const;
    expect(resolverPeriodo(p, '2026-12-02')).toEqual({
      de: '2026-11-23',
      ate: '2026-11-29',
    });
    expect(resolverPeriodo(p, '2027-01-03')).toEqual({
      de: '2026-12-21',
      ate: '2026-12-27',
    });
  });

  it('este mês inclui os dias que ainda não chegaram', () => {
    expect(resolverPeriodo({ tipo: 'este_mes' }, '2026-11-10')).toEqual({
      de: '2026-11-01',
      ate: '2026-11-30',
    });
    expect(resolverPeriodo({ tipo: 'este_mes' }, '2028-02-10').ate).toBe(
      '2028-02-29',
    );
  });

  it('mês passado em janeiro volta a dezembro do ano anterior', () => {
    expect(resolverPeriodo({ tipo: 'mes_passado' }, '2026-01-15')).toEqual({
      de: '2025-12-01',
      ate: '2025-12-31',
    });
  });

  it('todo e personalizado', () => {
    expect(resolverPeriodo({ tipo: 'todo' }, '2026-11-10')).toEqual({
      de: null,
      ate: null,
    });
    expect(
      resolverPeriodo(
        { tipo: 'personalizado', de: '2026-10-01', ate: '2026-10-15' },
        '2026-11-10',
      ),
    ).toEqual({ de: '2026-10-01', ate: '2026-10-15' });
  });
});

describe('cortarEmHoje', () => {
  it('o fim vira hoje', () => {
    expect(
      cortarEmHoje({ de: '2026-11-01', ate: '2026-11-30' }, '2026-11-10'),
    ).toEqual({ de: '2026-11-01', ate: '2026-11-10' });
  });

  it('fim anterior a hoje fica como está', () => {
    expect(
      cortarEmHoje({ de: '2026-10-01', ate: '2026-10-31' }, '2026-11-10'),
    ).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
  });

  it('começa depois de hoje: null', () => {
    expect(
      cortarEmHoje({ de: '2026-12-01', ate: '2026-12-31' }, '2026-11-10'),
    ).toBeNull();
  });

  it('todo o período: { de: null, ate: hoje }', () => {
    expect(cortarEmHoje({ de: null, ate: null }, '2026-11-10')).toEqual({
      de: null,
      ate: '2026-11-10',
    });
  });
});

describe('textoPeriodo', () => {
  it('atalho com as datas', () => {
    expect(textoPeriodo({ tipo: 'este_mes' }, undefined, '2026-11-10')).toBe(
      'Este mês (01/11 a 30/11)',
    );
    expect(textoPeriodo({ tipo: 'hoje' }, undefined, '2026-11-10')).toBe(
      'Hoje (10/11)',
    );
  });

  it('ano só quando não é o corrente', () => {
    expect(textoPeriodo({ tipo: 'mes_passado' }, undefined, '2026-01-15')).toBe(
      'Mês passado (01/12/2025 a 31/12/2025)',
    );
  });

  it('todo o período sem datas', () => {
    expect(textoPeriodo({ tipo: 'todo' }, undefined, '2026-11-10')).toBe(
      'Todo o período',
    );
  });

  it('usa o intervalo já cortado', () => {
    expect(
      textoPeriodo(
        { tipo: 'este_mes' },
        { de: '2026-11-01', ate: '2026-11-10' },
        '2026-11-10',
      ),
    ).toBe('Este mês (01/11 a 10/11)');
  });

  it('personalizado', () => {
    expect(
      textoPeriodo(
        { tipo: 'personalizado', de: '2026-10-01', ate: '2026-10-15' },
        undefined,
        '2026-11-10',
      ),
    ).toBe('Personalizado (01/10 a 15/10)');
  });
});

describe('lerPeriodo', () => {
  it('aceita atalhos e personalizado válidos', () => {
    for (const tipo of ATALHOS_PERIODO) {
      expect(lerPeriodo({ tipo })).toEqual({ tipo });
    }
    expect(
      lerPeriodo({
        tipo: 'personalizado',
        de: '2026-10-01',
        ate: '2026-10-01',
      }),
    ).toEqual({ tipo: 'personalizado', de: '2026-10-01', ate: '2026-10-01' });
  });

  it('recusa o que não é período', () => {
    expect(lerPeriodo({ tipo: 'xyz' })).toBeNull();
    expect(
      lerPeriodo({
        tipo: 'personalizado',
        de: '2026-11-10',
        ate: '2026-11-01',
      }),
    ).toBeNull();
    expect(
      lerPeriodo({
        tipo: 'personalizado',
        de: '2026-02-30',
        ate: '2026-03-05',
      }),
    ).toBeNull();
    expect(lerPeriodo({ tipo: 'personalizado', de: '2026-11-01' })).toBeNull();
    expect(lerPeriodo('texto')).toBeNull();
    expect(lerPeriodo(null)).toBeNull();
    expect(lerPeriodo(undefined)).toBeNull();
  });
});

describe('constantes', () => {
  it('padrão e rótulos', () => {
    expect(PERIODO_PADRAO).toEqual({ tipo: 'este_mes' });
    expect(ATALHOS_PERIODO.map((a) => ROTULO_PERIODO[a])).toEqual([
      'Hoje',
      'Ontem',
      'Esta semana',
      'Semana passada',
      'Este mês',
      'Mês passado',
      'Todo o período',
    ]);
    expect(ROTULO_PERIODO.personalizado).toBe('Personalizado');
  });
});

describe('fuso America/Sao_Paulo', () => {
  it('pré-condição: o runtime obedeceu ao TZ do arquivo', () => {
    expect(new Date(2026, 10, 10).getTimezoneOffset()).toBe(180);
  });

  it('limitesEmInstante: meia-noite local de de e do dia seguinte a ate', () => {
    expect(limitesEmInstante({ de: '2026-11-10', ate: '2026-11-10' })).toEqual({
      desde: '2026-11-10T03:00:00.000Z',
      antesDe: '2026-11-11T03:00:00.000Z',
    });
    expect(limitesEmInstante({ de: null, ate: null })).toEqual({
      desde: null,
      antesDe: null,
    });
  });

  describe('às 21:30 locais do último dia do mês (já é dia 1 em UTC)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-30T21:30:00-03:00'));
    });
    afterEach(() => jest.useRealTimers());

    it('este mês continua novembro e hoje continua 30/11', () => {
      expect(new Date(2026, 10, 10).getTimezoneOffset()).toBe(180);
      expect(resolverPeriodo({ tipo: 'este_mes' })).toEqual({
        de: '2026-11-01',
        ate: '2026-11-30',
      });
      expect(resolverPeriodo({ tipo: 'hoje' })).toEqual({
        de: '2026-11-30',
        ate: '2026-11-30',
      });
    });
  });
});
