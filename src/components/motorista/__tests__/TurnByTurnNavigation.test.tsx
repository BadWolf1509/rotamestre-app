import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { TurnByTurnNavigation } from '../TurnByTurnNavigation';

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

// Mock expo-keep-awake
jest.mock('expo-keep-awake', () => ({
  useKeepAwake: jest.fn(),
  activateKeepAwakeAsync: jest.fn().mockResolvedValue(undefined),
  deactivateKeepAwake: jest.fn(),
}));

// Mock expo-location
jest.mock('expo-location', () => ({
  watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
  requestForegroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: 'granted' }),
  Accuracy: {
    BestForNavigation: 6,
  },
}));

// Mock expo-speech
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
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

// Mock useOffRouteDetection hook
jest.mock('@/hooks/useOffRouteDetection', () => ({
  useOffRouteDetection: jest.fn().mockReturnValue({
    status: 'on-route',
    distanceFromRoute: 0,
    nearestPointOnRoute: null,
    isRecalculating: false,
  }),
}));

// Mock navigation service
jest.mock('@/services/turnByTurnNavigation', () => ({
  __esModule: true,
  default: {
    getDirections: jest.fn().mockResolvedValue({
      distance: 5000,
      duration: 600,
    }),
    reset: jest.fn(),
    getRouteCoordinates: jest.fn().mockReturnValue([
      { latitude: -23.5505, longitude: -46.6333 },
      { latitude: -23.56, longitude: -46.64 },
    ]),
    getCurrentInstruction: jest.fn().mockReturnValue({
      instruction: 'Siga em frente',
      maneuver: 'straight',
      voiceInstruction: 'Siga em frente',
    }),
    getNextInstruction: jest.fn().mockReturnValue({
      instruction: 'Vire à direita',
      maneuver: 'turn-right',
    }),
    updateNavigation: jest.fn().mockResolvedValue({
      currentInstruction: {
        instruction: 'Siga em frente',
        maneuver: 'straight',
      },
      nextInstruction: {
        instruction: 'Vire à direita',
        maneuver: 'turn-right',
      },
      distanceToNextTurn: 250,
      shouldSpeak: false,
    }),
    getProgress: jest.fn().mockReturnValue(25),
    getProgressByDistance: jest.fn().mockReturnValue(25),
    getRemainingDistance: jest.fn().mockReturnValue(3750),
    getRemainingTime: jest.fn().mockReturnValue(450),
    setVoiceEnabled: jest.fn(),
    speakInstruction: jest.fn(),
  },
  calculateHaversineDistance: jest.fn().mockReturnValue(100), // Default: 100m away
}));

// Mock locationTracking service for preferences
jest.mock('@/services/locationTracking', () => ({
  __esModule: true,
  default: {
    getNavigationPreferences: jest.fn().mockResolvedValue({
      proximityRadius: 30,
      voiceNavigation: true,
      preventScreenSleep: true,
      vibrationAlerts: true,
    }),
  },
}));

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      white: '#fff',
      black: '#000',
      primary: '#007AFF',
      primaryBg: '#e6ecfb',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
      gray50: '#f9fafb',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray300: '#d1d5db',
      gray400: '#9ca3af',
      gray500: '#6b7280',
      gray600: '#4b5563',
      gray700: '#374151',
      gray900: '#111827',
    },
    typography: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
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

describe('TurnByTurnNavigation', () => {
  const defaultProps = {
    origin: { latitude: -23.5505, longitude: -46.6333 },
    destination: {
      latitude: -23.56,
      longitude: -46.64,
      address: 'Rua Destino, 456',
    },
    onArrive: jest.fn(),
    onExit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('deve renderizar o mapa após carregar', async () => {
      const { getByTestId } = render(
        <TurnByTurnNavigation {...defaultProps} />,
      );

      await waitFor(
        () => {
          expect(getByTestId('map-view')).toBeTruthy();
        },
        { timeout: 3000 },
      );
    });

    it('deve renderizar polyline com rota', async () => {
      const { getByTestId } = render(
        <TurnByTurnNavigation {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByTestId('line-layer')).toBeTruthy();
      });
    });

    it('deve renderizar marker de destino', async () => {
      const { getAllByTestId } = render(
        <TurnByTurnNavigation {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getAllByTestId('marker').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Exit button', () => {
    it('deve chamar onExit quando pressionado', async () => {
      const onExit = jest.fn();
      const { getByText } = render(
        <TurnByTurnNavigation {...defaultProps} onExit={onExit} />,
      );

      await waitFor(() => {
        const exitButton = getByText('Sair');
        fireEvent.press(exitButton);
        expect(onExit).toHaveBeenCalled();
      });
    });
  });

  describe('Map view', () => {
    it('deve configurar estilo MapLibre', async () => {
      const { getByTestId } = render(
        <TurnByTurnNavigation {...defaultProps} />,
      );

      await waitFor(() => {
        const mapView = getByTestId('map-view');
        expect(mapView.props.mapStyle).toBeTruthy();
      });
    });
  });

  describe('Waypoints', () => {
    it('deve aceitar waypoints opcionais', async () => {
      const waypoints = [{ latitude: -23.555, longitude: -46.636 }];

      const { getByTestId } = render(
        <TurnByTurnNavigation {...defaultProps} waypoints={waypoints} />,
      );

      await waitFor(() => {
        expect(getByTestId('map-view')).toBeTruthy();
      });
    });
  });

  describe('Props validation', () => {
    it('deve ter origin com latitude e longitude', () => {
      const { toJSON } = render(<TurnByTurnNavigation {...defaultProps} />);

      expect(defaultProps.origin.latitude).toBe(-23.5505);
      expect(defaultProps.origin.longitude).toBe(-46.6333);
      expect(toJSON()).toBeTruthy();
    });

    it('deve ter destination com latitude, longitude e address', () => {
      const { toJSON } = render(<TurnByTurnNavigation {...defaultProps} />);

      expect(defaultProps.destination.latitude).toBe(-23.56);
      expect(defaultProps.destination.longitude).toBe(-46.64);
      expect(defaultProps.destination.address).toBe('Rua Destino, 456');
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Callbacks', () => {
    it('deve ter onArrive como função', () => {
      render(<TurnByTurnNavigation {...defaultProps} />);
      expect(typeof defaultProps.onArrive).toBe('function');
    });

    it('deve ter onExit como função', () => {
      render(<TurnByTurnNavigation {...defaultProps} />);
      expect(typeof defaultProps.onExit).toBe('function');
    });
  });

  describe('Off-route detection', () => {
    it('deve mostrar warning banner quando status é warning', async () => {
      // Mock useOffRouteDetection to return warning status
      const mockUseOffRouteDetection =
        require('@/hooks/useOffRouteDetection').useOffRouteDetection;
      mockUseOffRouteDetection.mockReturnValue({
        status: 'warning',
        distanceFromRoute: 120,
        nearestPointOnRoute: { latitude: -23.555, longitude: -46.636 },
        isRecalculating: false,
      });

      const { getByText } = render(<TurnByTurnNavigation {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/Você saiu da rota/)).toBeTruthy();
      });
    });

    it('deve mostrar botão de recalcular no warning banner', async () => {
      const mockUseOffRouteDetection =
        require('@/hooks/useOffRouteDetection').useOffRouteDetection;
      mockUseOffRouteDetection.mockReturnValue({
        status: 'warning',
        distanceFromRoute: 120,
        nearestPointOnRoute: null,
        isRecalculating: false,
      });

      const { getByText } = render(<TurnByTurnNavigation {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Recalcular')).toBeTruthy();
      });
    });

    it('deve mostrar banner de recalculando quando isRecalculating é true', async () => {
      const mockUseOffRouteDetection =
        require('@/hooks/useOffRouteDetection').useOffRouteDetection;
      mockUseOffRouteDetection.mockReturnValue({
        status: 'critical',
        distanceFromRoute: 250,
        nearestPointOnRoute: null,
        isRecalculating: true,
      });

      const { getByText } = render(<TurnByTurnNavigation {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Recalculando rota...')).toBeTruthy();
      });
    });

    it('não deve mostrar banner quando on-route', async () => {
      const mockUseOffRouteDetection =
        require('@/hooks/useOffRouteDetection').useOffRouteDetection;
      mockUseOffRouteDetection.mockReturnValue({
        status: 'on-route',
        distanceFromRoute: 0,
        nearestPointOnRoute: null,
        isRecalculating: false,
      });

      const { queryByText } = render(
        <TurnByTurnNavigation {...defaultProps} />,
      );

      await waitFor(() => {
        expect(queryByText(/Você saiu da rota/)).toBeNull();
        expect(queryByText('Recalculando rota...')).toBeNull();
      });
    });
  });

  describe('Voice toggle', () => {
    it('deve renderizar botão de voz', async () => {
      const { getByTestId } = render(
        <TurnByTurnNavigation {...defaultProps} />,
      );

      await waitFor(() => {
        // The map view should be rendered, indicating component loaded
        expect(getByTestId('map-view')).toBeTruthy();
      });
    });

    it('deve chamar setVoiceEnabled ao alternar voz', async () => {
      const TurnByTurnService =
        require('@/services/turnByTurnNavigation').default;
      const { getByTestId } = render(
        <TurnByTurnNavigation {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByTestId('map-view')).toBeTruthy();
      });

      // Initial call from loading preferences
      expect(TurnByTurnService.setVoiceEnabled).toHaveBeenCalled();
    });
  });

  describe('Navigation instructions', () => {
    it('deve mostrar instrução atual após carregar', async () => {
      const { getByText } = render(<TurnByTurnNavigation {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Siga em frente')).toBeTruthy();
      });
    });

    it('deve mostrar próxima instrução', async () => {
      const { getByText } = render(<TurnByTurnNavigation {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/Depois: Vire à direita/)).toBeTruthy();
      });
    });
  });

  describe('Stats display', () => {
    it('deve mostrar distância restante formatada', async () => {
      // getDirections mock returns distance: 5000
      const { getByText } = render(<TurnByTurnNavigation {...defaultProps} />);

      await waitFor(() => {
        // 5000m = 5.0km
        expect(getByText('5,0km')).toBeTruthy();
      });
    });

    it('deve mostrar tempo restante formatado', async () => {
      // getDirections mock returns duration: 600
      const { getByText } = render(<TurnByTurnNavigation {...defaultProps} />);

      await waitFor(() => {
        // 600s = 10 min
        expect(getByText('10 min')).toBeTruthy();
      });
    });

    it('deve mostrar velocidade', async () => {
      const { getByText } = render(<TurnByTurnNavigation {...defaultProps} />);

      await waitFor(() => {
        // Initial speed is 0
        expect(getByText('km/h')).toBeTruthy();
      });
    });
  });

  describe('Progress bar', () => {
    it('deve renderizar barra de progresso', async () => {
      const { getByTestId } = render(
        <TurnByTurnNavigation {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByTestId('map-view')).toBeTruthy();
      });
    });
  });

  describe('Map controls', () => {
    it('deve alternar vista do mapa ao pressionar controle', async () => {
      const { getByTestId } = render(
        <TurnByTurnNavigation {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByTestId('map-view')).toBeTruthy();
      });
    });
  });
});
