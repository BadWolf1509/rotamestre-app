import { fireEvent, render, within } from '@testing-library/react-native';
import React from 'react';

import { DashboardDesktop } from '../DashboardDesktop';

// "Hoje" fixo: os textos do período ("este mês (01/11 a 30/11)") são exatos.
jest.mock('@/lib/dateUtils', () => ({
  ...jest.requireActual('@/lib/dateUtils'),
  getTodayISO: () => '2026-11-10',
}));

// Mock expo-router
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('@/hooks/useMotoristas', () => ({
  useMotoristas: () => ({ motoristas: [] }),
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

// DesktopPageLayout: só o conteúdo e as ações do cabeçalho (o resto — seletor
// de loja, sino — tem dependências próprias que não interessam aqui).
jest.mock('@/components/desktop/DesktopPageLayout', () => ({
  DesktopPageLayout: ({
    children,
    actions,
  }: {
    children: React.ReactNode;
    actions?: { label: string; onPress: () => void }[];
  }) => {
    const { Text, TouchableOpacity, View } = require('react-native');
    return (
      <View>
        {(actions ?? []).map((a) => (
          <TouchableOpacity
            key={a.label}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            onPress={a.onPress}
          >
            <Text>{a.label}</Text>
          </TouchableOpacity>
        ))}
        {children}
      </View>
    );
  },
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

describe('DashboardDesktop', () => {
  const defaultProps = {
    stats: {
      total: 2,
      emAndamento: 1,
      concluidas: 0,
      distanciaTotal: 150.5,
      incidentesAbertos: 2,
    },
    todayStats: {
      totalHoje: 8,
    },
    kpis: {},
    rotas: [
      {
        id: 'rota-1',
        data: '2026-11-07',
        motorista_nome: 'João Silva',
        motorista_id: 'm1',
        status: 'em_andamento',
        total_paradas: 5,
        paradas_concluidas: 2,
        distancia_total: 100.5,
        paradas_status: [
          'concluida',
          'concluida',
          'em_andamento',
          'pendente',
          'pendente',
        ],
      },
      {
        id: 'rota-2',
        data: '2026-11-07',
        motorista_nome: 'Maria Santos',
        motorista_id: 'm2',
        status: 'pendente',
        total_paradas: 3,
        paradas_concluidas: 0,
        distancia_total: 50,
        paradas_status: ['pendente', 'pendente', 'pendente'],
      },
    ],
    loading: false,
    refreshing: false,
    erroCarga: null,
    dadosDe: null,
    onRefresh: jest.fn(),
    userData: {
      id: 'user-1',
      nome: 'Admin User',
      unidade_id: 'unidade-1',
    },
    filters: {},
    onFiltersChange: jest.fn(),
    periodo: { tipo: 'este_mes' },
    onPeriodoChange: jest.fn(),
    listaCortada: false,
  } as unknown as React.ComponentProps<typeof DashboardDesktop>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Resumo do dia', () => {
    it('troca os cartões de número por uma frase', () => {
      const { getByTestId, queryByText } = render(
        <DashboardDesktop {...defaultProps} />,
      );

      expect(getByTestId('gestor-dashboard-stats')).toBeTruthy();
      expect(getByTestId('gestor-dashboard-resumo')).toHaveTextContent(
        '1 rota em andamento, 1 pendente — 2 de 8 paradas feitas, 150,5 km',
      );
      expect(queryByText('Total Hoje')).toBeNull();
      expect(queryByText('Ações Rápidas')).toBeNull();
      expect(queryByText('Nova rota de entrega')).toBeNull();
    });

    it('a distância sai com vírgula, não com ponto', () => {
      const { getByTestId } = render(<DashboardDesktop {...defaultProps} />);

      expect(getByTestId('gestor-dashboard-resumo')).not.toHaveTextContent(
        /150\.5/,
      );
    });

    it('os incidentes abertos levam aos incidentes', () => {
      const { getByRole } = render(<DashboardDesktop {...defaultProps} />);

      fireEvent.press(getByRole('link', { name: '2 incidentes abertos' }));
      expect(mockPush).toHaveBeenCalledWith('/gestor/incidentes');
    });

    it('contagem de incidentes nula não vira 0', () => {
      const { getByText, queryByText } = render(
        <DashboardDesktop
          {...defaultProps}
          stats={{ ...defaultProps.stats, incidentesAbertos: null }}
        />,
      );

      expect(getByText('Incidentes indisponíveis')).toBeTruthy();
      expect(queryByText(/0 incidentes/)).toBeNull();
    });
  });

  describe('Cabeçalho', () => {
    it('"Nova rota" leva à criação de rota', () => {
      const { getByRole } = render(<DashboardDesktop {...defaultProps} />);

      fireEvent.press(getByRole('button', { name: 'Nova rota' }));
      expect(mockPush).toHaveBeenCalledWith('/gestor/nova-entrega');
    });
  });

  describe('Rotas do dia', () => {
    it('uma linha por rota, com a linha de paradas', () => {
      const { getByTestId, getAllByLabelText } = render(
        <DashboardDesktop {...defaultProps} />,
      );

      expect(getByTestId('rotas-table')).toBeTruthy();
      expect(getByTestId('rota-dia-rota-1')).toBeTruthy();
      expect(getByTestId('rota-dia-rota-2')).toBeTruthy();
      expect(getAllByLabelText(/^Parada \d+, /)).toHaveLength(8);
    });

    it('tocar na linha abre o mapa da rota', () => {
      const { getByTestId } = render(<DashboardDesktop {...defaultProps} />);

      fireEvent.press(getByTestId('rota-dia-rota-1'));
      expect(mockPush).toHaveBeenCalledWith('/gestor/mapa-rota?id=rota-1');
    });
  });

  describe('Sem rotas', () => {
    it('mostra o estado vazio com "Criar rota"', () => {
      const { getByTestId, getByRole } = render(
        <DashboardDesktop {...defaultProps} rotas={[]} />,
      );

      // O ResumoDoDia acima diz a mesma frase.
      expect(
        within(getByTestId('rotas-table')).getByText(
          'Nenhuma rota em este mês (01/11 a 30/11)',
        ),
      ).toBeTruthy();
      fireEvent.press(getByRole('button', { name: 'Criar rota' }));
      expect(mockPush).toHaveBeenCalledWith('/gestor/nova-entrega');
    });

    it('sem filtro, o resumo diz o mesmo que o vazio (o período), sem "hoje"', () => {
      const { getByTestId } = render(
        <DashboardDesktop {...defaultProps} rotas={[]} />,
      );

      const resumo = getByTestId('gestor-dashboard-resumo');
      expect(resumo).toHaveTextContent(
        'Nenhuma rota em este mês (01/11 a 30/11)',
      );
      expect(resumo).not.toHaveTextContent(/hoje/);
    });

    it('com filtro só de status ou motorista, o vazio fala dos filtros, não de criar a primeira rota', () => {
      const { getByTestId, queryByText } = render(
        <DashboardDesktop
          {...defaultProps}
          rotas={[]}
          filters={{ status: 'concluida', motoristaId: 'm1' }}
        />,
      );

      const vazio = within(getByTestId('rotas-table'));
      const titulo =
        'Nenhuma rota em este mês (01/11 a 30/11) com esses filtros';
      expect(vazio.getByText(titulo)).toBeTruthy();
      expect(
        vazio.getByText('Ajuste os filtros ou crie uma nova rota'),
      ).toBeTruthy();
      expect(queryByText(/primeira rota/)).toBeNull();
      expect(getByTestId('gestor-dashboard-resumo')).toHaveTextContent(titulo);
    });

    it('com outro período, o vazio fala dele e mantém "Criar rota"', () => {
      const { getByTestId, getByRole, queryByText } = render(
        <DashboardDesktop
          {...defaultProps}
          rotas={[]}
          periodo={{
            tipo: 'personalizado',
            de: '2026-11-01',
            ate: '2026-11-05',
          }}
        />,
      );

      const vazio = within(getByTestId('rotas-table'));
      expect(
        vazio.getByText('Nenhuma rota em personalizado (01/11 a 05/11)'),
      ).toBeTruthy();
      expect(queryByText(/do dia/)).toBeNull();
      fireEvent.press(getByRole('button', { name: 'Criar rota' }));
      expect(mockPush).toHaveBeenCalledWith('/gestor/nova-entrega');
    });
  });

  describe('Lista cortada ("Todo o período")', () => {
    it('com a lista cortada, avisa que mostra só as 500 mais recentes', () => {
      const { getByTestId } = render(
        <DashboardDesktop
          {...defaultProps}
          periodo={{ tipo: 'todo' }}
          listaCortada
        />,
      );

      expect(getByTestId('aviso-lista-cortada')).toHaveTextContent(
        'Mostrando as 500 rotas mais recentes. Escolha um período para ver as demais.',
      );
    });

    it('sem corte, não há aviso', () => {
      const { queryByTestId } = render(<DashboardDesktop {...defaultProps} />);

      expect(queryByTestId('aviso-lista-cortada')).toBeNull();
    });
  });

  describe('Erro de carga', () => {
    it('mostra o aviso e "Tentar novamente" chama onRefresh', () => {
      const onRefresh = jest.fn();
      const { getByText } = render(
        <DashboardDesktop
          {...defaultProps}
          onRefresh={onRefresh}
          erroCarga="Não foi possível carregar o painel."
          dadosDe={null}
        />,
      );

      expect(getByText(/Não foi possível carregar o painel/)).toBeTruthy();
      fireEvent.press(getByText('Tentar novamente'));
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });
});
