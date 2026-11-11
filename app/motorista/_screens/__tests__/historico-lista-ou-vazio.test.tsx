/**
 * Aba Histórico: "lista" e "vazio" são âncoras exclusivas.
 *
 * O vazio era o ListEmptyComponent da FlatList que carrega o testID da lista:
 * sem rotas, as duas âncoras ficavam no DOM ao mesmo tempo, e o e2e
 * (`historicoList.or(historicoEmpty)`) caía no modo estrito com 2 elementos.
 * Agora o vazio é desenhado no lugar da lista, como em Paradas e Motoristas.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import HistoricoMotorista from '../historico';

let mockRotas: unknown[] = [];
let mockStatus = 'todos';
let mockPeriodo: { tipo: string } = { tipo: 'este_mes' };
let mockTemMais = false;
const mockCarregarMais = jest.fn();
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: { id: 'm1' }, loading: false }),
}));
jest.mock('@/components/periodo', () => ({ SeletorPeriodo: () => null }));
jest.mock('@/hooks/motorista/historico', () => ({
  useHistoricoData: () => ({
    rotas: mockRotas,
    total: mockRotas.length,
    temMais: mockTemMais,
    loading: false,
    carregandoMais: false,
    refreshing: false,
    onRefresh: jest.fn(),
    carregarMais: mockCarregarMais,
    AlertDialog: null,
  }),
  useHistoricoMetrics: () => ({
    metricas: {
      rotasTotais: mockRotas.length,
      rotasConcluidas: 0,
      rotasMes: 0,
      paradasTotais: 0,
      paradasConcluidas: 0,
      distanciaTotal: 0,
      tempoMedioMinutos: 0,
      taxaSucesso: 0,
    },
    carregando: false,
    recarregar: jest.fn(),
  }),
  useHistoricoFilters: () => ({
    filtroStatus: mockStatus,
    setFiltroStatus: jest.fn(),
    periodo: mockPeriodo,
    definirPeriodo: jest.fn(),
    carregado: true,
    de: '2026-11-01',
    ate: '2026-11-30',
    textoDoPeriodo: 'Este mês (01/11 a 30/11)',
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
    mockStatus = 'todos';
    mockPeriodo = { tipo: 'todo' };
    mockTemMais = false;
    mockCarregarMais.mockClear();
  });

  it('sem rotas: só o vazio', () => {
    mockRotas = [];
    render(<HistoricoMotorista />);
    expect(screen.getByTestId('motorista-historico-empty')).toBeTruthy();
    expect(screen.queryByTestId('motorista-historico-list')).toBeNull();
    expect(screen.getByText('Nenhuma rota registrada')).toBeTruthy();
  });

  it('nenhuma rota no status escolhido: o vazio fala do filtro, não de rotas futuras', () => {
    mockRotas = [];
    mockStatus = 'cancelada';
    render(<HistoricoMotorista />);
    expect(screen.getByTestId('motorista-historico-empty')).toBeTruthy();
    expect(screen.getByText('Nenhuma rota com esse filtro')).toBeTruthy();
    expect(
      screen.queryByText('Suas rotas aparecerão aqui após serem criadas'),
    ).toBeNull();
  });

  it('nenhuma rota no período: o vazio fala do período', () => {
    mockRotas = [];
    mockPeriodo = { tipo: 'este_mes' };
    render(<HistoricoMotorista />);
    expect(screen.getByText('Nenhuma rota neste período')).toBeTruthy();
    expect(screen.getByText('Este mês (01/11 a 30/11)')).toBeTruthy();
  });

  it('com mais páginas: "Carregar mais" pede a seguinte', () => {
    mockRotas = [{ id: 'r1', data: '2026-11-01', status: 'concluida' }];
    mockTemMais = true;
    render(<HistoricoMotorista />);
    fireEvent.press(screen.getByTestId('motorista-historico-carregar-mais'));
    expect(mockCarregarMais).toHaveBeenCalledTimes(1);
  });

  it('com rotas: só a lista', () => {
    mockRotas = [{ id: 'r1', data: '2026-11-01', status: 'concluida' }];
    render(<HistoricoMotorista />);
    expect(screen.getByTestId('motorista-historico-list')).toBeTruthy();
    expect(screen.queryByTestId('motorista-historico-empty')).toBeNull();
    expect(screen.getByText('rota-r1')).toBeTruthy();
  });
});
