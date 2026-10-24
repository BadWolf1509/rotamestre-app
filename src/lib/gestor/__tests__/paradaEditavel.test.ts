import { podeAlterarParada } from '../paradaEditavel';

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
