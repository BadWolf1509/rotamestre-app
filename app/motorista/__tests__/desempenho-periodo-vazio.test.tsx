/**
 * Meu Desempenho: período sem rotas não pode dizer "Comece sua primeira rota"
 * (falso para quem já rodou, em "Hoje" ou numa semana parada).
 */
import { render, screen } from '@testing-library/react-native';
import React from 'react';

import DesempenhoScreen from '../desempenho';

let mockStats: Record<string, number> | null = null;
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: { id: 'm1' } }),
}));
jest.mock('@/hooks/useAlert', () => ({
  useAlert: () => ({ showError: jest.fn(), AlertDialog: null }),
}));
jest.mock('@/components/periodo', () => ({ SeletorPeriodo: () => null }));
jest.mock('@/hooks/motorista/useDesempenhoStats', () => ({
  useDesempenhoStats: () => ({
    stats: mockStats,
    loading: false,
    refreshing: false,
    periodo: { tipo: 'hoje' },
    definirPeriodo: jest.fn(),
    textoDoPeriodo: 'Hoje (11/11)',
    periodoVazio: false,
    refresh: jest.fn(),
    error: null,
  }),
}));

const zerado = {
  totalRotas: 0,
  rotasConcluidas: 0,
  rotasCanceladas: 0,
  totalParadas: 0,
  paradasConcluidas: 0,
  paradasPuladas: 0,
  taxaSucesso: 0,
  mediaParadasPorRota: 0,
  totalKm: 0,
};

it('período com zero rotas: texto de período vazio, sem "primeira rota"', () => {
  mockStats = zerado;
  render(<DesempenhoScreen />);
  expect(screen.getByText('Nenhuma rota neste período')).toBeTruthy();
  expect(screen.queryByText(/Comece sua primeira rota/)).toBeNull();
});
