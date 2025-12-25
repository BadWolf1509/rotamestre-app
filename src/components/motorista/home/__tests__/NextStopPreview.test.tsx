/**
 * Tests for NextStopPreview.tsx
 * Preview colapsável da próxima parada
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { NextStopPreview } from '../NextStopPreview';

// Mock useDistanceToStop hook
const mockUseDistanceToStop = jest.fn();
jest.mock('@/hooks/useDistanceToStop', () => ({
  useDistanceToStop: (
    currentLocation: any,
    stopLocation: any,
    options: any
  ) => mockUseDistanceToStop(currentLocation, stopLocation, options),
}));

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
      success: '#10b981',
      warning: '#f7a02a',
      warningBg: '#fef3c7',
      warningText: '#92400e',
      info: '#3b82f6',
      infoBg: '#dbeafe',
      white: '#ffffff',
      gray400: '#9ca3af',
      gray500: '#6b7280',
      gray600: '#4b5563',
      gray700: '#374151',
      gray900: '#111827',
    },
  };

  return {
    defaultTheme: theme,
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
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

// Mock LayoutAnimation
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.LayoutAnimation = {
    ...RN.LayoutAnimation,
    configureNext: jest.fn(),
    Presets: { easeInEaseOut: {} },
  };
  return RN;
});

describe('NextStopPreview', () => {
  const defaultNextStop = {
    id: 'stop-1',
    ordem: 2,
    endereco: 'Rua das Flores, 123 - Centro',
    destinatario: 'João Silva',
    telefone: '(11) 99999-8888',
    observacoes: 'Deixar na portaria',
    tipo: 'entrega' as const,
    latitude: -23.55,
    longitude: -46.63,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDistanceToStop.mockReturnValue({
      distanceKm: '2.5 km',
      durationText: '8 min',
      isLoading: false,
    });
  });

  describe('Renderização Básica', () => {
    it('deve renderizar label "PRÓXIMA"', () => {
      const { getByText } = render(
        <NextStopPreview nextStop={defaultNextStop} totalStops={5} />
      );

      expect(getByText('PRÓXIMA')).toBeTruthy();
    });

    it('deve renderizar ordem da parada', () => {
      const { getByText } = render(
        <NextStopPreview nextStop={defaultNextStop} totalStops={5} />
      );

      expect(getByText('2/5')).toBeTruthy();
    });

    it('deve renderizar endereço', () => {
      const { getByText } = render(
        <NextStopPreview nextStop={defaultNextStop} totalStops={5} />
      );

      expect(getByText('Rua das Flores, 123 - Centro')).toBeTruthy();
    });
  });

  describe('Informação de Distância', () => {
    it('deve mostrar distância e tempo', () => {
      const { getByText } = render(
        <NextStopPreview
          nextStop={defaultNextStop}
          totalStops={5}
          currentLocation={{ latitude: -23.5, longitude: -46.6 }}
        />
      );

      expect(getByText('2.5 km • 8 min')).toBeTruthy();
    });

    it('deve mostrar "Calculando..." quando isLoading', () => {
      mockUseDistanceToStop.mockReturnValue({
        distanceKm: '',
        durationText: '',
        isLoading: true,
      });

      const { getByText } = render(
        <NextStopPreview
          nextStop={defaultNextStop}
          totalStops={5}
          currentLocation={{ latitude: -23.5, longitude: -46.6 }}
        />
      );

      expect(getByText('Calculando...')).toBeTruthy();
    });

    it('deve mostrar ícone navigate-outline', () => {
      const { getByText } = render(
        <NextStopPreview
          nextStop={defaultNextStop}
          totalStops={5}
          currentLocation={{ latitude: -23.5, longitude: -46.6 }}
        />
      );

      expect(getByText('navigate-outline')).toBeTruthy();
    });
  });

  describe('Expansão/Colapso', () => {
    it('deve mostrar ícone chevron-down quando colapsado', () => {
      const { getByText } = render(
        <NextStopPreview nextStop={defaultNextStop} totalStops={5} />
      );

      expect(getByText('chevron-down')).toBeTruthy();
    });

    it('deve expandir ao pressionar', () => {
      const { getByText, queryByText } = render(
        <NextStopPreview nextStop={defaultNextStop} totalStops={5} />
      );

      // Inicialmente não mostra detalhes (destinatário está em expandedContent)
      expect(queryByText('person-outline')).toBeNull();

      // Pressionar para expandir
      fireEvent.press(getByText('PRÓXIMA'));

      // Após expansão, deve mostrar detalhes
      expect(getByText('João Silva')).toBeTruthy();
    });

    it('deve mostrar chevron-up quando expandido', () => {
      const { getByText, queryByText } = render(
        <NextStopPreview nextStop={defaultNextStop} totalStops={5} />
      );

      fireEvent.press(getByText('PRÓXIMA'));

      expect(getByText('chevron-up')).toBeTruthy();
      expect(queryByText('chevron-down')).toBeNull();
    });
  });

  describe('Detalhes Expandidos', () => {
    it('deve mostrar destinatário quando expandido', () => {
      const { getByText } = render(
        <NextStopPreview nextStop={defaultNextStop} totalStops={5} />
      );

      fireEvent.press(getByText('PRÓXIMA'));

      expect(getByText('João Silva')).toBeTruthy();
      expect(getByText('person-outline')).toBeTruthy();
    });

    it('deve mostrar telefone quando expandido', () => {
      const { getByText } = render(
        <NextStopPreview nextStop={defaultNextStop} totalStops={5} />
      );

      fireEvent.press(getByText('PRÓXIMA'));

      expect(getByText('(11) 99999-8888')).toBeTruthy();
      expect(getByText('call-outline')).toBeTruthy();
    });

    it('deve mostrar observações quando expandido', () => {
      const { getByText } = render(
        <NextStopPreview nextStop={defaultNextStop} totalStops={5} />
      );

      fireEvent.press(getByText('PRÓXIMA'));

      expect(getByText('Deixar na portaria')).toBeTruthy();
      expect(getByText('alert-circle-outline')).toBeTruthy();
    });

    it('deve mostrar tipo de parada quando expandido', () => {
      const { getByText } = render(
        <NextStopPreview nextStop={defaultNextStop} totalStops={5} />
      );

      fireEvent.press(getByText('PRÓXIMA'));

      expect(getByText('Entrega')).toBeTruthy();
      expect(getByText('arrow-down-circle-outline')).toBeTruthy();
    });

    it('deve mostrar "Retirada" para tipo retirada', () => {
      const retiradaStop = { ...defaultNextStop, tipo: 'retirada' as const };

      const { getByText } = render(
        <NextStopPreview nextStop={retiradaStop} totalStops={5} />
      );

      fireEvent.press(getByText('PRÓXIMA'));

      expect(getByText('Retirada')).toBeTruthy();
      expect(getByText('arrow-up-circle-outline')).toBeTruthy();
    });
  });

  describe('Parada sem Detalhes Opcionais', () => {
    const minimalStop = {
      id: 'stop-2',
      ordem: 1,
      endereco: 'Avenida Brasil, 500',
      tipo: 'entrega' as const,
      latitude: -23.55,
      longitude: -46.63,
    };

    it('não deve mostrar destinatário quando não existe', () => {
      const { getByText, queryByText } = render(
        <NextStopPreview nextStop={minimalStop} totalStops={3} />
      );

      fireEvent.press(getByText('PRÓXIMA'));

      expect(queryByText('person-outline')).toBeNull();
    });

    it('não deve mostrar telefone quando não existe', () => {
      const { getByText, queryByText } = render(
        <NextStopPreview nextStop={minimalStop} totalStops={3} />
      );

      fireEvent.press(getByText('PRÓXIMA'));

      expect(queryByText('call-outline')).toBeNull();
    });

    it('não deve mostrar observações quando não existe', () => {
      const { getByText, queryByText } = render(
        <NextStopPreview nextStop={minimalStop} totalStops={3} />
      );

      fireEvent.press(getByText('PRÓXIMA'));

      expect(queryByText('alert-circle-outline')).toBeNull();
    });
  });

  describe('Endereço Longo', () => {
    it('deve truncar endereço longo quando colapsado', () => {
      const longAddressStop = {
        ...defaultNextStop,
        endereco: 'Rua Muito Longa Com Muitos Caracteres Que Deveria Ser Truncada Para Melhor Visualização',
      };

      const { getByText, queryByText } = render(
        <NextStopPreview nextStop={longAddressStop} totalStops={5} />
      );

      // Endereço truncado
      expect(getByText(/Rua Muito Longa Com Muitos Caracteres/)).toBeTruthy();
      expect(queryByText('Para Melhor Visualização')).toBeNull();
    });

    it('deve mostrar endereço completo quando expandido', () => {
      const longAddressStop = {
        ...defaultNextStop,
        endereco: 'Rua Muito Longa Com Muitos Caracteres Que Deveria Ser Truncada Para Melhor Visualização',
      };

      const { getByText } = render(
        <NextStopPreview nextStop={longAddressStop} totalStops={5} />
      );

      fireEvent.press(getByText('PRÓXIMA'));

      expect(getByText(/Para Melhor Visualização/)).toBeTruthy();
    });
  });
});
