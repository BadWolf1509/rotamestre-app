import { Ionicons } from '@expo/vector-icons';
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { RouteStatus } from '@/context/RouteStatusContext';

import { QuickActions, FloatingActionButton } from '../QuickActions';

// Mock haptics
jest.mock('@/utils/haptics', () => ({
  lightHaptic: jest.fn().mockResolvedValue(undefined),
  mediumHaptic: jest.fn().mockResolvedValue(undefined),
  heavyHaptic: jest.fn().mockResolvedValue(undefined),
}));

// Mock styles
jest.mock('@/utils/styles', () => ({
  defaultTheme: {
    colors: {
      primary: '#007AFF',
      warning: '#f59e0b',
      black: '#000000',
      white: '#ffffff',
      gray200: '#e5e7eb',
      gray400: '#9ca3af',
      gray700: '#374151',
    },
  },
  useUnistyles: () => ({
    theme: {
      colors: {
        primary: '#007AFF',
        warning: '#f59e0b',
        black: '#000000',
        white: '#ffffff',
        gray200: '#e5e7eb',
        gray400: '#9ca3af',
        gray700: '#374151',
      },
    },
  }),
}));

describe('QuickActions', () => {
  const mockOnViewAllStops = jest.fn();
  const mockOnContactSupport = jest.fn();
  const mockOnReportIncident = jest.fn();
  const mockOnOpenSettings = jest.fn();
  const mockOnViewSummary = jest.fn();
  const mockOnViewHistory = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar componente com state "no-route"', () => {
      const { getByText } = render(
        <QuickActions
          state="no-route"
          onViewHistory={mockOnViewHistory}
          onViewSummary={mockOnViewSummary}
          onOpenSettings={mockOnOpenSettings}
          onContactSupport={mockOnContactSupport}
        />
      );

      expect(getByText('Histórico')).toBeTruthy();
      expect(getByText('Estatísticas')).toBeTruthy();
      expect(getByText('Configurações')).toBeTruthy();
      expect(getByText('Suporte')).toBeTruthy();
    });

    it('deve renderizar ícones corretos para state "no-route"', () => {
      const { UNSAFE_getAllByType } = render(
        <QuickActions state="no-route" />
      );

      const icons = UNSAFE_getAllByType(Ionicons);
      expect(icons.length).toBe(4);
      expect(icons[0].props.name).toBe('time-outline');
      expect(icons[1].props.name).toBe('bar-chart-outline');
      expect(icons[2].props.name).toBe('settings-outline');
      expect(icons[3].props.name).toBe('help-circle-outline');
    });
  });

  describe('Estado "pending"', () => {
    it('deve renderizar ações para state "pending"', () => {
      const { getByText } = render(
        <QuickActions
          state="pending"
          onViewAllStops={mockOnViewAllStops}
          onReportIncident={mockOnReportIncident}
          onContactSupport={mockOnContactSupport}
          onOpenSettings={mockOnOpenSettings}
        />
      );

      expect(getByText('Ver Paradas')).toBeTruthy();
      expect(getByText('Reportar')).toBeTruthy();
      expect(getByText('Suporte')).toBeTruthy();
      expect(getByText('Navegação')).toBeTruthy();
    });

    it('deve chamar onViewAllStops ao clicar em "Ver Paradas"', async () => {
      const { getByText } = render(
        <QuickActions
          state="pending"
          onViewAllStops={mockOnViewAllStops}
        />
      );

      fireEvent.press(getByText('Ver Paradas'));
      // Wait for async haptic
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockOnViewAllStops).toHaveBeenCalledTimes(1);
    });

    it('deve renderizar ícones corretos para state "pending"', () => {
      const { UNSAFE_getAllByType } = render(
        <QuickActions state="pending" />
      );

      const icons = UNSAFE_getAllByType(Ionicons);
      expect(icons.length).toBe(4);
      expect(icons[0].props.name).toBe('list-outline');
      expect(icons[1].props.name).toBe('warning-outline');
      expect(icons[2].props.name).toBe('call-outline');
      expect(icons[3].props.name).toBe('settings-outline');
    });
  });

  describe('Estado "active"', () => {
    it('deve renderizar ações para state "active"', () => {
      const { getByText } = render(
        <QuickActions
          state="active"
          onViewAllStops={mockOnViewAllStops}
          onReportIncident={mockOnReportIncident}
          onOpenSettings={mockOnOpenSettings}
          onContactSupport={mockOnContactSupport}
        />
      );

      expect(getByText('Todas Paradas')).toBeTruthy();
      expect(getByText('Reportar')).toBeTruthy();
      expect(getByText('Navegação')).toBeTruthy();
      expect(getByText('Suporte')).toBeTruthy();
    });

    it('deve chamar onOpenSettings ao clicar em "Navegação"', async () => {
      const { getByText } = render(
        <QuickActions
          state="active"
          onOpenSettings={mockOnOpenSettings}
        />
      );

      fireEvent.press(getByText('Navegação'));
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockOnOpenSettings).toHaveBeenCalledTimes(1);
    });

    it('deve renderizar ícones corretos para state "active"', () => {
      const { UNSAFE_getAllByType } = render(
        <QuickActions state="active" />
      );

      const icons = UNSAFE_getAllByType(Ionicons);
      expect(icons.length).toBe(4);
      expect(icons[0].props.name).toBe('list-outline');
      expect(icons[1].props.name).toBe('warning-outline');
      expect(icons[2].props.name).toBe('settings-outline');
      expect(icons[3].props.name).toBe('call-outline');
    });
  });

  describe('Estado "last-stop"', () => {
    it('deve renderizar mesmas ações que "active"', () => {
      const { getByText } = render(
        <QuickActions state="last-stop" />
      );

      expect(getByText('Todas Paradas')).toBeTruthy();
      expect(getByText('Reportar')).toBeTruthy();
      expect(getByText('Navegação')).toBeTruthy();
      expect(getByText('Suporte')).toBeTruthy();
    });

    it('deve ter mesmos ícones que "active"', () => {
      const { UNSAFE_getAllByType } = render(
        <QuickActions state="last-stop" />
      );

      const icons = UNSAFE_getAllByType(Ionicons);
      expect(icons.length).toBe(4);
      expect(icons[0].props.name).toBe('list-outline');
      expect(icons[1].props.name).toBe('warning-outline');
      expect(icons[2].props.name).toBe('settings-outline');
      expect(icons[3].props.name).toBe('call-outline');
    });
  });

  describe('Estado "ready-to-complete"', () => {
    it('deve renderizar ações para state "ready-to-complete"', () => {
      const { getByText } = render(
        <QuickActions
          state="ready-to-complete"
          onViewSummary={mockOnViewSummary}
          onViewAllStops={mockOnViewAllStops}
          onContactSupport={mockOnContactSupport}
        />
      );

      expect(getByText('Ver Resumo')).toBeTruthy();
      expect(getByText('Ver Paradas')).toBeTruthy();
      expect(getByText('Compartilhar')).toBeTruthy();
    });

    it('deve chamar onViewSummary ao clicar em "Ver Resumo"', async () => {
      const { getByText } = render(
        <QuickActions
          state="ready-to-complete"
          onViewSummary={mockOnViewSummary}
        />
      );

      fireEvent.press(getByText('Ver Resumo'));
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockOnViewSummary).toHaveBeenCalledTimes(1);
    });

    it('deve renderizar ícones corretos', () => {
      const { UNSAFE_getAllByType } = render(
        <QuickActions state="ready-to-complete" />
      );

      const icons = UNSAFE_getAllByType(Ionicons);
      expect(icons.length).toBe(3);
      expect(icons[0].props.name).toBe('document-text-outline');
      expect(icons[1].props.name).toBe('list-outline');
      expect(icons[2].props.name).toBe('share-outline');
    });
  });

  describe('Estado "completed"', () => {
    it('deve renderizar ações para state "completed"', () => {
      const { getByText } = render(
        <QuickActions
          state="completed"
          onViewSummary={mockOnViewSummary}
          onViewHistory={mockOnViewHistory}
          onContactSupport={mockOnContactSupport}
        />
      );

      expect(getByText('Detalhes')).toBeTruthy();
      expect(getByText('Histórico')).toBeTruthy();
      expect(getByText('Compartilhar')).toBeTruthy();
    });

    it('deve chamar callbacks corretos', async () => {
      const { getByText } = render(
        <QuickActions
          state="completed"
          onViewSummary={mockOnViewSummary}
          onViewHistory={mockOnViewHistory}
          onContactSupport={mockOnContactSupport}
        />
      );

      fireEvent.press(getByText('Detalhes'));
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockOnViewSummary).toHaveBeenCalledTimes(1);

      fireEvent.press(getByText('Compartilhar'));
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockOnContactSupport).toHaveBeenCalledTimes(1);
    });

    it('deve renderizar ícones corretos', () => {
      const { UNSAFE_getAllByType } = render(
        <QuickActions state="completed" />
      );

      const icons = UNSAFE_getAllByType(Ionicons);
      expect(icons.length).toBe(3);
      expect(icons[0].props.name).toBe('bar-chart-outline');
      expect(icons[1].props.name).toBe('time-outline');
      expect(icons[2].props.name).toBe('share-outline');
    });
  });

  describe('Callbacks Opcionais', () => {
    it('não deve crashar quando callbacks são undefined', () => {
      expect(() => {
        render(<QuickActions state="pending" />);
      }).not.toThrow();
    });

    it('não deve chamar onPress quando callback undefined', () => {
      const { getByText } = render(
        <QuickActions state="pending" />
      );

      // Não deve crashar ao clicar sem callbacks
      expect(() => {
        fireEvent.press(getByText('Ver Paradas'));
      }).not.toThrow();
    });

    it('deve chamar onReportIncident quando fornecido', async () => {
      const { getByText } = render(
        <QuickActions
          state="pending"
          onReportIncident={mockOnReportIncident}
        />
      );

      fireEvent.press(getByText('Reportar'));
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockOnReportIncident).toHaveBeenCalledTimes(1);
    });

    it('deve chamar onContactSupport quando fornecido', async () => {
      const { getByText } = render(
        <QuickActions
          state="pending"
          onContactSupport={mockOnContactSupport}
        />
      );

      fireEvent.press(getByText('Suporte'));
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockOnContactSupport).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom Style Prop', () => {
    it('deve aplicar estilo customizado', () => {
      const customStyle = { marginTop: 20 };
      const { UNSAFE_root } = render(
        <QuickActions state="no-route" style={customStyle} />
      );

      expect(UNSAFE_root).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('deve renderizar vazio para estado inválido', () => {
      const { queryByText } = render(
        <QuickActions state={'invalid' as RouteStatus} />
      );

      // Não deve renderizar nenhuma ação
      expect(queryByText('Reportar')).toBeNull();
      expect(queryByText('Suporte')).toBeNull();
    });

    it('deve renderizar vazio para default case', () => {
      const { UNSAFE_queryAllByType } = render(
        <QuickActions state={'unknown' as RouteStatus} />
      );

      const icons = UNSAFE_queryAllByType(Ionicons);
      expect(icons.length).toBe(0);
    });
  });
});

describe('FloatingActionButton', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar FAB com ícone', () => {
      const { UNSAFE_getByType } = render(
        <FloatingActionButton
          icon="add"
          color="#4CAF50"
          onPress={mockOnPress}
        />
      );

      const icon = UNSAFE_getByType(Ionicons);
      expect(icon.props.name).toBe('add');
      expect(icon.props.size).toBe(28);
    });

    it('deve renderizar label quando fornecido', () => {
      const { getByText } = render(
        <FloatingActionButton
          icon="add"
          color="#4CAF50"
          onPress={mockOnPress}
          label="Adicionar"
        />
      );

      expect(getByText('Adicionar')).toBeTruthy();
    });

    it('não deve renderizar label quando undefined', () => {
      const { queryByText } = render(
        <FloatingActionButton
          icon="add"
          color="#4CAF50"
          onPress={mockOnPress}
        />
      );

      expect(queryByText('Adicionar')).toBeNull();
    });
  });

  describe('Interações', () => {
    it('deve chamar onPress ao clicar', async () => {
      const { UNSAFE_getByType } = render(
        <FloatingActionButton
          icon="add"
          color="#4CAF50"
          onPress={mockOnPress}
        />
      );

      const { TouchableOpacity } = require('react-native');
      const button = UNSAFE_getByType(TouchableOpacity);

      fireEvent.press(button);
      // Wait for async haptic
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it('não deve chamar onPress quando disabled', async () => {
      const { UNSAFE_getByType } = render(
        <FloatingActionButton
          icon="add"
          color="#4CAF50"
          onPress={mockOnPress}
          disabled={true}
        />
      );

      const { TouchableOpacity } = require('react-native');
      const button = UNSAFE_getByType(TouchableOpacity);

      fireEvent.press(button);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockOnPress).not.toHaveBeenCalled();
    });

    it('deve ter activeOpacity 0.8', () => {
      const { UNSAFE_getByType } = render(
        <FloatingActionButton
          icon="add"
          color="#4CAF50"
          onPress={mockOnPress}
        />
      );

      const { TouchableOpacity } = require('react-native');
      const button = UNSAFE_getByType(TouchableOpacity);
      expect(button.props.activeOpacity).toBe(0.8);
    });
  });

  describe('Diferentes Ícones', () => {
    it('deve renderizar ícone "add"', () => {
      const { UNSAFE_getByType } = render(
        <FloatingActionButton
          icon="add"
          color="#4CAF50"
          onPress={mockOnPress}
        />
      );

      const icon = UNSAFE_getByType(Ionicons);
      expect(icon.props.name).toBe('add');
    });

    it('deve renderizar ícone "play"', () => {
      const { UNSAFE_getByType } = render(
        <FloatingActionButton
          icon="play"
          color="#2196F3"
          onPress={mockOnPress}
        />
      );

      const icon = UNSAFE_getByType(Ionicons);
      expect(icon.props.name).toBe('play');
    });

    it('deve renderizar ícone "checkmark"', () => {
      const { UNSAFE_getByType } = render(
        <FloatingActionButton
          icon="checkmark"
          color="#4CAF50"
          onPress={mockOnPress}
        />
      );

      const icon = UNSAFE_getByType(Ionicons);
      expect(icon.props.name).toBe('checkmark');
    });
  });

  describe('Casos de Uso Reais', () => {
    it('deve renderizar FAB para iniciar rota', () => {
      const { getByText, UNSAFE_getByType } = render(
        <FloatingActionButton
          icon="play"
          color="#2196F3"
          onPress={mockOnPress}
          label="Iniciar"
        />
      );

      expect(getByText('Iniciar')).toBeTruthy();
      expect(UNSAFE_getByType(Ionicons).props.name).toBe('play');
    });

    it('deve renderizar FAB para concluir rota', () => {
      const { getByText, UNSAFE_getByType } = render(
        <FloatingActionButton
          icon="checkmark-circle"
          color="#4CAF50"
          onPress={mockOnPress}
          label="Concluir"
        />
      );

      expect(getByText('Concluir')).toBeTruthy();
      expect(UNSAFE_getByType(Ionicons).props.name).toBe('checkmark-circle');
    });

    it('deve renderizar FAB simples sem label', () => {
      const { UNSAFE_getByType } = render(
        <FloatingActionButton
          icon="add"
          color="#FF5722"
          onPress={mockOnPress}
        />
      );

      expect(UNSAFE_getByType(Ionicons)).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('deve renderizar com label vazio (string vazia é falsy, não renderiza)', () => {
      const { queryByText } = render(
        <FloatingActionButton
          icon="add"
          color="#4CAF50"
          onPress={mockOnPress}
          label=""
        />
      );

      expect(queryByText('Adicionar')).toBeNull();
    });
  });
});
