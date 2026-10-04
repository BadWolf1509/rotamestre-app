import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { NavigationMode } from '../NavigationMode';

// Access global useAlert mock
declare global {
  var mockUseAlert: {
    showAlert: jest.Mock;
    showSuccess: jest.Mock;
    showWarning: jest.Mock;
    showError: jest.Mock;
    showConfirm: jest.Mock;
    showDestructive: jest.Mock;
    hideAlert: jest.Mock;
    isVisible: boolean;
    AlertDialog: null;
  };
}

// Mock expo-location
jest.mock('expo-location', () => ({
  watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
  requestForegroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: 'granted', canAskAgain: true }),
  Accuracy: {
    BestForNavigation: 6,
  },
}));

// Mock expo-keep-awake — "Manter Tela Ligada" vale no modo navegação
const mockActivateKeepAwake = jest.fn().mockResolvedValue(undefined);
const mockDeactivateKeepAwake = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: (...a: unknown[]) => mockActivateKeepAwake(...a),
  deactivateKeepAwake: (...a: unknown[]) => mockDeactivateKeepAwake(...a),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn(),
}));

// Mock navigation lib
jest.mock('@/lib/navigation', () => ({
  abrirNavegacao: jest.fn(),
}));

// Mock LocationTrackingService
jest.mock('@/services/locationTracking', () => ({
  __esModule: true,
  default: {
    startTracking: jest.fn().mockResolvedValue(true),
    stopTracking: jest.fn().mockResolvedValue(undefined),
    getNavigationPreferences: jest.fn().mockResolvedValue({
      autoAdvance: true,
      proximityRadius: 50,
    }),
  },
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock expo-audio (substitui expo-av no SDK 56)
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  createAudioPlayer: jest.fn(() => ({
    volume: 1,
    play: jest.fn(),
    remove: jest.fn(),
  })),
}));

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      white: '#fff',
      black: '#000',
      primary: '#007AFF',
      primaryBg: '#e6ecfb',
      gray50: '#f9fafb',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray300: '#d1d5db',
      gray400: '#9ca3af',
      gray500: '#6b7280',
      gray600: '#4b5563',
      gray700: '#374151',
      gray900: '#111827',
      success: '#10b981',
      warning: '#f59e0b',
      warningBg: '#fef3c7',
      secondaryDark: '#92400e',
      error: '#ef4444',
      info: '#3b82f6',
    },
    typography: {
      fontSize: {
        xs: 12,
        sm: 14,
        base: 16,
        lg: 18,
        xl: 20,
      },
      fontSans: 'System',
      fontSansMedium: 'System',
      fontSansSemiBold: 'System',
      fontSansBold: 'System',
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
      '2xl': 48,
    },
    borderRadius: {
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
      full: 9999,
    },
    shadows: { sm: {}, md: {}, lg: {} },
  };
  return {
    defaultTheme: theme,
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: any) => (typeof fn === 'function' ? fn(theme) : fn),
    },
  };
});

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock NavigationSettings
// Mock NavigationSettings — expõe o onClose para o teste de recarga
const mockSettingsOnClose: { current: null | (() => void) } = {
  current: null,
};
jest.mock('../NavigationSettings', () => ({
  NavigationSettings: (props: { onClose: () => void }) => {
    mockSettingsOnClose.current = props.onClose;
    return null;
  },
}));

describe('NavigationMode', () => {
  const defaultProps = {
    currentStop: {
      id: 'stop-1',
      endereco: 'Rua Destino, 456',
      latitude: -23.56,
      longitude: -46.64,
      ordem: 1,
      status: 'pendente',
      tipo: 'entrega',
    },
    nextStop: {
      id: 'stop-2',
      endereco: 'Próxima Rua, 789',
      latitude: -23.57,
      longitude: -46.65,
      ordem: 2,
      status: 'pendente',
      tipo: 'entrega',
    },
    paradas: [
      {
        id: 'stop-1',
        endereco: 'Rua Destino, 456',
        latitude: -23.56,
        longitude: -46.64,
        ordem: 1,
        status: 'pendente',
        tipo: 'entrega',
      },
      {
        id: 'stop-2',
        endereco: 'Próxima Rua, 789',
        latitude: -23.57,
        longitude: -46.65,
        ordem: 2,
        status: 'pendente',
        tipo: 'entrega',
      },
    ],
    rotaId: 'rota-1',
    onComplete: jest.fn(),
    onSkip: jest.fn(),
    onExit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('deve mostrar loading inicialmente', () => {
      const { getByText } = render(<NavigationMode {...defaultProps} />);

      expect(getByText('Preparando navegação...')).toBeTruthy();
    });

    it('deve renderizar o mapa quando currentStop existe', async () => {
      const { getByTestId } = render(<NavigationMode {...defaultProps} />);

      await waitFor(() => {
        expect(getByTestId('map-view')).toBeTruthy();
      });
    });

    it('deve renderizar marker de destino', async () => {
      const { getAllByTestId } = render(<NavigationMode {...defaultProps} />);

      await waitFor(() => {
        const markers = getAllByTestId('marker');
        expect(markers.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Complete stop', () => {
    it('deve mostrar confirmação ao completar', async () => {
      const { getByText } = render(<NavigationMode {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Concluir')).toBeTruthy();
      });

      const completeButton = getByText('Concluir');
      fireEvent.press(completeButton);

      // Wait for async handler to complete
      await waitFor(() => {
        expect(global.mockUseAlert.showConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Confirmar Entrega',
            message: expect.stringContaining('Rua Destino, 456'),
          }),
        );
      });
    });

    it('deve chamar onComplete quando confirmado', async () => {
      // Mock showConfirm to return true (user confirms)
      global.mockUseAlert.showConfirm.mockResolvedValue(true);

      const { getByText } = render(<NavigationMode {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Concluir')).toBeTruthy();
      });

      const completeButton = getByText('Concluir');
      fireEvent.press(completeButton);

      // Wait for onComplete to be called after confirmation
      await waitFor(() => {
        expect(defaultProps.onComplete).toHaveBeenCalled();
      });
    });
  });

  describe('Skip stop', () => {
    it('deve chamar onSkip ao pular (abre SkipReasonModal no pai)', async () => {
      const { getByText } = render(<NavigationMode {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Pular')).toBeTruthy();
      });

      const skipButton = getByText('Pular');
      fireEvent.press(skipButton);

      // Skip now directly calls onSkip (no confirm dialog)
      await waitFor(() => {
        expect(defaultProps.onSkip).toHaveBeenCalled();
      });
      // Confirm dialog is no longer shown (SkipReasonModal is in parent)
      expect(global.mockUseAlert.showConfirm).not.toHaveBeenCalled();
    });
  });

  describe('Open in maps', () => {
    it('deve abrir navegação externa quando botão pressionado', async () => {
      const { abrirNavegacao } = require('@/lib/navigation');

      const { getByText } = render(<NavigationMode {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Abrir no Maps')).toBeTruthy();
      });

      const mapsButton = getByText('Abrir no Maps');
      fireEvent.press(mapsButton);

      expect(abrirNavegacao).toHaveBeenCalledWith({
        latitude: -23.56,
        longitude: -46.64,
        endereco: 'Rua Destino, 456',
      });
    });
  });

  describe('Info panel', () => {
    it('deve mostrar parada atual', async () => {
      const { getByText } = render(<NavigationMode {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Rua Destino, 456')).toBeTruthy();
      });
    });

    it('deve mostrar número da parada', async () => {
      const { getByText } = render(<NavigationMode {...defaultProps} />);

      await waitFor(() => {
        // Component renders "• Parada {currentStopIndex}/{realParadas.length}"
        expect(getByText(/Parada 1\/2/)).toBeTruthy();
      });
    });

    it('deve mostrar hint da próxima parada', async () => {
      const { getByText } = render(<NavigationMode {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/Próxima:/)).toBeTruthy();
      });
    });

    it('não deve mostrar hint quando não há nextStop', async () => {
      const { queryByText, getByText } = render(
        <NavigationMode {...defaultProps} nextStop={undefined} />,
      );

      await waitFor(() => {
        expect(getByText('Rua Destino, 456')).toBeTruthy();
      });

      expect(queryByText(/Próxima:/)).toBeNull();
    });

    it('deve mostrar destinatário quando fornecido', async () => {
      const props = {
        ...defaultProps,
        currentStop: {
          ...defaultProps.currentStop,
          destinatario: 'João Silva',
        },
      };

      const { getByText } = render(<NavigationMode {...props} />);

      await waitFor(() => {
        expect(getByText('João Silva')).toBeTruthy();
      });
    });

    it('deve mostrar observações quando fornecidas', async () => {
      const props = {
        ...defaultProps,
        currentStop: {
          ...defaultProps.currentStop,
          observacoes: 'Tocar interfone 123',
        },
      };

      const { getByText } = render(<NavigationMode {...props} />);

      await waitFor(() => {
        expect(getByText('Tocar interfone 123')).toBeTruthy();
      });
    });
  });

  describe('Map properties', () => {
    it('deve configurar estilo MapLibre', async () => {
      const { getByTestId } = render(<NavigationMode {...defaultProps} />);

      await waitFor(() => {
        const mapView = getByTestId('map-view');
        expect(mapView.props.mapStyle).toBeTruthy();
      });
    });
  });

  describe('Region calculation', () => {
    it('deve usar currentStop como centro quando não há userLocation', async () => {
      const { getByTestId } = render(<NavigationMode {...defaultProps} />);

      await waitFor(() => {
        const camera = getByTestId('map-camera');
        expect(camera.props.center).toEqual([-46.64, -23.56]);
      });
    });
  });
});

/**
 * O mapa tinha a altura da tela inteira e a câmera centralizava no meio
 * dele — atrás do painel de baixo. Motorista, destino e rota só apareciam
 * arrastando o mapa (análise de 03/10/2026). A câmera precisa saber quanto
 * do mapa está coberto.
 */
describe('Enquadramento do mapa', () => {
  const Location = jest.requireMock('expo-location');

  const parada = (id: string, ordem: number, latitude: number) => ({
    id,
    endereco: `Rua ${ordem}`,
    latitude,
    longitude: -46.64,
    ordem,
    status: 'pendente',
    tipo: 'entrega',
    is_checkpoint: true,
  });
  const defaultProps = {
    currentStop: parada('p2', 2, -23.56),
    nextStop: parada('p3', 3, -23.57),
    paradas: [parada('p2', 2, -23.56), parada('p3', 3, -23.57)],
    rotaId: 'rota-1',
    onComplete: jest.fn(),
    onSkip: jest.fn(),
    onExit: jest.fn(),
  };

  const layout = (height: number) => ({
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height } },
  });

  beforeEach(() => {
    Location.watchPositionAsync.mockImplementation(
      (_opcoes: unknown, cb: (l: unknown) => void) => {
        // ~600 m da parada (-23.56, -46.64): enquadra os dois
        cb({
          coords: {
            latitude: -23.555,
            longitude: -46.638,
            heading: 0,
            speed: 0,
            accuracy: 5,
          },
        });
        return Promise.resolve({ remove: jest.fn() });
      },
    );
  });

  afterEach(() => {
    Location.watchPositionAsync.mockResolvedValue({ remove: jest.fn() });
  });

  it('reserva o painel e a barra superior no padding da câmera', async () => {
    const { getByTestId } = render(<NavigationMode {...defaultProps} />);
    await waitFor(() => expect(getByTestId('map-camera')).toBeTruthy());

    fireEvent(getByTestId('nav-barra-superior'), 'layout', layout(90));
    fireEvent(getByTestId('nav-painel'), 'layout', layout(370));

    await waitFor(() => {
      const { padding } = getByTestId('map-camera').props;
      expect(padding.top).toBeGreaterThanOrEqual(90);
      expect(padding.bottom).toBeGreaterThanOrEqual(370);
    });
  });

  it('perto da parada, enquadra motorista e parada juntos', async () => {
    const { getByTestId } = render(<NavigationMode {...defaultProps} />);

    await waitFor(() => {
      const { bounds } = getByTestId('map-camera').props;
      // [oeste, sul, leste, norte]
      expect(bounds).toEqual([-46.64, -23.56, -46.638, -23.555]);
    });
  });

  it('o botão de recentralizar fica acima do painel medido', async () => {
    const { getByTestId } = render(<NavigationMode {...defaultProps} />);
    await waitFor(() => expect(getByTestId('nav-recentralizar')).toBeTruthy());

    fireEvent(getByTestId('nav-painel'), 'layout', layout(370));

    await waitFor(() => {
      const estilo = StyleSheet.flatten(
        getByTestId('nav-recentralizar').props.style,
      );
      expect(estilo.bottom).toBeGreaterThan(370);
    });
  });
});

/**
 * As preferências eram lidas só ao abrir o modo navegação: o que o motorista
 * mudava na engrenagem só valia depois de sair e entrar de novo (visto no
 * aparelho em 03/10/2026).
 */
describe('Configurações dentro da navegação', () => {
  const LocationTracking = jest.requireMock(
    '@/services/locationTracking',
  ).default;

  afterEach(() => {
    LocationTracking.getNavigationPreferences.mockResolvedValue({
      autoAdvance: true,
      proximityRadius: 50,
    });
  });

  it('ao fechar, aplica o que mudou nelas', async () => {
    LocationTracking.getNavigationPreferences.mockResolvedValue({
      showSpeedometer: true,
      autoAdvance: true,
      proximityRadius: 50,
    });
    const props = {
      currentStop: {
        id: 'p2',
        endereco: 'Rua 2',
        latitude: -23.56,
        longitude: -46.64,
        ordem: 2,
        status: 'pendente',
        tipo: 'entrega',
        is_checkpoint: true,
      },
      nextStop: null,
      paradas: [],
      rotaId: 'rota-1',
      onComplete: jest.fn(),
      onSkip: jest.fn(),
      onExit: jest.fn(),
    };
    const { findByLabelText, findByText, queryByText } = render(
      <NavigationMode {...props} />,
    );
    expect(await findByText('km/h')).toBeTruthy();

    fireEvent.press(await findByLabelText('Configurações da navegação'));
    await waitFor(() => expect(mockSettingsOnClose.current).not.toBeNull());

    // Na engrenagem, o motorista desliga o velocímetro e fecha.
    LocationTracking.getNavigationPreferences.mockResolvedValue({
      showSpeedometer: false,
      autoAdvance: true,
      proximityRadius: 50,
    });
    await act(async () => {
      mockSettingsOnClose.current!();
    });

    await waitFor(() => expect(queryByText('km/h')).toBeNull());
  });
});

/**
 * "Manter Tela Ligada" (ligado por padrão) só era aplicado pelo Turn-by-Turn,
 * removido em 03/10/2026; no modo mapa, o que os motoristas usam, a tela
 * apagava no meio da rota.
 */
describe('Manter Tela Ligada', () => {
  const LocationTracking = jest.requireMock(
    '@/services/locationTracking',
  ).default;

  const props = {
    currentStop: {
      id: 'p2',
      endereco: 'Rua 2',
      latitude: -23.56,
      longitude: -46.64,
      ordem: 2,
      status: 'pendente',
      tipo: 'entrega',
      is_checkpoint: true,
    },
    nextStop: null,
    paradas: [],
    rotaId: 'rota-1',
    onComplete: jest.fn(),
    onSkip: jest.fn(),
    onExit: jest.fn(),
  };

  beforeEach(() => {
    mockActivateKeepAwake.mockClear();
    mockDeactivateKeepAwake.mockClear();
  });

  afterEach(() => {
    LocationTracking.getNavigationPreferences.mockResolvedValue({
      autoAdvance: true,
      proximityRadius: 50,
    });
  });

  it('ligado: mantém a tela acesa e solta ao sair', async () => {
    LocationTracking.getNavigationPreferences.mockResolvedValue({
      preventScreenSleep: true,
      autoAdvance: true,
      proximityRadius: 50,
    });
    const { findByTestId, unmount } = render(<NavigationMode {...props} />);
    await findByTestId('map-view');

    await waitFor(() => expect(mockActivateKeepAwake).toHaveBeenCalled());
    const tag = mockActivateKeepAwake.mock.calls[0][0];

    unmount();
    expect(mockDeactivateKeepAwake).toHaveBeenCalledWith(tag);
  });

  it('desligado: não mexe na tela', async () => {
    LocationTracking.getNavigationPreferences.mockResolvedValue({
      preventScreenSleep: false,
      autoAdvance: true,
      proximityRadius: 50,
    });
    const { findByTestId } = render(<NavigationMode {...props} />);
    await findByTestId('map-view');

    expect(mockActivateKeepAwake).not.toHaveBeenCalled();
  });
});
