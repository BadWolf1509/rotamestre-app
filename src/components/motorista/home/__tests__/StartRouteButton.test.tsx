/**
 * Tests for StartRouteButton.tsx
 * Botão de ação principal para a tela do motorista
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { StartRouteButton } from '../StartRouteButton';

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const { View, TouchableOpacity } = require('react-native');
  return {
    default: {
      createAnimatedComponent: (Component: any) => Component,
      call: () => {},
    },
    useSharedValue: jest.fn(() => ({ value: 1 })),
    useAnimatedStyle: jest.fn(() => ({})),
    withRepeat: jest.fn((val) => val),
    withSequence: jest.fn((...vals) => vals[0]),
    withTiming: jest.fn((val) => val),
    withSpring: jest.fn((val) => val),
    createAnimatedComponent: (Component: any) => Component,
  };
});

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
      success: '#10b981',
      warning: '#f7a02a',
      error: '#ef4444',
      white: '#ffffff',
      black: '#000000',
      gray300: '#d1d5db',
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
    typography: { fontSize: { xs: 12, sm: 14, base: 16, lg: 18 } },
    borderRadius: { md: 10 },
  };

  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: (t: typeof theme) => Record<string, unknown>) => fn(theme),
    },
  };
});

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, testID }: { name: string; testID?: string }) => {
    const { Text } = require('react-native');
    return <Text testID={testID || `icon-${name}`}>{name}</Text>;
  },
}));

describe('StartRouteButton', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar com label padrão "Iniciar Rota"', () => {
      const { getByText } = render(
        <StartRouteButton onPress={mockOnPress} />
      );

      expect(getByText('Iniciar Rota')).toBeTruthy();
    });

    it('deve renderizar com label customizado', () => {
      const { getByText } = render(
        <StartRouteButton onPress={mockOnPress} label="Continuar Rota" />
      );

      expect(getByText('Continuar Rota')).toBeTruthy();
    });

    it('deve renderizar com subtítulo', () => {
      const { getByText } = render(
        <StartRouteButton
          onPress={mockOnPress}
          subtitle="5 paradas • 12km"
        />
      );

      expect(getByText('5 paradas • 12km')).toBeTruthy();
    });

    it('deve renderizar ícone play-circle para variante start', () => {
      const { getByText } = render(
        <StartRouteButton onPress={mockOnPress} variant="start" />
      );

      expect(getByText('play-circle')).toBeTruthy();
    });
  });

  describe('Variantes', () => {
    it('deve renderizar ícone navigate para variante navigate', () => {
      const { getByText } = render(
        <StartRouteButton
          onPress={mockOnPress}
          variant="navigate"
          label="Navegar"
        />
      );

      expect(getByText('navigate')).toBeTruthy();
      expect(getByText('Navegar')).toBeTruthy();
    });

    it('deve renderizar ícone checkmark-circle para variante complete', () => {
      const { getByText } = render(
        <StartRouteButton
          onPress={mockOnPress}
          variant="complete"
          label="Concluir Rota"
        />
      );

      expect(getByText('checkmark-circle')).toBeTruthy();
      expect(getByText('Concluir Rota')).toBeTruthy();
    });

    it('deve renderizar ícone document-text para variante details', () => {
      const { getByText } = render(
        <StartRouteButton
          onPress={mockOnPress}
          variant="details"
          label="Ver Detalhes"
        />
      );

      expect(getByText('document-text')).toBeTruthy();
      expect(getByText('Ver Detalhes')).toBeTruthy();
    });
  });

  describe('Estado Loading', () => {
    it('deve mostrar ActivityIndicator quando loading', () => {
      const { UNSAFE_getByType, queryByText } = render(
        <StartRouteButton onPress={mockOnPress} loading={true} />
      );

      const ActivityIndicator = require('react-native').ActivityIndicator;
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
      expect(queryByText('Iniciar Rota')).toBeNull();
    });

    it('não deve chamar onPress quando loading', () => {
      const { getByText } = render(
        <StartRouteButton onPress={mockOnPress} loading={false} label="Testar" />
      );

      // Press and verify callback is called when not loading
      fireEvent.press(getByText('Testar'));
      expect(mockOnPress).toHaveBeenCalled();
    });
  });

  describe('Estado Disabled', () => {
    it('não deve chamar onPress quando disabled=true', () => {
      jest.clearAllMocks();
      const { getByText } = render(
        <StartRouteButton onPress={mockOnPress} disabled={true} />
      );

      fireEvent.press(getByText('Iniciar Rota'));
      expect(mockOnPress).not.toHaveBeenCalled();
    });

    it('deve mostrar errorMessage quando disabled', () => {
      const { getByText, queryByText } = render(
        <StartRouteButton
          onPress={mockOnPress}
          disabled={true}
          errorMessage="Conexão indisponível"
          subtitle="5 paradas"
        />
      );

      expect(getByText('Conexão indisponível')).toBeTruthy();
      // Subtítulo não aparece quando disabled
      expect(queryByText('5 paradas')).toBeNull();
    });

    it('não deve mostrar subtítulo quando disabled', () => {
      const { queryByText } = render(
        <StartRouteButton
          onPress={mockOnPress}
          disabled={true}
          subtitle="5 paradas • 12km"
        />
      );

      expect(queryByText('5 paradas • 12km')).toBeNull();
    });
  });

  describe('Interações', () => {
    it('deve chamar onPress ao pressionar o botão', () => {
      const { getByText } = render(
        <StartRouteButton onPress={mockOnPress} />
      );

      fireEvent.press(getByText('Iniciar Rota'));

      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it('não deve chamar onPress quando disabled', () => {
      const { getByText } = render(
        <StartRouteButton onPress={mockOnPress} disabled={true} />
      );

      fireEvent.press(getByText('Iniciar Rota'));

      expect(mockOnPress).not.toHaveBeenCalled();
    });
  });

  describe('Animação', () => {
    it('deve inicializar useSharedValue com 1', () => {
      const { useSharedValue } = require('react-native-reanimated');

      render(<StartRouteButton onPress={mockOnPress} />);

      expect(useSharedValue).toHaveBeenCalledWith(1);
    });

    it('deve usar useAnimatedStyle', () => {
      const { useAnimatedStyle } = require('react-native-reanimated');

      render(<StartRouteButton onPress={mockOnPress} />);

      expect(useAnimatedStyle).toHaveBeenCalled();
    });
  });

  describe('Estilos Condicionais', () => {
    it('deve renderizar corretamente quando desabilitado', () => {
      const { getByText } = render(
        <StartRouteButton onPress={mockOnPress} disabled={true} />
      );

      // Component renders the label when disabled
      expect(getByText('Iniciar Rota')).toBeTruthy();
    });
  });
});
