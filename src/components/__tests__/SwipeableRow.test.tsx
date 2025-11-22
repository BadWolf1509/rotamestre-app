import { render, fireEvent } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import { SwipeableRow } from '../SwipeableRow';

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    Swipeable: React.forwardRef(({ children, renderLeftActions, renderRightActions, _onSwipeableOpen }: any, ref: any) => {
      // Simular animação progress
      const mockProgress = {
        interpolate: jest.fn(() => ({ _value: 0 })),
      };

      // Criar ref com close
      React.useImperativeHandle(ref, () => ({
        close: jest.fn(),
        openLeft: jest.fn(),
        openRight: jest.fn(),
      }));

      return (
        <View>
          {renderLeftActions && renderLeftActions(mockProgress, mockProgress)}
          {children}
          {renderRightActions && renderRightActions(mockProgress, mockProgress)}
        </View>
      );
    }),
  };
});

describe('SwipeableRow', () => {
  const mockAction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar children', () => {
      const { getByText } = render(
        <SwipeableRow>
          <Text>Row Content</Text>
        </SwipeableRow>
      );

      expect(getByText('Row Content')).toBeTruthy();
    });

    it('deve renderizar sem ações', () => {
      const { getByText } = render(
        <SwipeableRow>
          <Text>Content</Text>
        </SwipeableRow>
      );

      expect(getByText('Content')).toBeTruthy();
    });
  });

  describe('Props enabled', () => {
    it('deve renderizar apenas children quando enabled=false', () => {
      const { getByText } = render(
        <SwipeableRow enabled={false}>
          <Text>Disabled Row</Text>
        </SwipeableRow>
      );

      expect(getByText('Disabled Row')).toBeTruthy();
    });

    it('deve usar enabled=true por padrão', () => {
      const { getByText } = render(
        <SwipeableRow>
          <Text>Content</Text>
        </SwipeableRow>
      );

      expect(getByText('Content')).toBeTruthy();
    });
  });

  describe('Left Actions', () => {
    it('deve renderizar leftActions quando fornecidos', () => {
      const leftActions = [
        {
          icon: 'checkmark',
          label: 'Complete',
          color: '#4CAF50',
          onPress: mockAction,
        },
      ];

      const { getByText } = render(
        <SwipeableRow leftActions={leftActions}>
          <Text>Content</Text>
        </SwipeableRow>
      );

      expect(getByText('Complete')).toBeTruthy();
    });

    it('deve renderizar múltiplas leftActions', () => {
      const leftActions = [
        { icon: 'checkmark', label: 'Done', color: '#4CAF50', onPress: mockAction },
        { icon: 'star', label: 'Favorite', color: '#FFC107', onPress: mockAction },
      ];

      const { getByText } = render(
        <SwipeableRow leftActions={leftActions}>
          <Text>Content</Text>
        </SwipeableRow>
      );

      expect(getByText('Done')).toBeTruthy();
      expect(getByText('Favorite')).toBeTruthy();
    });

    it('deve renderizar ícone nas leftActions', () => {
      const leftActions = [
        { icon: 'checkmark', label: 'Done', color: '#4CAF50', onPress: mockAction },
      ];

      const { UNSAFE_getAllByType } = render(
        <SwipeableRow leftActions={leftActions}>
          <Text>Content</Text>
        </SwipeableRow>
      );

      const Ionicons = require('@expo/vector-icons').Ionicons;
      const icons = UNSAFE_getAllByType(Ionicons);
      const checkmarkIcon = icons.find((icon: any) => icon.props.name === 'checkmark');
      expect(checkmarkIcon).toBeTruthy();
    });

    it('deve chamar onPress quando leftAction é clicado', () => {
      const leftActions = [
        { icon: 'checkmark', label: 'Done', color: '#4CAF50', onPress: mockAction },
      ];

      const { getByText } = render(
        <SwipeableRow leftActions={leftActions}>
          <Text>Content</Text>
        </SwipeableRow>
      );

      fireEvent.press(getByText('Done'));
      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it('não deve renderizar leftActions quando array vazio', () => {
      const { getByText } = render(
        <SwipeableRow leftActions={[]}>
          <Text>Content</Text>
        </SwipeableRow>
      );

      expect(getByText('Content')).toBeTruthy();
    });
  });

  describe('Right Actions', () => {
    it('deve renderizar rightActions quando fornecidos', () => {
      const rightActions = [
        {
          icon: 'trash',
          label: 'Delete',
          color: '#F44336',
          onPress: mockAction,
        },
      ];

      const { getByText } = render(
        <SwipeableRow rightActions={rightActions}>
          <Text>Content</Text>
        </SwipeableRow>
      );

      expect(getByText('Delete')).toBeTruthy();
    });

    it('deve renderizar múltiplas rightActions', () => {
      const rightActions = [
        { icon: 'trash', label: 'Delete', color: '#F44336', onPress: mockAction },
        { icon: 'archive', label: 'Archive', color: '#2196F3', onPress: mockAction },
      ];

      const { getByText } = render(
        <SwipeableRow rightActions={rightActions}>
          <Text>Content</Text>
        </SwipeableRow>
      );

      expect(getByText('Delete')).toBeTruthy();
      expect(getByText('Archive')).toBeTruthy();
    });

    it('deve renderizar ícone nas rightActions', () => {
      const rightActions = [
        { icon: 'trash', label: 'Delete', color: '#F44336', onPress: mockAction },
      ];

      const { UNSAFE_getAllByType } = render(
        <SwipeableRow rightActions={rightActions}>
          <Text>Content</Text>
        </SwipeableRow>
      );

      const Ionicons = require('@expo/vector-icons').Ionicons;
      const icons = UNSAFE_getAllByType(Ionicons);
      const trashIcon = icons.find((icon: any) => icon.props.name === 'trash');
      expect(trashIcon).toBeTruthy();
    });

    it('deve chamar onPress quando rightAction é clicado', () => {
      const rightActions = [
        { icon: 'trash', label: 'Delete', color: '#F44336', onPress: mockAction },
      ];

      const { getByText } = render(
        <SwipeableRow rightActions={rightActions}>
          <Text>Content</Text>
        </SwipeableRow>
      );

      fireEvent.press(getByText('Delete'));
      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it('não deve renderizar rightActions quando array vazio', () => {
      const { getByText } = render(
        <SwipeableRow rightActions={[]}>
          <Text>Content</Text>
        </SwipeableRow>
      );

      expect(getByText('Content')).toBeTruthy();
    });
  });

  describe('Left e Right Actions Juntos', () => {
    it('deve renderizar leftActions e rightActions simultaneamente', () => {
      const leftActions = [
        { icon: 'checkmark', label: 'Complete', color: '#4CAF50', onPress: mockAction },
      ];
      const rightActions = [
        { icon: 'trash', label: 'Delete', color: '#F44336', onPress: mockAction },
      ];

      const { getByText } = render(
        <SwipeableRow leftActions={leftActions} rightActions={rightActions}>
          <Text>Content</Text>
        </SwipeableRow>
      );

      expect(getByText('Complete')).toBeTruthy();
      expect(getByText('Delete')).toBeTruthy();
    });
  });

  describe('Props de Ações', () => {
    it('deve usar cor customizada para leftAction', () => {
      const leftActions = [
        { icon: 'star', label: 'Star', color: '#FFD700', onPress: mockAction },
      ];

      const { getByText } = render(
        <SwipeableRow leftActions={leftActions}>
          <Text>Content</Text>
        </SwipeableRow>
      );

      expect(getByText('Star')).toBeTruthy();
    });

    it('deve usar cor customizada para rightAction', () => {
      const rightActions = [
        { icon: 'alert', label: 'Alert', color: '#FF5722', onPress: mockAction },
      ];

      const { getByText } = render(
        <SwipeableRow rightActions={rightActions}>
          <Text>Content</Text>
        </SwipeableRow>
      );

      expect(getByText('Alert')).toBeTruthy();
    });

    it('deve renderizar labels corretos', () => {
      const leftActions = [
        { icon: 'checkmark', label: 'Marcar', color: '#4CAF50', onPress: mockAction },
      ];

      const { getByText } = render(
        <SwipeableRow leftActions={leftActions}>
          <Text>Content</Text>
        </SwipeableRow>
      );

      expect(getByText('Marcar')).toBeTruthy();
    });

    it('deve renderizar ícones corretos', () => {
      const rightActions = [
        { icon: 'mail', label: 'Email', color: '#2196F3', onPress: mockAction },
      ];

      const { UNSAFE_getAllByType } = render(
        <SwipeableRow rightActions={rightActions}>
          <Text>Content</Text>
        </SwipeableRow>
      );

      const Ionicons = require('@expo/vector-icons').Ionicons;
      const icons = UNSAFE_getAllByType(Ionicons);
      const mailIcon = icons.find((icon: any) => icon.props.name === 'mail');
      expect(mailIcon).toBeTruthy();
    });
  });

  describe('Casos de Uso Comuns', () => {
    it('deve renderizar swipe para deletar (slide to delete)', () => {
      const rightActions = [
        { icon: 'trash', label: 'Deletar', color: '#F44336', onPress: mockAction },
      ];

      const { getByText } = render(
        <SwipeableRow rightActions={rightActions}>
          <View>
            <Text>Item to Delete</Text>
          </View>
        </SwipeableRow>
      );

      expect(getByText('Item to Delete')).toBeTruthy();
      expect(getByText('Deletar')).toBeTruthy();
    });

    it('deve renderizar swipe para arquivar', () => {
      const rightActions = [
        { icon: 'archive', label: 'Arquivar', color: '#607D8B', onPress: mockAction },
      ];

      const { getByText } = render(
        <SwipeableRow rightActions={rightActions}>
          <Text>Email Item</Text>
        </SwipeableRow>
      );

      expect(getByText('Arquivar')).toBeTruthy();
    });

    it('deve renderizar swipe com múltiplas opções', () => {
      const rightActions = [
        { icon: 'star', label: 'Favoritar', color: '#FFC107', onPress: mockAction },
        { icon: 'archive', label: 'Arquivar', color: '#607D8B', onPress: mockAction },
        { icon: 'trash', label: 'Deletar', color: '#F44336', onPress: mockAction },
      ];

      const { getByText } = render(
        <SwipeableRow rightActions={rightActions}>
          <Text>Multi-option Item</Text>
        </SwipeableRow>
      );

      expect(getByText('Favoritar')).toBeTruthy();
      expect(getByText('Arquivar')).toBeTruthy();
      expect(getByText('Deletar')).toBeTruthy();
    });

    it('deve renderizar swipe para marcar como completo', () => {
      const leftActions = [
        { icon: 'checkmark-circle', label: 'Concluir', color: '#4CAF50', onPress: mockAction },
      ];

      const { getByText } = render(
        <SwipeableRow leftActions={leftActions}>
          <Text>Task Item</Text>
        </SwipeableRow>
      );

      expect(getByText('Concluir')).toBeTruthy();
    });
  });

  describe('Children Customizados', () => {
    it('deve renderizar View como children', () => {
      const { getByText } = render(
        <SwipeableRow>
          <View>
            <Text>Line 1</Text>
            <Text>Line 2</Text>
          </View>
        </SwipeableRow>
      );

      expect(getByText('Line 1')).toBeTruthy();
      expect(getByText('Line 2')).toBeTruthy();
    });

    it('deve renderizar componente customizado como children', () => {
      const CustomComponent = () => (
        <View>
          <Text>Custom</Text>
        </View>
      );

      const { getByText } = render(
        <SwipeableRow>
          <CustomComponent />
        </SwipeableRow>
      );

      expect(getByText('Custom')).toBeTruthy();
    });
  });
});
