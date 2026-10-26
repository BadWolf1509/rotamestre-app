import type { ParadaData } from '@/context/RouteStatusContext';

import { toParada, toParadaData } from '../typeMappers';

describe('typeMappers: texto do pulo (Migration 73)', () => {
  const base: ParadaData = {
    id: 'p1',
    endereco: 'Rua A, 1',
    ordem: 1,
    status: 'pulada',
    tipo: 'entrega',
    latitude: -7.1,
    longitude: -34.8,
    observacoes: 'Portão azul',
    observacao_pulo: 'Ficou para amanhã',
  };

  it('toParada leva observacao_pulo sem tocar em observacoes', () => {
    const parada = toParada(base);
    expect(parada.observacao_pulo).toBe('Ficou para amanhã');
    expect(parada.observacoes).toBe('Portão azul');
  });

  it('toParadaData devolve observacao_pulo', () => {
    expect(toParadaData(toParada(base)).observacao_pulo).toBe(
      'Ficou para amanhã',
    );
  });
});
