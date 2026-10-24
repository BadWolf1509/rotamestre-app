import {
  mensagemParadaNaoAlteravel,
  podeAlterarParada,
} from '../paradaEditavel';

describe('podeAlterarParada', () => {
  it.each(['pendente', 'em_andamento'])(
    'parada pendente em rota %s: pode',
    (rota) => {
      expect(podeAlterarParada('pendente', rota)).toBe(true);
    },
  );

  it.each(['concluida', 'pulada', 'em_andamento', 'status_novo', undefined])(
    'parada %s: não pode',
    (parada) => {
      expect(podeAlterarParada(parada, 'em_andamento')).toBe(false);
    },
  );

  it.each(['concluida', 'cancelada', 'nao_executada', undefined])(
    'parada pendente em rota %s: não pode',
    (rota) => {
      expect(podeAlterarParada('pendente', rota)).toBe(false);
    },
  );
});

describe('mensagemParadaNaoAlteravel', () => {
  it('parada que o motorista iniciou: aviso de iniciada, não de finalizada', () => {
    expect(mensagemParadaNaoAlteravel('em_andamento')).toBe(
      'O motorista já iniciou esta parada e ela não pode mais ser alterada. A tela foi atualizada.',
    );
  });

  it.each(['concluida', 'pulada', undefined])(
    'parada %s: aviso de finalizada',
    (status) => {
      expect(mensagemParadaNaoAlteravel(status)).toMatch(/já foi finalizada/);
    },
  );
});
