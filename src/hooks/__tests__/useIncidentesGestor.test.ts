/**
 * Tests for useIncidentesGestor.ts
 * Hook para gerenciamento de incidentes (tela do Gestor)
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';

import type { Theme } from '@/utils/styles';

import { useIncidentesGestor, Incidente } from '../useIncidentesGestor';

// ============================================================================
// Mocks
// ============================================================================

// Mock useUser
const mockUserData = {
  id: 'user-123',
  unidade_id: 'unidade-1',
  papel: 'gestor',
  unidades: {
    nome: 'Unidade Central',
  },
};

jest.mock('../useUser', () => ({
  useUser: () => ({
    userData: mockUserData,
  }),
}));

// Mock useUnidadeAtiva
const mockUseUnidadeAtiva = {
  unidadeAtiva: 'unidade-1',
  loading: false,
};

jest.mock('../useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => mockUseUnidadeAtiva,
}));

// Mock useToast
const mockShowToast = jest.fn();
const mockHideToast = jest.fn();

jest.mock('../useToast', () => ({
  useToast: () => ({
    toast: { visible: false, message: '', type: 'success', duration: 3000 },
    showToast: mockShowToast,
    hideToast: mockHideToast,
  }),
}));

// Mock Supabase
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// ============================================================================
// Mock Theme
// ============================================================================

const mockTheme: Theme = {
  colors: {
    primary: '#FF8C42',
    primaryDark: '#E67A32',
    primaryLight: '#FFA65C',
    primaryBg: '#FFF5EE',
    secondary: '#4A90E2',
    secondaryDark: '#3A7BCB',
    secondaryLight: '#6AA5E9',
    secondaryBg: '#EBF4FF',
    accent: '#FF8C42',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    border: '#E5E7EB',
    divider: '#E5E7EB',
    text: '#1F2937',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    textInverse: '#FFFFFF',
    success: '#10B981',
    successDark: '#059669',
    successBg: '#D1FAE5',
    warning: '#F59E0B',
    warningText: '#92400E',
    warningBg: '#FEF3C7',
    error: '#EF4444',
    errorDark: '#DC2626',
    errorBg: '#FEE2E2',
    info: '#3B82F6',
    infoBg: '#DBEAFE',
    white: '#FFFFFF',
    black: '#000000',
    gray50: '#F9FAFB',
    gray100: '#F3F4F6',
    gray200: '#E5E7EB',
    gray300: '#D1D5DB',
    gray400: '#9CA3AF',
    gray500: '#6B7280',
    gray600: '#4B5563',
    gray700: '#374151',
    gray800: '#1F2937',
    gray900: '#111827',
    disabled: '#D1D5DB',
    overlay: 'rgba(0, 0, 0, 0.5)',
    transparent: 'transparent',
    purple: '#8B5CF6',
    purple600: '#7C3AED',
    blue50: '#EFF6FF',
    blue100: '#DBEAFE',
    blue500: '#3B82F6',
    green50: '#F0FDF4',
    green100: '#DCFCE7',
    green500: '#22C55E',
    red50: '#FEF2F2',
    red100: '#FEE2E2',
    red500: '#EF4444',
    yellow100: '#FEF3C7',
    yellow500: '#EAB308',
    indigo100: '#E0E7FF',
    orange: '#F97316',
    blue300: '#93C5FD',
    green800: '#166534',
    warningLight: '#FEF3C7',
    warningDark: '#B45309',
    errorLight: '#FEE2E2',
    successLight: '#D1FAE5',
    whatsapp: '#25D366',
    kpiTotalHoje: '#4A90E2',
    kpiEmAndamento: '#F59E0B',
    kpiConcluidas: '#10B981',
    kpiDistancia: '#8B5CF6',
    kpiIncidentes: '#EF4444',
    incident: {
      accident: '#EF4444',
      absent: '#F59E0B',
      wrongAddress: '#8B5CF6',
      blocked: '#6B7280',
      vehicle: '#3B82F6',
      weather: '#06B6D4',
      other: '#9CA3AF',
    },
  },
  spacing: {
    '0': 0,
    '0.5': 2,
    '1': 4,
    '1.5': 6,
    '2': 8,
    '2.5': 10,
    '3': 12,
    '3.5': 14,
    '4': 16,
    '5': 20,
    '6': 24,
    '7': 28,
    '8': 32,
    '10': 40,
    '12': 48,
    '14': 56,
    '16': 64,
    '20': 80,
    '24': 96,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
    '6xl': 64,
  },
  typography: {
    fontDisplay: 'Viga',
    fontSans: 'NunitoSans_400Regular',
    fontSansLight: 'NunitoSans_300Light',
    fontSansMedium: 'NunitoSans_500Medium',
    fontSansSemiBold: 'NunitoSans_600SemiBold',
    fontSansBold: 'NunitoSans_700Bold',
    fontSansExtraBold: 'NunitoSans_800ExtraBold',
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
    },
    xs: 12,
    sm: 14,
    md: 16,
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 10,
    lg: 12,
    xl: 16,
    xxl: 20,
    '2xl': 20,
    '3xl': 24,
    '4xl': 32,
    full: 9999,
  },
  shadows: {
    sm: {},
    md: {},
    lg: {},
    card: {},
  },
  motion: {
    duration: { fast: 150, normal: 300, slow: 500 },
    easing: {
      easeOut: 'ease-out',
      easeIn: 'ease-in',
      easeInOut: 'ease-in-out',
    },
  },
  layout: { sidebarWidth: 280, containerMaxWidth: 1200 },
  zIndex: {
    hide: -1,
    base: 0,
    dropdown: 1000,
    sticky: 1100,
    fixed: 1200,
    overlay: 1300,
    modal: 1400,
    popover: 1500,
    tooltip: 1600,
    toast: 1700,
    banner: 1800,
    max: 9999,
  },
  desktop: {
    input: { height: 40, paddingHorizontal: 12, fontSize: 14 },
    button: { height: 40, paddingHorizontal: 16, fontSize: 14 },
    field: { marginBottom: 16 },
    section: { padding: 24, gap: 16 },
    modal: {
      headerPadding: 20,
      bodyPadding: 24,
      footerPadding: 20,
      footerGap: 12,
      titleFontSize: 18,
      closeButtonSize: 32,
    },
    dialog: {
      maxWidth: 400,
      containerPadding: 24,
      iconCircleSize: 56,
      iconSize: 28,
      titleFontSize: 18,
      messageFontSize: 14,
      buttonHeight: 40,
      buttonPaddingV: 10,
      buttonPaddingH: 20,
      buttonGap: 12,
    },
  },
  components: {
    button: {
      size: {
        small: {
          height: 32,
          paddingVertical: 6,
          paddingHorizontal: 12,
          fontSize: 12,
        },
        medium: {
          height: 40,
          paddingVertical: 10,
          paddingHorizontal: 16,
          fontSize: 14,
        },
        large: {
          height: 48,
          paddingVertical: 14,
          paddingHorizontal: 20,
          fontSize: 16,
        },
      },
      radius: 8,
    },
    input: {
      size: {
        small: { height: 32, paddingHorizontal: 10, fontSize: 12 },
        medium: { height: 40, paddingHorizontal: 12, fontSize: 14 },
        large: { height: 48, paddingHorizontal: 14, fontSize: 16 },
      },
      radius: 8,
    },
    modal: { headerPadding: 16, bodyPadding: 20, footerPadding: 16 },
    statsCard: {
      padding: 16,
      radius: 12,
      valueFontSize: 24,
      labelFontSize: 12,
      labelLetterSpacing: 0.5,
      iconSize: 20,
      iconContainerSize: 40,
      iconContainerRadius: 10,
      changeFontSize: 12,
    },
    table: {
      headerFontSize: 12,
      rowFontSize: 14,
      cellPaddingX: 12,
      cellPaddingY: 10,
      badgePaddingX: 8,
      badgePaddingY: 4,
      actionButtonPaddingX: 8,
      actionButtonPaddingY: 4,
      actionButtonFontSize: 12,
      paginationFontSize: 12,
    },
    card: { padding: { none: 0, small: 12, medium: 16, large: 20 } },
    sidebar: {
      logoHeight: 40,
      itemHeight: 44,
      itemFontSize: 14,
      itemIconSize: 20,
      sectionTitleFontSize: 11,
      footerFontSize: 12,
    },
    pageLayout: {
      contentPadding: 24,
      headerTitleFontSize: 24,
      headerSubtitleFontSize: 14,
      breadcrumbFontSize: 12,
    },
    map: {
      markerSize: 32,
      clusterSize: 40,
      controlButtonSize: 40,
      infoBoxPadding: 12,
    },
    badge: {
      size: {
        small: { paddingHorizontal: 6, paddingVertical: 2, fontSize: 10 },
        medium: { paddingHorizontal: 8, paddingVertical: 4, fontSize: 12 },
        large: { paddingHorizontal: 10, paddingVertical: 6, fontSize: 14 },
      },
    },
    avatar: { size: { sm: 32, md: 40, lg: 48, xl: 64 } },
    dialog: {
      maxWidth: 320,
      containerPadding: 20,
      iconCircleSize: 48,
      iconSize: 24,
      titleFontSize: 16,
      messageFontSize: 14,
      buttonHeight: 44,
      buttonPaddingV: 12,
      buttonPaddingH: 16,
      buttonGap: 12,
    },
    drawer: {
      avatarSize: 48,
      menuIconSize: 20,
      menuIconWidth: 24,
      headerPadding: 16,
      itemPaddingV: 12,
      footerPadding: 16,
    },
    errorBoundary: {
      containerPadding: 16,
      cardPadding: 24,
      cardBorderRadius: 12,
      iconSize: 48,
      titleFontSize: 18,
      messageFontSize: 14,
      errorDetailFontSize: 12,
      buttonPaddingV: 12,
      buttonPaddingH: 24,
      buttonBorderRadius: 8,
      buttonFontSize: 14,
      buttonIconSize: 16,
    },
    desktopCard: {
      borderRadius: 12,
      headerPadding: 16,
      contentPadding: 16,
      iconContainerSize: 40,
      iconContainerRadius: 10,
      iconSize: 20,
      titleFontSize: 14,
      subtitleFontSize: 12,
      headerGap: 8,
      actionsGap: 8,
    },
    connectivityBanner: {
      paddingV: 8,
      messageFontSize: 14,
      badgePaddingH: 8,
      badgePaddingV: 4,
      badgeFontSize: 12,
      badgeBorderRadius: 4,
      dotSize: 8,
    },
    sectionHeader: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.5,
      marginBottom: 8,
      paddingHorizontal: 4,
      textTransform: 'uppercase',
    },
    hint: { fontSize: 12, lineHeight: 16, marginTop: 4 },
    minTouchTarget: 44,
    confirmModal: {
      iconCircleSize: 56,
      iconSize: 28,
      titleFontSize: 18,
      messageFontSize: 14,
      messageLineHeight: 20,
      destructiveLabelFontSize: 14,
      destructiveInputFontSize: 14,
      destructiveInputPaddingV: 10,
      compact: {
        iconCircleSize: 48,
        iconSize: 24,
        iconMarginRight: 12,
        titleFontSize: 16,
        messageFontSize: 14,
        messageLineHeight: 18,
        destructiveLabelFontSize: 12,
        destructiveLabelMarginBottom: 6,
        destructiveInputFontSize: 14,
        destructiveInputPaddingV: 8,
      },
    },
  },
};

// ============================================================================
// Mock Data
// ============================================================================

const mockIncidente: Incidente = {
  id: 'inc-1',
  categoria: 'accident',
  descricao: 'Acidente na rua principal',
  endereco: 'Rua Principal, 123',
  status: 'aberto',
  foto_url: 'https://example.com/foto.jpg',
  created_at: '2025-01-01T10:00:00Z',
  motorista_nome: 'Joao Silva',
  motorista_id: 'mot-1',
  unidade_nome: 'Unidade Central',
  rota_id: 'rota-1',
  rota_data: '2025-01-01',
  parada_endereco: 'Rua das Flores, 456',
  observacoes_gestao: null,
};

const mockIncidente2: Incidente = {
  id: 'inc-2',
  categoria: 'absent',
  descricao: 'Cliente ausente',
  endereco: 'Rua Secundaria, 789',
  status: 'em_analise',
  foto_url: null,
  created_at: '2025-01-02T14:00:00Z',
  motorista_nome: 'Maria Santos',
  motorista_id: 'mot-2',
  unidade_nome: 'Unidade Central',
  rota_id: 'rota-2',
  rota_data: '2025-01-02',
  parada_endereco: null,
  observacoes_gestao: 'Em analise pelo gestor',
};

const _mockIncidente3: Incidente = {
  id: 'inc-3',
  categoria: 'wrong_address',
  descricao: 'Endereco incorreto',
  endereco: 'Rua Errada, 000',
  status: 'resolvido',
  foto_url: null,
  created_at: '2025-01-03T16:00:00Z',
  motorista_nome: 'Joao Silva',
  motorista_id: 'mot-1',
  unidade_nome: 'Unidade Central',
  rota_id: null,
  rota_data: null,
  parada_endereco: null,
  observacoes_gestao: 'Resolvido com sucesso',
};

const mockVinculacoes = [{ usuario_id: 'mot-1' }, { usuario_id: 'mot-2' }];

const mockIncidentesFromDB = [
  {
    id: 'inc-1',
    categoria: 'accident',
    descricao: 'Acidente na rua principal',
    endereco: 'Rua Principal, 123',
    status: 'aberto',
    foto_url: 'https://example.com/foto.jpg',
    created_at: '2025-01-01T10:00:00Z',
    observacoes_gestao: null,
    motorista_id: 'mot-1',
    motorista: { nome: 'Joao Silva' },
    rota: { id: 'rota-1', data: '2025-01-01' },
    parada: { endereco: 'Rua das Flores, 456' },
  },
  {
    id: 'inc-2',
    categoria: 'absent',
    descricao: 'Cliente ausente',
    endereco: 'Rua Secundaria, 789',
    status: 'em_analise',
    foto_url: null,
    created_at: '2025-01-02T14:00:00Z',
    observacoes_gestao: 'Em analise pelo gestor',
    motorista_id: 'mot-2',
    motorista: { nome: 'Maria Santos' },
    rota: { id: 'rota-2', data: '2025-01-02' },
    parada: null,
  },
];

// ============================================================================
// Tests
// ============================================================================

describe('useIncidentesGestor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUnidadeAtiva.unidadeAtiva = 'unidade-1';
    mockUseUnidadeAtiva.loading = false;
  });

  // ==========================================================================
  // Inicializacao
  // ==========================================================================

  describe('Inicializacao', () => {
    it('deve iniciar com valores padrao', async () => {
      // Setup: retornar vinculacoes e incidentes vazios
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockIn = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockResolvedValue({ data: [], error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'usuario_unidades') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return {
          select: mockSelect,
          eq: mockEq,
          in: mockIn,
          order: mockOrder,
        };
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      // Valores iniciais
      expect(result.current.incidentes).toEqual([]);
      expect(result.current.filtroStatus).toBe('todos');
      expect(result.current.filtroCategoria).toBe('todos');
      expect(result.current.incidenteSelecionado).toBeNull();
      expect(result.current.showDetalhesModal).toBe(false);
      expect(result.current.showAlterarStatusModal).toBe(false);
      expect(result.current.showHistoricoMotoristaModal).toBe(false);
      expect(result.current.novoStatus).toBe('');
      expect(result.current.observacoes).toBe('');
      expect(result.current.atualizando).toBe(false);
      expect(result.current.motoristaSelecionado).toBeNull();
      expect(result.current.incidentesMotorista).toEqual([]);
    });
  });

  // ==========================================================================
  // categoriaLabels e statusLabels
  // ==========================================================================

  describe('categoriaLabels e statusLabels', () => {
    it('deve retornar categoriaLabels corretos baseados no tema', () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      expect(result.current.categoriaLabels).toBeDefined();
      expect(result.current.categoriaLabels.accident).toEqual({
        label: 'Acidente/Incidente',
        icon: 'warning',
        color: mockTheme.colors.incident.accident,
      });
      expect(result.current.categoriaLabels.absent).toEqual({
        label: 'Cliente ausente',
        icon: 'home-outline',
        color: mockTheme.colors.incident.absent,
      });
      expect(result.current.categoriaLabels.wrong_address).toEqual({
        label: 'Endereço incorreto',
        icon: 'location-outline',
        color: mockTheme.colors.incident.wrongAddress,
      });
      expect(result.current.categoriaLabels.blocked).toEqual({
        label: 'Acesso bloqueado',
        icon: 'lock-closed-outline',
        color: mockTheme.colors.incident.blocked,
      });
      expect(result.current.categoriaLabels.vehicle).toEqual({
        label: 'Problema no veículo',
        icon: 'car-outline',
        color: mockTheme.colors.incident.vehicle,
      });
      expect(result.current.categoriaLabels.other).toEqual({
        label: 'Outros',
        icon: 'ellipsis-horizontal-outline',
        color: mockTheme.colors.incident.other,
      });
    });

    it('deve retornar statusLabels corretos baseados no tema', () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      expect(result.current.statusLabels).toBeDefined();
      expect(result.current.statusLabels.aberto).toEqual({
        label: 'Aberto',
        color: mockTheme.colors.error,
      });
      expect(result.current.statusLabels.em_analise).toEqual({
        label: 'Em Análise',
        color: mockTheme.colors.warning,
      });
      expect(result.current.statusLabels.resolvido).toEqual({
        label: 'Resolvido',
        color: mockTheme.colors.success,
      });
      expect(result.current.statusLabels.fechado).toEqual({
        label: 'Fechado',
        color: mockTheme.colors.gray500,
      });
    });
  });

  // ==========================================================================
  // fetchIncidentes
  // ==========================================================================

  describe('fetchIncidentes', () => {
    it('deve retornar early se unidadeLoading for true', async () => {
      mockUseUnidadeAtiva.loading = true;

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      await act(async () => {
        await result.current.fetchIncidentes();
      });

      // Nao deve chamar supabase
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('deve retornar early se unidadeAtiva for null', async () => {
      mockUseUnidadeAtiva.unidadeAtiva = null;

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      await act(async () => {
        await result.current.fetchIncidentes();
      });

      // Pode ter chamado na inicializacao, mas fetchIncidentes direto nao deve
      expect(result.current.incidentes).toEqual([]);
    });

    it('deve buscar motoristas da unidade e incidentes filtrados', async () => {
      const mockSelectVinc = jest.fn().mockReturnThis();
      const _mockEqVinc = jest.fn().mockReturnThis();

      const mockSelectInc = jest.fn().mockReturnThis();
      const mockEqInc = jest.fn().mockReturnThis();
      const mockInInc = jest.fn().mockReturnThis();
      const mockOrderInc = jest.fn().mockResolvedValue({
        data: mockIncidentesFromDB,
        error: null,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'usuario_unidades') {
          return {
            select: mockSelectVinc,
            eq: () => ({
              eq: () => ({
                eq: jest.fn().mockResolvedValue({
                  data: mockVinculacoes,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: mockSelectInc,
          eq: mockEqInc,
          in: mockInInc,
          order: mockOrderInc,
        };
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFrom).toHaveBeenCalledWith('usuario_unidades');
      expect(mockFrom).toHaveBeenCalledWith('incidentes');
    });

    it('deve setar incidentes vazios quando nao ha motoristas', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'usuario_unidades') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: () => ({
              eq: () => ({
                eq: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.incidentes).toEqual([]);
    });

    it('deve mostrar toast de erro quando query falha', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'usuario_unidades') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: () => ({
              eq: () => ({
                eq: jest.fn().mockResolvedValue({
                  data: mockVinculacoes,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        };
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Erro ao carregar incidentes',
        'error',
      );
    });
  });

  // ==========================================================================
  // resumoGeral
  // ==========================================================================

  describe('resumoGeral', () => {
    it('deve calcular estatisticas corretamente', async () => {
      // Simula incidentes ja carregados via fetchIncidentes
      mockFrom.mockImplementation((table: string) => {
        if (table === 'usuario_unidades') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: () => ({
              eq: () => ({
                eq: jest.fn().mockResolvedValue({
                  data: mockVinculacoes,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [
              { ...mockIncidentesFromDB[0], status: 'aberto' },
              { ...mockIncidentesFromDB[1], status: 'em_analise' },
              {
                ...mockIncidentesFromDB[0],
                id: 'inc-3',
                status: 'resolvido',
                categoria: 'vehicle',
              },
              {
                ...mockIncidentesFromDB[0],
                id: 'inc-4',
                status: 'fechado',
                categoria: 'blocked',
              },
            ],
            error: null,
          }),
        };
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.resumoGeral.total).toBe(4);
      expect(result.current.resumoGeral.abertos).toBe(1);
      expect(result.current.resumoGeral.emAnalise).toBe(1);
      expect(result.current.resumoGeral.resolvidos).toBe(1);
      expect(result.current.resumoGeral.fechados).toBe(1);
      expect(result.current.resumoGeral.porCategoria).toHaveProperty(
        'accident',
      );
      expect(result.current.resumoGeral.porCategoria).toHaveProperty('absent');
    });

    it('deve retornar zeros quando nao ha incidentes', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'usuario_unidades') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: () => ({
              eq: () => ({
                eq: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.resumoGeral).toEqual({
        total: 0,
        abertos: 0,
        emAnalise: 0,
        resolvidos: 0,
        fechados: 0,
        porCategoria: {},
      });
    });
  });

  // ==========================================================================
  // estatisticasMotorista
  // ==========================================================================

  describe('estatisticasMotorista', () => {
    it('deve agrupar incidentes por motorista', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'usuario_unidades') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: () => ({
              eq: () => ({
                eq: jest.fn().mockResolvedValue({
                  data: mockVinculacoes,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [
              {
                ...mockIncidentesFromDB[0],
                status: 'aberto',
                motorista_id: 'mot-1',
              },
              {
                ...mockIncidentesFromDB[0],
                id: 'inc-2',
                status: 'resolvido',
                motorista_id: 'mot-1',
              },
              {
                ...mockIncidentesFromDB[1],
                status: 'em_analise',
                motorista_id: 'mot-2',
              },
            ],
            error: null,
          }),
        };
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.estatisticasMotorista).toHaveLength(2);

      const mot1Stats = result.current.estatisticasMotorista.find(
        (s) => s.id === 'mot-1',
      );
      expect(mot1Stats).toBeDefined();
      expect(mot1Stats?.total).toBe(2);
      expect(mot1Stats?.abertos).toBe(1);
      expect(mot1Stats?.resolvidos).toBe(1);

      const mot2Stats = result.current.estatisticasMotorista.find(
        (s) => s.id === 'mot-2',
      );
      expect(mot2Stats).toBeDefined();
      expect(mot2Stats?.total).toBe(1);
      expect(mot2Stats?.abertos).toBe(1);
      expect(mot2Stats?.resolvidos).toBe(0);
    });

    it('deve ordenar por total e limitar a 5 motoristas', async () => {
      const manyMotoristas = Array.from({ length: 10 }, (_, i) => ({
        ...mockIncidentesFromDB[0],
        id: `inc-${i}`,
        motorista_id: `mot-${i}`,
        motorista: { nome: `Motorista ${i}` },
      }));

      // Adicionar mais incidentes para mot-0 para garantir ordenacao
      const extraIncidentes = Array.from({ length: 5 }, (_, i) => ({
        ...mockIncidentesFromDB[0],
        id: `inc-extra-${i}`,
        motorista_id: 'mot-0',
        motorista: { nome: 'Motorista 0' },
      }));

      mockFrom.mockImplementation((table: string) => {
        if (table === 'usuario_unidades') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: () => ({
              eq: () => ({
                eq: jest.fn().mockResolvedValue({
                  data: mockVinculacoes,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [...manyMotoristas, ...extraIncidentes],
            error: null,
          }),
        };
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Deve ter no maximo 5 motoristas
      expect(result.current.estatisticasMotorista.length).toBeLessThanOrEqual(
        5,
      );

      // O primeiro deve ser mot-0 (mais incidentes)
      expect(result.current.estatisticasMotorista[0].id).toBe('mot-0');
    });
  });

  // ==========================================================================
  // handleVerDetalhes
  // ==========================================================================

  describe('handleVerDetalhes', () => {
    it('deve abrir modal com incidente selecionado', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      act(() => {
        result.current.handleVerDetalhes(mockIncidente);
      });

      expect(result.current.incidenteSelecionado).toEqual(mockIncidente);
      expect(result.current.showDetalhesModal).toBe(true);
      expect(result.current.fotoLoading).toBe(true);
      expect(result.current.fotoError).toBe(false);
    });
  });

  // ==========================================================================
  // handleAlterarStatus
  // ==========================================================================

  describe('handleAlterarStatus', () => {
    it('deve abrir modal de alteracao de status com dados do incidente', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      act(() => {
        result.current.handleAlterarStatus(mockIncidente2);
      });

      expect(result.current.incidenteSelecionado).toEqual(mockIncidente2);
      expect(result.current.novoStatus).toBe('em_analise');
      expect(result.current.observacoes).toBe('Em analise pelo gestor');
      expect(result.current.showAlterarStatusModal).toBe(true);
    });

    it('deve usar string vazia para observacoes quando null', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      act(() => {
        result.current.handleAlterarStatus(mockIncidente); // observacoes_gestao = null
      });

      expect(result.current.observacoes).toBe('');
    });
  });

  // ==========================================================================
  // confirmarAlterarStatus
  // ==========================================================================

  describe('confirmarAlterarStatus', () => {
    it('deve atualizar status do incidente com sucesso', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'incidentes') {
          return {
            update: mockUpdate,
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (table === 'usuario_unidades') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: () => ({
              eq: () => ({
                eq: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      // Primeiro, abrir o modal com um incidente
      act(() => {
        result.current.handleAlterarStatus(mockIncidente);
      });

      // Mudar o status
      act(() => {
        result.current.setNovoStatus('resolvido');
        result.current.setObservacoes('Problema resolvido');
      });

      // Confirmar a alteracao
      await act(async () => {
        await result.current.confirmarAlterarStatus();
      });

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith(
        'Status atualizado com sucesso',
        'success',
      );
      expect(result.current.showAlterarStatusModal).toBe(false);
    });

    it('deve retornar early se nao houver incidente selecionado', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      await act(async () => {
        await result.current.confirmarAlterarStatus();
      });

      // Nao deve ter chamado update
      expect(mockFrom).not.toHaveBeenCalledWith('incidentes');
    });

    it('deve mostrar toast de erro quando update falha', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          error: { message: 'Update failed' },
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'incidentes') {
          return {
            update: mockUpdate,
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (table === 'usuario_unidades') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: () => ({
              eq: () => ({
                eq: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      act(() => {
        result.current.handleAlterarStatus(mockIncidente);
      });

      await act(async () => {
        await result.current.confirmarAlterarStatus();
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Erro ao atualizar status',
        'error',
      );
    });
  });

  // ==========================================================================
  // handleCloseDetalhes e handleCloseStatus (via setters)
  // ==========================================================================

  describe('Fechar modais', () => {
    it('deve fechar modal de detalhes via setShowDetalhesModal', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      // Abrir modal
      act(() => {
        result.current.handleVerDetalhes(mockIncidente);
      });

      expect(result.current.showDetalhesModal).toBe(true);

      // Fechar modal
      act(() => {
        result.current.setShowDetalhesModal(false);
      });

      expect(result.current.showDetalhesModal).toBe(false);
    });

    it('deve fechar modal de status via setShowAlterarStatusModal', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      // Abrir modal
      act(() => {
        result.current.handleAlterarStatus(mockIncidente);
      });

      expect(result.current.showAlterarStatusModal).toBe(true);

      // Fechar modal
      act(() => {
        result.current.setShowAlterarStatusModal(false);
      });

      expect(result.current.showAlterarStatusModal).toBe(false);
    });
  });

  // ==========================================================================
  // Filtros
  // ==========================================================================

  describe('Filtros', () => {
    it('deve atualizar filtroStatus', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      expect(result.current.filtroStatus).toBe('todos');

      act(() => {
        result.current.setFiltroStatus('aberto');
      });

      expect(result.current.filtroStatus).toBe('aberto');

      act(() => {
        result.current.setFiltroStatus('resolvido');
      });

      expect(result.current.filtroStatus).toBe('resolvido');
    });

    it('deve atualizar filtroCategoria', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      expect(result.current.filtroCategoria).toBe('todos');

      act(() => {
        result.current.setFiltroCategoria('accident');
      });

      expect(result.current.filtroCategoria).toBe('accident');

      act(() => {
        result.current.setFiltroCategoria('vehicle');
      });

      expect(result.current.filtroCategoria).toBe('vehicle');
    });
  });

  // ==========================================================================
  // Foto handlers
  // ==========================================================================

  describe('Foto handlers', () => {
    it('deve atualizar estado ao carregar foto', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      // Abrir modal primeiro
      act(() => {
        result.current.handleVerDetalhes(mockIncidente);
      });

      expect(result.current.fotoLoading).toBe(true);

      act(() => {
        result.current.handleFotoLoad();
      });

      expect(result.current.fotoLoading).toBe(false);
      expect(result.current.fotoError).toBe(false);
    });

    it('deve atualizar estado ao erro de foto', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      act(() => {
        result.current.handleVerDetalhes(mockIncidente);
      });

      act(() => {
        result.current.handleFotoError();
      });

      expect(result.current.fotoLoading).toBe(false);
      expect(result.current.fotoError).toBe(true);
    });

    it('deve resetar estado da foto ao tentar novamente', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      act(() => {
        result.current.handleVerDetalhes(mockIncidente);
      });

      act(() => {
        result.current.handleFotoError();
      });

      act(() => {
        result.current.handleFotoRetry();
      });

      expect(result.current.fotoLoading).toBe(true);
      expect(result.current.fotoError).toBe(false);
    });
  });

  // ==========================================================================
  // handleVerHistoricoMotorista
  // ==========================================================================

  describe('handleVerHistoricoMotorista', () => {
    it('deve abrir modal com historico do motorista', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'usuario_unidades') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: () => ({
              eq: () => ({
                eq: jest.fn().mockResolvedValue({
                  data: mockVinculacoes,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: mockIncidentesFromDB,
            error: null,
          }),
        };
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.handleVerHistoricoMotorista('mot-1', 'Joao Silva');
      });

      expect(result.current.motoristaSelecionado).toEqual({
        id: 'mot-1',
        nome: 'Joao Silva',
      });
      expect(result.current.showHistoricoMotoristaModal).toBe(true);
      // Deve filtrar incidentes do motorista
      expect(
        result.current.incidentesMotorista.every(
          (i) => i.motorista_id === 'mot-1',
        ),
      ).toBe(true);
    });
  });

  // ==========================================================================
  // formatDate
  // ==========================================================================

  describe('formatDate', () => {
    it('deve formatar data corretamente', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      const formatted = result.current.formatDate('2025-01-15T14:30:00Z');

      // O formato exato depende do locale do sistema, mas deve incluir dia/mes/ano/hora/minuto
      expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(formatted).toMatch(/\d{2}:\d{2}/);
    });
  });

  // ==========================================================================
  // Toast state e hideToast
  // ==========================================================================

  describe('Toast', () => {
    it('deve expor toastState e hideToast', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      expect(result.current.toastState).toBeDefined();
      expect(result.current.hideToast).toBeDefined();

      act(() => {
        result.current.hideToast();
      });

      expect(mockHideToast).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Setters diretos
  // ==========================================================================

  describe('Setters', () => {
    it('deve atualizar novoStatus via setNovoStatus', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      act(() => {
        result.current.setNovoStatus('em_analise');
      });

      expect(result.current.novoStatus).toBe('em_analise');
    });

    it('deve atualizar observacoes via setObservacoes', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      act(() => {
        result.current.setObservacoes('Nova observacao');
      });

      expect(result.current.observacoes).toBe('Nova observacao');
    });

    it('deve fechar modal de historico via setShowHistoricoMotoristaModal', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useIncidentesGestor(mockTheme));

      act(() => {
        result.current.setShowHistoricoMotoristaModal(true);
      });

      expect(result.current.showHistoricoMotoristaModal).toBe(true);

      act(() => {
        result.current.setShowHistoricoMotoristaModal(false);
      });

      expect(result.current.showHistoricoMotoristaModal).toBe(false);
    });
  });
});
