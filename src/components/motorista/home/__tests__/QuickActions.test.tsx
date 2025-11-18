import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Ionicons } from '@expo/vector-icons';

import { QuickActions, FloatingActionButton } from '../QuickActions';
import { RouteStatus } from '@/context/RouteStatusContext';

describe('QuickActions', () => {
  const mockOnViewAllStops = jest.fn();
  const mockOnContactSupport = jest.fn();
  const mockOnReportIncident = jest.fn();
  const mockOnOpenSettings = jest.fn();
  const mockOnViewSummary = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar componente com state "no-route"', () => {
      const { getByText } = render(
        <QuickActions
          state="no-route"
          onReportIncident={mockOnReportIncident}
          onContactSupport={mockOnContactSupport}
          onViewSummary={mockOnViewSummary}
        />
      );

      expect(getByText('Reportar')).toBeTruthy();
      expect(getByText('Ajuda')).toBeTruthy();
      expect(getByText('Estatisticas')).toBeTruthy();
    });

    it('deve renderizar ícones corretos para state "no-route"', () => {
      const { UNSAFE_getAllByType } = render(
        <QuickActions state="no-route" />
      );

      const icons = UNSAFE_getAllByType(Ionicons);
      expect(icons.length).toBe(3);
      expect(icons[0].props.name).toBe('warning-outline');
      expect(icons[1].props.name).toBe('help-circle-outline');
      expect(icons[2].props.name).toBe('bar-chart-outline');
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
        />
      );

      expect(getByText('Ver Paradas')).toBeTruthy();
      expect(getByText('Reportar')).toBeTruthy();
      expect(getByText('Suporte')).toBeTruthy();
    });

    it('deve chamar onViewAllStops ao clicar em "Ver Paradas"', () => {
      const { getByText } = render(
        <QuickActions
          state="pending"
          onViewAllStops={mockOnViewAllStops}
        />
      );

      fireEvent.press(getByText('Ver Paradas'));
      expect(mockOnViewAllStops).toHaveBeenCalledTimes(1);
    });

    it('deve renderizar ícones corretos para state "pending"', () => {
      const { UNSAFE_getAllByType } = render(
        <QuickActions state="pending" />
      );

      const icons = UNSAFE_getAllByType(Ionicons);
      expect(icons[0].props.name).toBe('list-outline');
      expect(icons[1].props.name).toBe('warning-outline');
      expect(icons[2].props.name).toBe('call-outline');
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
        />
      );

      expect(getByText('Todas Paradas')).toBeTruthy();
      expect(getByText('Reportar')).toBeTruthy();
      expect(getByText('Navegacao')).toBeTruthy();
    });

    it('deve chamar onOpenSettings ao clicar em "Navegacao"', () => {
      const { getByText } = render(
        <QuickActions
          state="active"
          onOpenSettings={mockOnOpenSettings}
        />
      );

      fireEvent.press(getByText('Navegacao'));
      expect(mockOnOpenSettings).toHaveBeenCalledTimes(1);
    });

    it('deve renderizar ícones corretos para state "active"', () => {
      const { UNSAFE_getAllByType } = render(
        <QuickActions state="active" />
      );

      const icons = UNSAFE_getAllByType(Ionicons);
      expect(icons[0].props.name).toBe('list-outline');
      expect(icons[1].props.name).toBe('warning-outline');
      expect(icons[2].props.name).toBe('settings-outline');
    });
  });

  describe('Estado "last-stop"', () => {
    it('deve renderizar mesmas ações que "active"', () => {
      const { getByText } = render(
        <QuickActions state="last-stop" />
      );

      expect(getByText('Todas Paradas')).toBeTruthy();
      expect(getByText('Reportar')).toBeTruthy();
      expect(getByText('Navegacao')).toBeTruthy();
    });

    it('deve ter mesmos ícones que "active"', () => {
      const { UNSAFE_getAllByType } = render(
        <QuickActions state="last-stop" />
      );

      const icons = UNSAFE_getAllByType(Ionicons);
      expect(icons[0].props.name).toBe('list-outline');
      expect(icons[1].props.name).toBe('warning-outline');
      expect(icons[2].props.name).toBe('settings-outline');
    });
  });

  describe('Estado "ready-to-complete"', () => {
    it('deve renderizar ações para state "ready-to-complete"', () => {
      const { getByText } = render(
        <QuickActions
          state="ready-to-complete"
          onViewSummary={mockOnViewSummary}
          onContactSupport={mockOnContactSupport}
        />
      );

      expect(getByText('Ver Resumo')).toBeTruthy();
      expect(getByText('Compartilhar')).toBeTruthy();
    });

    it('deve chamar onViewSummary ao clicar em "Ver Resumo"', () => {
      const { getByText } = render(
        <QuickActions
          state="ready-to-complete"
          onViewSummary={mockOnViewSummary}
        />
      );

      fireEvent.press(getByText('Ver Resumo'));
      expect(mockOnViewSummary).toHaveBeenCalledTimes(1);
    });

    it('deve renderizar ícones corretos', () => {
      const { UNSAFE_getAllByType } = render(
        <QuickActions state="ready-to-complete" />
      );

      const icons = UNSAFE_getAllByType(Ionicons);
      expect(icons.length).toBe(2);
      expect(icons[0].props.name).toBe('checkmark-circle-outline');
      expect(icons[1].props.name).toBe('share-outline');
    });
  });

  describe('Estado "completed"', () => {
    it('deve renderizar ações para state "completed"', () => {
      const { getByText } = render(
        <QuickActions
          state="completed"
          onViewSummary={mockOnViewSummary}
          onContactSupport={mockOnContactSupport}
        />
      );

      expect(getByText('Ver Detalhes')).toBeTruthy();
      expect(getByText('Compartilhar')).toBeTruthy();
    });

    it('deve chamar callbacks corretos', () => {
      const { getByText } = render(
        <QuickActions
          state="completed"
          onViewSummary={mockOnViewSummary}
          onContactSupport={mockOnContactSupport}
        />
      );

      fireEvent.press(getByText('Ver Detalhes'));
      expect(mockOnViewSummary).toHaveBeenCalledTimes(1);

      fireEvent.press(getByText('Compartilhar'));
      expect(mockOnContactSupport).toHaveBeenCalledTimes(1);
    });

    it('deve renderizar ícones corretos', () => {
      const { UNSAFE_getAllByType } = render(
        <QuickActions state="completed" />
      );

      const icons = UNSAFE_getAllByType(Ionicons);
      expect(icons[0].props.name).toBe('bar-chart-outline');
      expect(icons[1].props.name).toBe('share-outline');
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

    it('deve chamar onReportIncident quando fornecido', () => {
      const { getByText } = render(
        <QuickActions
          state="no-route"
          onReportIncident={mockOnReportIncident}
        />
      );

      fireEvent.press(getByText('Reportar'));
      expect(mockOnReportIncident).toHaveBeenCalledTimes(1);
    });

    it('deve chamar onContactSupport quando fornecido', () => {
      const { getByText } = render(
        <QuickActions
          state="no-route"
          onContactSupport={mockOnContactSupport}
        />
      );

      fireEvent.press(getByText('Ajuda'));
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
      expect(queryByText('Ajuda')).toBeNull();
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

    it('deve aplicar cor customizada ao backgroundColor', () => {
      const { UNSAFE_getByType } = render(
        <FloatingActionButton
          icon="add"
          color="#FF5722"
          onPress={mockOnPress}
        />
      );

      const { TouchableOpacity } = require('react-native');
      const button = UNSAFE_getByType(TouchableOpacity);
      expect(button.props.style[1].backgroundColor).toBe('#FF5722');
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

      // Sem label, não deve haver segundo Text
      expect(queryByText('Adicionar')).toBeNull();
    });
  });

  describe('Interações', () => {
    it('deve chamar onPress ao clicar', () => {
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
      expect(mockOnPress).toHaveBeenCalledTimes(1);
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

      // label="" é falsy, então {label && <Text>} não renderiza o Text
      // Não deve haver nenhum label visível
      expect(queryByText('Adicionar')).toBeNull();
    });

    it('deve aplicar diferentes cores', () => {
      const colors = ['#4CAF50', '#2196F3', '#FF5722', '#9C27B0'];

      colors.forEach((color) => {
        const { UNSAFE_getByType } = render(
          <FloatingActionButton
            icon="add"
            color={color}
            onPress={mockOnPress}
          />
        );

        const { TouchableOpacity } = require('react-native');
        const button = UNSAFE_getByType(TouchableOpacity);
        expect(button.props.style[1].backgroundColor).toBe(color);
      });
    });
  });
});
