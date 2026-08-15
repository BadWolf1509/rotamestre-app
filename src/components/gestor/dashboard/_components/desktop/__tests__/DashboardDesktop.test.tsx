import { render } from '@testing-library/react-native';
import React from 'react';

import { DashboardDesktop } from '../DashboardDesktop';

// Mock expo-router
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
    })),
    auth: {
      getSession: jest.fn(() =>
        Promise.resolve({ data: { session: null }, error: null }),
      ),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  },
}));

// Mock useDesktopHeaderMenu
jest.mock('@/hooks/useDesktopHeaderMenu', () => ({
  useDesktopHeaderMenu: () => ({
    userMenuTrigger: null,
    userMenuItems: [],
    logoutModal: null,
  }),
}));

// Mock gestorPageMeta
jest.mock('@/constants/gestorPageMeta', () => ({
  getGestorPageMeta: () => ({
    title: 'Início',
    description: 'Dashboard do gestor',
  }),
}));

// Mock styles
// Mock DesktopPageLayout
jest.mock('@/components/desktop/DesktopPageLayout', () => ({
  DesktopPageLayout: ({ children }: any) => children,
}));

// Mock RouteFilters
jest.mock('@/components/RouteFilters', () => ({
  RouteFilters: () => null,
}));

// Mock Toast
jest.mock('@/components/Toast', () => ({
  Toast: () => null,
}));

// Mock Dialog
jest.mock('@/components/Dialog', () => ({
  Dialog: () => null,
}));

// Mock RotasTable
jest.mock('../RotasTable', () => ({
  RotasTable: ({ rotas, onView, onDelete }: any) => {
    const { Text, TouchableOpacity, View } = require('react-native');
    return (
      <View testID="rotas-table">
        {rotas.map((rota: any) => (
          <View key={rota.id} testID={`rota-row-${rota.id}`}>
            <Text>{rota.motorista_nome}</Text>
            <TouchableOpacity
              testID={`view-${rota.id}`}
              onPress={() => onView?.(rota.id)}
            >
              <Text>Ver</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID={`delete-${rota.id}`}
              onPress={() => onDelete?.(rota.id)}
            >
              <Text>Excluir</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  },
}));

// Mock StatsCard
jest.mock('../../shared/StatsCard', () => ({
  StatsCard: ({ value, label }: any) => {
    const { Text, View } = require('react-native');
    return (
      <View testID={`stats-${label}`}>
        <Text>{value}</Text>
        <Text>{label}</Text>
      </View>
    );
  },
}));

describe('DashboardDesktop', () => {
  const defaultProps = {
    stats: {
      total: 10,
      emAndamento: 3,
      concluidas: 5,
      pendentes: 2,
      distanciaTotal: 150.5,
      incidentesAbertos: 2,
    },
    todayStats: {
      totalHoje: 8,
    },
    rotas: [
      {
        id: 'rota-1',
        motorista_nome: 'João Silva',
        status: 'em_andamento',
        total_paradas: 5,
        paradas_concluidas: 2,
      },
      {
        id: 'rota-2',
        motorista_nome: 'Maria Santos',
        status: 'pendente',
        total_paradas: 3,
        paradas_concluidas: 0,
      },
    ],
    loading: false,
    refreshing: false,
    onRefresh: jest.fn(),
    userData: {
      id: 'user-1',
      nome: 'Admin User',
      unidade_id: 'unidade-1',
    },
    filters: {},
    onFiltersChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('deve renderizar stats cards', () => {
      const { getByTestId } = render(<DashboardDesktop {...defaultProps} />);

      expect(getByTestId('stats-Total Hoje')).toBeTruthy();
      expect(getByTestId('stats-Em Andamento')).toBeTruthy();
      expect(getByTestId('stats-Concluídas')).toBeTruthy();
      expect(getByTestId('stats-km Total')).toBeTruthy();
    });

    it('deve renderizar tabela de rotas', () => {
      const { getByTestId } = render(<DashboardDesktop {...defaultProps} />);

      expect(getByTestId('rotas-table')).toBeTruthy();
    });

    it('deve renderizar linhas de rotas', () => {
      const { getByTestId } = render(<DashboardDesktop {...defaultProps} />);

      expect(getByTestId('rota-row-rota-1')).toBeTruthy();
      expect(getByTestId('rota-row-rota-2')).toBeTruthy();
    });
  });

  describe('Stats values', () => {
    it('deve mostrar valor total hoje', () => {
      const { getByText } = render(<DashboardDesktop {...defaultProps} />);

      expect(getByText('8')).toBeTruthy();
    });

    it('deve mostrar valor em andamento', () => {
      const { getByText } = render(<DashboardDesktop {...defaultProps} />);

      expect(getByText('3')).toBeTruthy();
    });

    it('deve mostrar valor concluídas', () => {
      const { getByText } = render(<DashboardDesktop {...defaultProps} />);

      expect(getByText('5')).toBeTruthy();
    });

    it('mostra a distância com vírgula, não com ponto', () => {
      // App em pt-BR: `toFixed` cru devolve "150.5". O PR #375 migrou 32
      // pontos de exibição para `formatarDecimal` e deixou justamente o
      // card do dashboard — a primeira tela que o gestor vê.
      const { getByText, queryByText } = render(
        <DashboardDesktop {...defaultProps} />,
      );

      expect(getByText('150,5')).toBeTruthy();
      expect(queryByText('150.5')).toBeNull();
    });
  });

  describe('Navigation', () => {
    it('deve ter botao Ver na tabela', () => {
      const { getByTestId } = render(<DashboardDesktop {...defaultProps} />);

      expect(getByTestId('view-rota-1')).toBeTruthy();
    });
  });

  describe('Empty state', () => {
    it('deve renderizar sem rotas', () => {
      const { getByTestId } = render(
        <DashboardDesktop {...defaultProps} rotas={[]} />,
      );

      expect(getByTestId('rotas-table')).toBeTruthy();
    });
  });

  describe('Filters callback', () => {
    it('deve ter onFiltersChange como função', () => {
      render(<DashboardDesktop {...defaultProps} />);

      expect(typeof defaultProps.onFiltersChange).toBe('function');
    });
  });

  describe('Refresh callback', () => {
    it('deve ter onRefresh como função', () => {
      render(<DashboardDesktop {...defaultProps} />);

      expect(typeof defaultProps.onRefresh).toBe('function');
    });
  });
});
