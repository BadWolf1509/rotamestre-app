/**
 * Aba Histórico: "lista" e "vazio" são âncoras exclusivas.
 *
 * O vazio era o ListEmptyComponent da FlatList que carrega o testID da lista:
 * sem rotas, as duas âncoras ficavam no DOM ao mesmo tempo, e o e2e
 * (`historicoList.or(historicoEmpty)`) caía no modo estrito com 2 elementos.
 * Agora o vazio é desenhado no lugar da lista, como em Paradas e Motoristas.
 */
import { render, screen } from '@testing-library/react-native';
import React from 'react';

import HistoricoMotorista from '../historico';

let mockRotas: unknown[] = [];
let mockFiltradas: unknown[] | null = null;
jest.mock('@/hooks/motorista/historico', () => ({
  useHistoricoData: () => ({
    rotas: mockRotas,
    loading: false,
    refreshing: false,
    onRefresh: jest.fn(),
    AlertDialog: null,
  }),
  useHistoricoMetrics: () => ({
    totalRotas: mockRotas.length,
    rotasConcluidas: 0,
    totalParadas: 0,
    paradasConcluidas: 0,
    distanciaTotal: 0,
    tempoMedio: 0,
    taxaSucesso: 0,
  }),
  useHistoricoFilters: (rotas: unknown[]) => ({
    filtroStatus: 'todos',
    setFiltroStatus: jest.fn(),
    filtroPeriodo: 'todos',
    setFiltroPeriodo: jest.fn(),
    rotasFiltradas: mockFiltradas ?? rotas,
  }),
  formatarTempo: () => '0min',
}));
jest.mock('@/components/motorista/historico/RotaHistoricoCard', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    RotaHistoricoCard: ({ item }: { item: { id: string } }) => (
      <Text>{`rota-${item.id}`}</Text>
    ),
  };
});

describe('Histórico: lista ou vazio, nunca os dois', () => {
  beforeEach(() => {
    mockFiltradas = null;
  });

  it('sem rotas: só o vazio', () => {
    mockRotas = [];
    render(<HistoricoMotorista />);
    expect(screen.getByTestId('motorista-historico-empty')).toBeTruthy();
    expect(screen.queryByTestId('motorista-historico-list')).toBeNull();
    expect(screen.getByText('Nenhuma rota registrada')).toBeTruthy();
  });

  it('com rotas, mas nenhuma no filtro: o vazio fala do filtro, não de rotas futuras', () => {
    mockRotas = [{ id: 'r1', data: '2026-11-01', status: 'concluida' }];
    mockFiltradas = [];
    render(<HistoricoMotorista />);
    expect(screen.getByTestId('motorista-historico-empty')).toBeTruthy();
    expect(screen.getByText('Nenhuma rota com esse filtro')).toBeTruthy();
    expect(
      screen.queryByText('Suas rotas aparecerão aqui após serem criadas'),
    ).toBeNull();
  });

  it('com rotas: só a lista', () => {
    mockRotas = [{ id: 'r1', data: '2026-11-01', status: 'concluida' }];
    render(<HistoricoMotorista />);
    expect(screen.getByTestId('motorista-historico-list')).toBeTruthy();
    expect(screen.queryByTestId('motorista-historico-empty')).toBeNull();
    expect(screen.getByText('rota-r1')).toBeTruthy();
  });
});
