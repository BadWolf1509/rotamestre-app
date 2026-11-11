import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Image } from 'react-native';

import { useSignedUrl } from '@/hooks/storage/useSignedUrl';

import { DashboardMobile } from '../DashboardMobile';

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
    })),
  },
}));

// Mock styles
jest.mock('@/utils/styles', () => {
  const { defaultTheme } = require('@/utils/styles.base');
  const theme = defaultTheme;

  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: any) => (typeof fn === 'function' ? fn(theme) : fn),
    },
    defaultTheme: theme,
  };
});

// Mock RouteFilters
jest.mock('@/components/RouteFilters', () => ({
  RouteFilters: () => null,
}));

// Mock useMotoristas
jest.mock('@/hooks/useMotoristas', () => ({
  useMotoristas: () => ({
    motoristas: [],
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

// Mock motivationalMessages
jest.mock('@/utils/motivationalMessages', () => ({
  getGreeting: () => 'Bom dia',
  getMotivationalMessage: () => 'Mensagem motivacional',
}));

// Mock color utils
jest.mock('@/utils/color', () => ({
  withOpacity: (color: string, _opacity: number) => color,
  boxShadow: () => '0px 0px 0px #000',
  dropShadow: () => 'drop-shadow(0px 0px 0px #000)',
  textShadow: () => '0px 0px 0px #000',
}));

// Mock EmptyState
jest.mock('@/components/EmptyState', () => ({
  EmptyState: ({ title, description, actionLabel, onActionPress }: any) => {
    const { Text, TouchableOpacity, View } = require('react-native');
    return (
      <View testID="empty-state">
        <Text>{title}</Text>
        <Text>{description}</Text>
        {actionLabel && onActionPress && (
          <TouchableOpacity testID="empty-state-action" onPress={onActionPress}>
            <Text>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  },
}));

// Mock RotaCard
jest.mock('../../shared/RotaCard', () => ({
  RotaCard: ({ rota, onPress }: any) => {
    const { Text, TouchableOpacity } = require('react-native');
    return (
      <TouchableOpacity testID={`rota-card-${rota.id}`} onPress={onPress}>
        <Text>{rota.motorista_nome}</Text>
      </TouchableOpacity>
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

// Mock useSignedUrl so DashboardMobile renders avatar via signed URL
jest.mock('@/hooks/storage/useSignedUrl', () => ({
  useSignedUrl: jest.fn(),
}));

const mockUseSignedUrl = useSignedUrl as jest.MockedFunction<
  typeof useSignedUrl
>;

describe('DashboardMobile', () => {
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
    kpis: {
      rotasMes: 45,
      kmMes: 1250.5,
      tempoMedioMinutos: 135,
      taxaSucesso: 98.5,
      rotasSemana: 12,
    },
    rotas: [
      { id: 'rota-1', motorista_nome: 'João Silva', status: 'em_andamento' },
      { id: 'rota-2', motorista_nome: 'Maria Santos', status: 'pendente' },
    ],
    loading: false,
    refreshing: false,
    onRefresh: jest.fn(),
    userData: {
      id: 'user-1',
      nome: 'Admin User',
      unidade_id: 'unidade-1',
      unidades: { nome: 'WJX Locações' },
    },
    // B-GES-5: o nome vem da loja ATIVA (prop), não de userData.unidades
    unidadeNome: 'WJX Locações',
    filters: {},
    onFiltersChange: jest.fn(),
    periodo: { tipo: 'este_mes' } as const,
    onPeriodoChange: jest.fn(),
    listaCortada: false,
  };

  beforeEach(() => {
    // Default: hook returns null (no photo)
    mockUseSignedUrl.mockReturnValue({
      url: null,
      loading: false,
      error: false,
    });
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('deve mostrar loading quando loading=true', () => {
      const { getByText } = render(
        <DashboardMobile {...defaultProps} loading={true} />,
      );

      expect(getByText('Carregando início...')).toBeTruthy();
    });

    it('deve renderizar header com nome do usuário', () => {
      const { getByText } = render(<DashboardMobile {...defaultProps} />);

      // Phase 3: Time-based greeting with first name only + avatar
      expect(getByText(/Bom dia/)).toBeTruthy();
      expect(getByText(/Admin/)).toBeTruthy();
    });

    it('deve renderizar nome da unidade', () => {
      const { getByText } = render(<DashboardMobile {...defaultProps} />);

      expect(getByText('WJX Locações')).toBeTruthy();
    });

    it('deve renderizar stats cards', () => {
      const { getByTestId } = render(<DashboardMobile {...defaultProps} />);

      expect(getByTestId('stats-Total Hoje')).toBeTruthy();
      expect(getByTestId('stats-Em Andamento')).toBeTruthy();
      expect(getByTestId('stats-Concluídas')).toBeTruthy();
      expect(getByTestId('stats-km Total')).toBeTruthy();
    });

    it('KPI indisponível (null) aparece como "—", não como 0 nem "--"', () => {
      const props = {
        ...defaultProps,
        kpis: {
          ...defaultProps.kpis,
          rotasMes: null,
          rotasSemana: null,
          tempoMedioMinutos: null,
        },
      };
      const { getAllByText, queryByText } = render(
        <DashboardMobile {...(props as any)} />,
      );

      // Rotas no Mês, Tempo Médio e Esta Semana
      expect(getAllByText('—').length).toBeGreaterThanOrEqual(3);
      expect(queryByText('0')).toBeNull();
    });

    it.each([
      [1, '1 rota concluída'],
      [4, '4 rotas concluídas'],
    ])('motorista destaque com %i: "%s"', (n, frase) => {
      const { getByText } = render(
        <DashboardMobile
          {...defaultProps}
          kpis={{
            ...defaultProps.kpis,
            motoristaDestaque: { nome: 'Ana', rotasConcluidas: n },
          }}
        />,
      );

      expect(getByText(frase)).toBeTruthy();
    });

    it('deve renderizar rotas cards', () => {
      const { getByTestId } = render(<DashboardMobile {...defaultProps} />);

      expect(getByTestId('rota-card-rota-1')).toBeTruthy();
      expect(getByTestId('rota-card-rota-2')).toBeTruthy();
    });
  });

  describe('Avatar via signed URL', () => {
    it('deve renderizar Image com signed URL quando foto_url é bare path e hook retorna signed url', () => {
      const signedUrl = 'https://signed.example.com/perfis/admin.jpg?token=xyz';
      mockUseSignedUrl.mockReturnValue({
        url: signedUrl,
        loading: false,
        error: false,
      });
      const propsWithPhoto = {
        ...defaultProps,
        userData: {
          ...defaultProps.userData,
          foto_url: 'perfis/admin.jpg',
        },
      };
      const { UNSAFE_getByType } = render(
        <DashboardMobile {...propsWithPhoto} />,
      );
      const image = UNSAFE_getByType(Image);
      expect(image).toBeTruthy();
      expect(image.props.source.uri).toBe(signedUrl);
    });

    it('deve mostrar iniciais quando foto_url é null e hook retorna null', () => {
      mockUseSignedUrl.mockReturnValue({
        url: null,
        loading: false,
        error: false,
      });
      const { getByText } = render(<DashboardMobile {...defaultProps} />);
      // First name initial of 'Admin User' → 'A'
      expect(getByText('A')).toBeTruthy();
    });
  });

  describe('Empty state', () => {
    it('deve mostrar empty state quando não há rotas', () => {
      const { getByText, getByTestId } = render(
        <DashboardMobile {...defaultProps} rotas={[]} />,
      );

      expect(getByTestId('empty-state')).toBeTruthy();
      expect(
        getByText('Nenhuma rota em este mês (01/11 a 30/11)'),
      ).toBeTruthy();
      expect(
        getByText('Escolha outro período ou crie uma nova rota'),
      ).toBeTruthy();
    });

    it('deve ter botão de ação no empty state', () => {
      const { getByTestId, getByText } = render(
        <DashboardMobile {...defaultProps} rotas={[]} />,
      );

      expect(getByText('Nova rota de entrega')).toBeTruthy();
      fireEvent.press(getByTestId('empty-state-action'));
      expect(mockPush).toHaveBeenCalledWith('/gestor/nova-entrega');
    });
  });

  describe('Navigation', () => {
    it('deve navegar para nova entrega ao clicar no botão', () => {
      const { getByText } = render(<DashboardMobile {...defaultProps} />);

      fireEvent.press(getByText('Nova rota'));

      expect(mockPush).toHaveBeenCalledWith('/gestor/nova-entrega');
    });

    it('deve navegar para motoristas ao clicar no botão', () => {
      const { getByText } = render(<DashboardMobile {...defaultProps} />);

      fireEvent.press(getByText('Motoristas'));

      expect(mockPush).toHaveBeenCalledWith('/gestor/motoristas');
    });

    it('deve navegar para gestão de rotas ao clicar no botão', () => {
      const { getByText } = render(<DashboardMobile {...defaultProps} />);

      fireEvent.press(getByText('Gestão'));

      expect(mockPush).toHaveBeenCalledWith('/gestor/gestao-rotas');
    });

    it('deve navegar para incidentes ao clicar no stats card', () => {
      const { getByTestId } = render(<DashboardMobile {...defaultProps} />);

      // O card de incidentes é clicável
      fireEvent.press(getByTestId('stats-Incidentes Abertos'));

      expect(mockPush).toHaveBeenCalledWith('/gestor/incidentes');
    });

    it('deve navegar para mapa-rota ao clicar em uma rota', () => {
      const { getByTestId } = render(<DashboardMobile {...defaultProps} />);

      fireEvent.press(getByTestId('rota-card-rota-1'));

      expect(mockPush).toHaveBeenCalledWith('/gestor/mapa-rota?id=rota-1');
    });
  });

  describe('Seções', () => {
    it('deve mostrar seção Ações Rápidas', () => {
      const { getByText } = render(<DashboardMobile {...defaultProps} />);

      expect(getByText('Ações Rápidas')).toBeTruthy();
    });

    it('a seção de rotas diz o período, não "de Hoje"', () => {
      const { getByText, getByTestId, queryByText } = render(
        <DashboardMobile {...defaultProps} />,
      );

      expect(getByText('Rotas')).toBeTruthy();
      expect(getByTestId('secao-rotas-periodo')).toHaveTextContent(
        'Este mês (01/11 a 30/11)',
      );
      expect(queryByText('Rotas de Hoje')).toBeNull();
    });

    it('o período se escolhe ali mesmo, fora do modal de filtros', () => {
      const onPeriodoChange = jest.fn();
      const { getByTestId } = render(
        <DashboardMobile {...defaultProps} onPeriodoChange={onPeriodoChange} />,
      );

      fireEvent.press(getByTestId('secao-rotas-periodo'));
      fireEvent.press(getByTestId('secao-rotas-periodo-item-mes_passado'));

      expect(onPeriodoChange).toHaveBeenCalledWith({ tipo: 'mes_passado' });
    });

    it('com a lista cortada ("Todo o período"), avisa que mostra as primeiras 500, da data mais nova para a mais antiga', () => {
      const { getByTestId } = render(
        <DashboardMobile
          {...defaultProps}
          periodo={{ tipo: 'todo' }}
          listaCortada
        />,
      );

      expect(getByTestId('aviso-lista-cortada')).toHaveTextContent(
        'Mostrando as primeiras 500 rotas, da data mais nova para a mais antiga. Escolha um período para ver as demais.',
      );
    });
  });

  describe('Stats values', () => {
    it('deve mostrar valor total hoje', () => {
      const { getByText } = render(<DashboardMobile {...defaultProps} />);

      expect(getByText('8')).toBeTruthy(); // todayStats.totalHoje
    });

    it('deve mostrar valor em andamento', () => {
      const { getByText } = render(<DashboardMobile {...defaultProps} />);

      expect(getByText('3')).toBeTruthy(); // stats.emAndamento
    });

    it('deve mostrar valor concluídas', () => {
      const { getByText } = render(<DashboardMobile {...defaultProps} />);

      expect(getByText('5')).toBeTruthy(); // stats.concluidas
    });

    it('deve mostrar distância formatada com vírgula, não com ponto', () => {
      // Este teste afirmava `150.5` e citava o `toFixed` no comentário: ele
      // travou o defeito no lugar. App em pt-BR usa `formatarDecimal`.
      const { getByText, queryByText } = render(
        <DashboardMobile {...defaultProps} />,
      );

      expect(getByText('150,5')).toBeTruthy();
      expect(queryByText('150.5')).toBeNull();
    });
  });

  describe('FlatList', () => {
    it('deve ter testID no FlatList', () => {
      const { getByTestId } = render(<DashboardMobile {...defaultProps} />);

      expect(getByTestId('dashboard-flat-list')).toBeTruthy();
    });
  });
  describe('Incidentes indisponíveis', () => {
    it('contagem nula aparece como "—", não 0', () => {
      const { getByTestId } = render(
        <DashboardMobile
          {...(defaultProps as any)}
          stats={{ ...defaultProps.stats, incidentesAbertos: null }}
        />,
      );
      expect(getByTestId('stats-Incidentes Abertos')).toHaveTextContent(/—/);
    });
  });

  describe('Erro de carga', () => {
    it('mostra o aviso e "Tentar novamente" chama onRefresh', () => {
      const onRefresh = jest.fn();
      const { getByText } = render(
        <DashboardMobile
          {...(defaultProps as any)}
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
