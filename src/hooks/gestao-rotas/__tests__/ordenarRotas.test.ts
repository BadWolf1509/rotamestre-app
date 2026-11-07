import { ordenarRotas } from '../useRotasFiltering';

import type { RotaHistorico } from '../types';

function rota(id: string, status: string): RotaHistorico {
  return {
    id,
    status,
    data: '2026-11-07',
    motorista_nome: 'X',
    iniciada_em: null,
  } as unknown as RotaHistorico;
}

describe('ordenarRotas por status', () => {
  const todas = [
    rota('canc', 'cancelada'),
    rota('conc', 'concluida'),
    rota('pend', 'pendente'),
    rota('nexe', 'nao_executada'),
    rota('andam', 'em_andamento'),
    rota('desc', 'status_novo'),
  ];

  it('asc põe em_andamento primeiro e o status desconhecido no fim', () => {
    const ids = ordenarRotas(todas, 'status', 'asc').map((r) => r.id);
    expect(ids).toEqual(['andam', 'pend', 'conc', 'canc', 'nexe', 'desc']);
  });

  it('desc inverte a ordem inteira', () => {
    const ids = ordenarRotas(todas, 'status', 'desc').map((r) => r.id);
    expect(ids).toEqual(['desc', 'nexe', 'canc', 'conc', 'pend', 'andam']);
  });
});
