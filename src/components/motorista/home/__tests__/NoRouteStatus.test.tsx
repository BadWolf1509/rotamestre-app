/**
 * Tests for NoRouteStatus.tsx
 * Componente de status para estado "sem rota"
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { NoRouteStatus } from '../NoRouteStatus';

// Mock getWorkContext and getNoRouteMessage
const mockGetWorkContext = jest.fn();
const mockGetNoRouteMessage = jest.fn();

jest.mock('@/utils/motivationalMessages', () => ({
  getWorkContext: () => mockGetWorkContext(),
  getNoRouteMessage: (ctx: any) => mockGetNoRouteMessage(ctx),
}));

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
      success: '#10b981',
      successBg: '#d1fae5',
      warning: '#f7a02a',
      warningBg: '#fef3c7',
      error: '#ef4444',
      info: '#3b82f6',
      infoBg: '#dbeafe',
      white: '#ffffff',
      black: '#000000',
      gray50: '#f9fafb',
      gray100: '#f3f4f6',
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

describe('NoRouteStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    mockGetWorkContext.mockReturnValue({
      isWorkDay: true,
      isWorkHours: true,
      period: 'morning',
      dayOfWeek: 1, // Monday
    });

    mockGetNoRouteMessage.mockReturnValue({
      title: 'Aguardando rota',
      subtitle: 'Seu gestor atribuirá uma rota em breve',
      emoji: '☕',
    });
  });

  describe('Renderização Básica', () => {
    it('deve renderizar título da mensagem', () => {
      const { getByText } = render(<NoRouteStatus />);

      expect(getByText('Aguardando rota')).toBeTruthy();
    });

    it('deve renderizar subtítulo da mensagem', () => {
      const { getByText } = render(<NoRouteStatus />);

      expect(getByText('Seu gestor atribuirá uma rota em breve')).toBeTruthy();
    });

    it('deve renderizar emoji', () => {
      const { getByText } = render(<NoRouteStatus />);

      expect(getByText('☕')).toBeTruthy();
    });

    it('deve usar emoji padrão ☕ quando não especificado', () => {
      mockGetNoRouteMessage.mockReturnValue({
        title: 'Teste',
        subtitle: 'Subteste',
        emoji: undefined,
      });

      const { getByText } = render(<NoRouteStatus />);

      expect(getByText('☕')).toBeTruthy();
    });
  });

  describe('Indicador de Aguardando', () => {
    it('deve mostrar indicador durante horário de trabalho', () => {
      const { getByText } = render(<NoRouteStatus showWaitingIndicator={true} />);

      expect(getByText('Notificação automática ativada')).toBeTruthy();
      expect(getByText('notifications-outline')).toBeTruthy();
    });

    it('não deve mostrar indicador fora do horário de trabalho', () => {
      mockGetWorkContext.mockReturnValue({
        isWorkDay: true,
        isWorkHours: false,
        period: 'evening',
        dayOfWeek: 1,
      });

      const { queryByText } = render(<NoRouteStatus showWaitingIndicator={true} />);

      expect(queryByText('Notificação automática ativada')).toBeNull();
    });

    it('não deve mostrar indicador quando showWaitingIndicator=false', () => {
      const { queryByText } = render(<NoRouteStatus showWaitingIndicator={false} />);

      expect(queryByText('Notificação automática ativada')).toBeNull();
    });
  });

  describe('Contexto de Trabalho', () => {
    it('deve passar contexto para getNoRouteMessage', () => {
      const context = { hasStreak: true, streakCount: 5 };

      render(<NoRouteStatus context={context} />);

      expect(mockGetNoRouteMessage).toHaveBeenCalledWith(context);
    });

    it('deve usar contexto vazio por padrão', () => {
      render(<NoRouteStatus />);

      expect(mockGetNoRouteMessage).toHaveBeenCalledWith({});
    });
  });

  describe('Estilos por Período', () => {
    it('deve usar estilo de fim de semana quando não é dia útil', () => {
      mockGetWorkContext.mockReturnValue({
        isWorkDay: false,
        isWorkHours: false,
        period: 'morning',
        dayOfWeek: 0, // Sunday
      });

      const { getByText } = render(<NoRouteStatus />);

      // Component should render without errors
      expect(getByText('Aguardando rota')).toBeTruthy();
    });

    it('deve usar estilo de fora do expediente', () => {
      mockGetWorkContext.mockReturnValue({
        isWorkDay: true,
        isWorkHours: false,
        period: 'evening',
        dayOfWeek: 1,
      });

      const { getByText } = render(<NoRouteStatus />);

      expect(getByText('Aguardando rota')).toBeTruthy();
    });

    it('deve usar estilo de durante expediente', () => {
      mockGetWorkContext.mockReturnValue({
        isWorkDay: true,
        isWorkHours: true,
        period: 'afternoon',
        dayOfWeek: 3,
      });

      const { getByText } = render(<NoRouteStatus />);

      expect(getByText('Aguardando rota')).toBeTruthy();
    });
  });

  describe('Mensagens Diferentes', () => {
    it('deve exibir mensagem personalizada baseada no contexto', () => {
      mockGetNoRouteMessage.mockReturnValue({
        title: 'Bom dia!',
        subtitle: 'Prepare-se para mais um dia de entregas',
        emoji: '🌅',
      });

      const { getByText } = render(<NoRouteStatus />);

      expect(getByText('Bom dia!')).toBeTruthy();
      expect(getByText('Prepare-se para mais um dia de entregas')).toBeTruthy();
      expect(getByText('🌅')).toBeTruthy();
    });

    it('deve exibir mensagem de fim de semana', () => {
      mockGetWorkContext.mockReturnValue({
        isWorkDay: false,
        isWorkHours: false,
        period: 'morning',
        dayOfWeek: 6,
      });

      mockGetNoRouteMessage.mockReturnValue({
        title: 'Bom descanso!',
        subtitle: 'Aproveite seu fim de semana',
        emoji: '🏖️',
      });

      const { getByText } = render(<NoRouteStatus />);

      expect(getByText('Bom descanso!')).toBeTruthy();
      expect(getByText('Aproveite seu fim de semana')).toBeTruthy();
    });
  });
});
