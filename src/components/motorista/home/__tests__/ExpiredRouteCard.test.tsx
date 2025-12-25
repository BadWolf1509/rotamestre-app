/**
 * Tests for ExpiredRouteCard.tsx
 * Card de aviso de rota expirada
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { ExpiredRouteCard } from '../ExpiredRouteCard';

// Mock expo-router
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
      success: '#10b981',
      warning: '#f7a02a',
      error: '#ef4444',
      white: '#ffffff',
      gray300: '#d1d5db',
      gray400: '#9ca3af',
      gray700: '#374151',
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

describe('ExpiredRouteCard', () => {
  const mockOnDismiss = jest.fn();

  const defaultData = {
    rota_id: 'route-123',
    data: '2025-12-24', // Fixed date for testing
    paradas_pendentes: 3,
    total_paradas: 5,
    paradas_concluidas: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock current date to a known value
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-12-25T12:00:00'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar o título "Rota expirada"', () => {
      const { getByText } = render(
        <ExpiredRouteCard data={defaultData} />
      );

      expect(getByText('Rota expirada')).toBeTruthy();
    });

    it('deve renderizar ícone de alerta', () => {
      const { getByText } = render(
        <ExpiredRouteCard data={defaultData} />
      );

      expect(getByText('alert-circle')).toBeTruthy();
    });

    it('deve renderizar mensagem com data formatada', () => {
      const { getByText } = render(
        <ExpiredRouteCard data={defaultData} />
      );

      // 24/12/2025 is "ontem" when today is 25/12/2025
      expect(getByText(/Sua rota de ontem não foi concluída/)).toBeTruthy();
    });

    it('deve formatar data como "ontem" quando é o dia anterior', () => {
      const { getByText } = render(
        <ExpiredRouteCard data={{ ...defaultData, data: '2025-12-24' }} />
      );

      expect(getByText(/ontem/)).toBeTruthy();
    });

    it('deve formatar data como DD/MM quando não é ontem', () => {
      const { getByText } = render(
        <ExpiredRouteCard data={{ ...defaultData, data: '2025-12-20' }} />
      );

      expect(getByText(/20\/12/)).toBeTruthy();
    });
  });

  describe('Estatísticas', () => {
    it('deve mostrar paradas concluídas quando há alguma', () => {
      const { getByText } = render(
        <ExpiredRouteCard data={defaultData} />
      );

      expect(getByText('2 concluídas')).toBeTruthy();
      expect(getByText('checkmark-circle')).toBeTruthy();
    });

    it('deve mostrar paradas pendentes', () => {
      const { getByText } = render(
        <ExpiredRouteCard data={defaultData} />
      );

      expect(getByText('3 pendentes')).toBeTruthy();
      expect(getByText('close-circle')).toBeTruthy();
    });

    it('não deve mostrar concluídas quando paradas_concluidas é 0', () => {
      const { queryByText, getByText } = render(
        <ExpiredRouteCard
          data={{ ...defaultData, paradas_concluidas: 0, paradas_pendentes: 5 }}
        />
      );

      // Should not show the "X concluída(s)" stat (pattern: number + concluída)
      expect(queryByText(/^\d+ concluída/)).toBeNull();
      expect(getByText('5 pendentes')).toBeTruthy();
    });

    it('deve usar singular "pendente" para 1 parada', () => {
      const { getByText } = render(
        <ExpiredRouteCard
          data={{ ...defaultData, paradas_pendentes: 1 }}
        />
      );

      expect(getByText('1 pendente')).toBeTruthy();
    });

    it('deve usar singular "concluída" para 1 parada', () => {
      const { getByText } = render(
        <ExpiredRouteCard
          data={{ ...defaultData, paradas_concluidas: 1 }}
        />
      );

      expect(getByText('1 concluída')).toBeTruthy();
    });
  });

  describe('Botão Dismiss', () => {
    it('deve renderizar botão de fechar quando onDismiss é fornecido', () => {
      const { getByText } = render(
        <ExpiredRouteCard data={defaultData} onDismiss={mockOnDismiss} />
      );

      expect(getByText('close')).toBeTruthy();
    });

    it('não deve renderizar botão de fechar quando onDismiss não é fornecido', () => {
      const { queryByText } = render(
        <ExpiredRouteCard data={defaultData} />
      );

      expect(queryByText('close')).toBeNull();
    });

    it('deve chamar onDismiss ao clicar no botão de fechar', () => {
      const { getByText } = render(
        <ExpiredRouteCard data={defaultData} onDismiss={mockOnDismiss} />
      );

      fireEvent.press(getByText('close'));

      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('Navegação para Histórico', () => {
    it('deve renderizar link "Ver no histórico"', () => {
      const { getByText } = render(
        <ExpiredRouteCard data={defaultData} />
      );

      expect(getByText('Ver no histórico')).toBeTruthy();
      expect(getByText('arrow-forward')).toBeTruthy();
    });

    it('deve navegar para histórico ao clicar no link', () => {
      const { getByText } = render(
        <ExpiredRouteCard data={defaultData} />
      );

      fireEvent.press(getByText('Ver no histórico'));

      expect(mockPush).toHaveBeenCalledWith('/motorista/historico');
    });
  });

  describe('Acessibilidade', () => {
    it('deve ter accessibilityLabel no botão dismiss', () => {
      const { getByLabelText } = render(
        <ExpiredRouteCard data={defaultData} onDismiss={mockOnDismiss} />
      );

      expect(getByLabelText('Dispensar aviso')).toBeTruthy();
    });

    it('deve ter accessibilityLabel no link do histórico', () => {
      const { getByLabelText } = render(
        <ExpiredRouteCard data={defaultData} />
      );

      expect(getByLabelText('Ver detalhes no histórico')).toBeTruthy();
    });
  });
});
