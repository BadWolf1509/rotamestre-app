import {
  AVISO_LISTA_CORTADA,
  periodoNaFrase,
  textosDoVazio,
} from '../textosDoPeriodo';

const HOJE = '2026-11-10';

describe('periodoNaFrase', () => {
  it.each([
    [{ tipo: 'este_mes' } as const, 'este mês (01/11 a 30/11)'],
    [{ tipo: 'hoje' } as const, 'hoje (10/11)'],
    [{ tipo: 'todo' } as const, 'todo o período'],
    [
      { tipo: 'personalizado', de: '2026-10-01', ate: '2026-10-15' } as const,
      'personalizado (01/10 a 15/10)',
    ],
  ])('%o → "%s" (inicial minúscula no meio da frase)', (periodo, texto) => {
    expect(periodoNaFrase(periodo, HOJE)).toBe(texto);
  });
});

describe('textosDoVazio', () => {
  it('sem filtro: "Nenhuma rota em este mês (...)"', () => {
    expect(textosDoVazio({ tipo: 'este_mes' }, {}, HOJE)).toEqual({
      titulo: 'Nenhuma rota em este mês (01/11 a 30/11)',
      descricao: 'Escolha outro período ou crie uma nova rota',
    });
  });

  it('com status ou motorista: diz que o filtro pode esconder rotas', () => {
    expect(
      textosDoVazio({ tipo: 'hoje' }, { status: 'pendente' }, HOJE),
    ).toEqual({
      titulo: 'Nenhuma rota em hoje (10/11) com esses filtros',
      descricao: 'Ajuste os filtros ou crie uma nova rota',
    });
    expect(
      textosDoVazio({ tipo: 'todo' }, { motoristaId: 'm1' }, HOJE).titulo,
    ).toBe('Nenhuma rota em todo o período com esses filtros');
  });
});

it('o aviso de lista cortada diz exatamente quais 500 aparecem', () => {
  expect(AVISO_LISTA_CORTADA).toBe(
    'Mostrando as primeiras 500 rotas, da data mais nova para a mais antiga. Escolha um período para ver as demais.',
  );
});
