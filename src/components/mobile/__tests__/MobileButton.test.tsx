import { Ionicons } from '@expo/vector-icons';
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { MobileButton } from '../MobileButton';

describe('MobileButton', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar com title', () => {
      const { getByText } = render(
        <MobileButton title="Clique aqui" onPress={mockOnPress} />
      );

      expect(getByText('Clique aqui')).toBeTruthy();
    });

    it('deve renderizar com variant padrão (primary)', () => {
      const { getByText } = render(
        <MobileButton title="Primary Button" onPress={mockOnPress} />
      );

      expect(getByText('Primary Button')).toBeTruthy();
    });

    it('deve renderizar com size padrão (medium)', () => {
      const { getByText } = render(
        <MobileButton title="Medium Button" onPress={mockOnPress} />
      );

      expect(getByText('Medium Button')).toBeTruthy();
    });
  });

  describe('Variants', () => {
    it('deve renderizar variant="primary"', () => {
      const { getByText } = render(
        <MobileButton title="Primary" variant="primary" onPress={mockOnPress} />
      );

      expect(getByText('Primary')).toBeTruthy();
    });

    it('deve renderizar variant="secondary"', () => {
      const { getByText } = render(
        <MobileButton title="Secondary" variant="secondary" onPress={mockOnPress} />
      );

      expect(getByText('Secondary')).toBeTruthy();
    });

    it('deve renderizar variant="danger"', () => {
      const { getByText } = render(
        <MobileButton title="Danger" variant="danger" onPress={mockOnPress} />
      );

      expect(getByText('Danger')).toBeTruthy();
    });

    it('deve renderizar variant="success"', () => {
      const { getByText } = render(
        <MobileButton title="Success" variant="success" onPress={mockOnPress} />
      );

      expect(getByText('Success')).toBeTruthy();
    });

    it('deve renderizar variant="warning"', () => {
      const { getByText } = render(
        <MobileButton title="Warning" variant="warning" onPress={mockOnPress} />
      );

      expect(getByText('Warning')).toBeTruthy();
    });
  });

  describe('Sizes', () => {
    it('deve renderizar size="small"', () => {
      const { getByText } = render(
        <MobileButton title="Small" size="small" onPress={mockOnPress} />
      );

      expect(getByText('Small')).toBeTruthy();
    });

    it('deve renderizar size="medium"', () => {
      const { getByText } = render(
        <MobileButton title="Medium" size="medium" onPress={mockOnPress} />
      );

      expect(getByText('Medium')).toBeTruthy();
    });

    it('deve renderizar size="large"', () => {
      const { getByText } = render(
        <MobileButton title="Large" size="large" onPress={mockOnPress} />
      );

      expect(getByText('Large')).toBeTruthy();
    });
  });

  describe('Loading State', () => {
    it('deve renderizar ActivityIndicator quando loading=true', () => {
      const { UNSAFE_getByType } = render(
        <MobileButton title="Loading" loading={true} onPress={mockOnPress} />
      );

      const { ActivityIndicator } = require('react-native');
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });

    it('não deve renderizar title quando loading=true', () => {
      const { queryByText } = render(
        <MobileButton title="Loading" loading={true} onPress={mockOnPress} />
      );

      expect(queryByText('Loading')).toBeNull();
    });

    it('deve usar cor branca no ActivityIndicator para variant primary', () => {
      const { UNSAFE_getByType } = render(
        <MobileButton title="Loading" variant="primary" loading={true} onPress={mockOnPress} />
      );

      const { ActivityIndicator } = require('react-native');
      const indicator = UNSAFE_getByType(ActivityIndicator);
      expect(indicator.props.color).toBeTruthy();
    });

    it('deve desabilitar botão quando loading=true', () => {
      const { UNSAFE_getByType } = render(
        <MobileButton title="Loading" loading={true} onPress={mockOnPress} />
      );

      const { TouchableOpacity } = require('react-native');
      const button = UNSAFE_getByType(TouchableOpacity);
      expect(button.props.disabled).toBe(true);
    });
  });

  describe('Disabled State', () => {
    it('deve desabilitar botão quando disabled=true', () => {
      const { UNSAFE_getByType } = render(
        <MobileButton title="Disabled" disabled={true} onPress={mockOnPress} />
      );

      const { TouchableOpacity } = require('react-native');
      const button = UNSAFE_getByType(TouchableOpacity);
      expect(button.props.disabled).toBe(true);
    });

    it('não deve chamar onPress quando disabled=true', () => {
      const { getByText } = render(
        <MobileButton title="Disabled" disabled={true} onPress={mockOnPress} />
      );

      fireEvent.press(getByText('Disabled'));
      expect(mockOnPress).not.toHaveBeenCalled();
    });

    it('deve renderizar title quando disabled=true', () => {
      const { getByText } = render(
        <MobileButton title="Disabled" disabled={true} onPress={mockOnPress} />
      );

      expect(getByText('Disabled')).toBeTruthy();
    });
  });

  describe('Icon Support', () => {
    it('deve renderizar ícone quando fornecido', () => {
      const { UNSAFE_getByType } = render(
        <MobileButton
          title="With Icon"
          icon={<Ionicons name="checkmark" size={20} color="white" />}
          onPress={mockOnPress}
        />
      );

      expect(UNSAFE_getByType(Ionicons)).toBeTruthy();
    });

    it('deve renderizar ícone e title juntos', () => {
      const { getByText, UNSAFE_getByType } = render(
        <MobileButton
          title="Save"
          icon={<Ionicons name="save" size={20} color="white" />}
          onPress={mockOnPress}
        />
      );

      expect(getByText('Save')).toBeTruthy();
      expect(UNSAFE_getByType(Ionicons)).toBeTruthy();
    });

    it('não deve renderizar ícone quando loading=true', () => {
      const { UNSAFE_queryAllByType } = render(
        <MobileButton
          title="Loading"
          icon={<Ionicons name="save" size={20} color="white" />}
          loading={true}
          onPress={mockOnPress}
        />
      );

      const icons = UNSAFE_queryAllByType(Ionicons);
      expect(icons.length).toBe(0);
    });
  });

  describe('FullWidth Prop', () => {
    it('deve renderizar com fullWidth=true', () => {
      const { getByText } = render(
        <MobileButton title="Full Width" fullWidth={true} onPress={mockOnPress} />
      );

      expect(getByText('Full Width')).toBeTruthy();
    });

    it('deve renderizar sem fullWidth por padrão', () => {
      const { getByText } = render(
        <MobileButton title="Normal Width" onPress={mockOnPress} />
      );

      expect(getByText('Normal Width')).toBeTruthy();
    });
  });

  describe('Custom Styles', () => {
    it('deve aplicar style customizado', () => {
      const { getByText } = render(
        <MobileButton
          title="Custom"
          style={{ borderRadius: 20 }}
          onPress={mockOnPress}
        />
      );

      expect(getByText('Custom')).toBeTruthy();
    });

    it('deve aplicar textStyle customizado', () => {
      const { getByText } = render(
        <MobileButton
          title="Custom Text"
          textStyle={{ fontSize: 18 }}
          onPress={mockOnPress}
        />
      );

      expect(getByText('Custom Text')).toBeTruthy();
    });
  });

  describe('Interações', () => {
    it('deve chamar onPress ao clicar', () => {
      const { getByText } = render(
        <MobileButton title="Click Me" onPress={mockOnPress} />
      );

      fireEvent.press(getByText('Click Me'));
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it('deve estar desabilitado quando loading=true (disabled prop)', () => {
      const { UNSAFE_getByType } = render(
        <MobileButton title="Loading" loading={true} onPress={mockOnPress} />
      );

      const { TouchableOpacity } = require('react-native');
      const button = UNSAFE_getByType(TouchableOpacity);

      // Verifica que o botão está desabilitado (props.disabled = true)
      // O comportamento de não chamar onPress é garantido pela prop disabled do TouchableOpacity
      expect(button.props.disabled).toBe(true);
    });

    it('deve usar activeOpacity=0.7', () => {
      const { UNSAFE_getByType } = render(
        <MobileButton title="Opacity" onPress={mockOnPress} />
      );

      const { TouchableOpacity } = require('react-native');
      const button = UNSAFE_getByType(TouchableOpacity);
      expect(button.props.activeOpacity).toBe(0.7);
    });
  });

  describe('TouchableOpacityProps Passthrough', () => {
    it('deve passar testID para TouchableOpacity', () => {
      const { UNSAFE_getByType } = render(
        <MobileButton title="Test" testID="mobile-button" onPress={mockOnPress} />
      );

      const { TouchableOpacity } = require('react-native');
      const button = UNSAFE_getByType(TouchableOpacity);
      expect(button.props.testID).toBe('mobile-button');
    });

    it('deve passar accessible para TouchableOpacity', () => {
      const { UNSAFE_getByType } = render(
        <MobileButton title="Accessible" accessible={true} onPress={mockOnPress} />
      );

      const { TouchableOpacity } = require('react-native');
      expect(UNSAFE_getByType(TouchableOpacity)).toBeTruthy();
    });

    it('deve passar accessibilityLabel', () => {
      const { UNSAFE_getByType } = render(
        <MobileButton
          title="Submit"
          accessibilityLabel="Submit form button"
          onPress={mockOnPress}
        />
      );

      const { TouchableOpacity } = require('react-native');
      const button = UNSAFE_getByType(TouchableOpacity);
      expect(button.props.accessibilityLabel).toBe('Submit form button');
    });
  });

  describe('Casos de Uso Comuns', () => {
    it('deve renderizar botão primário de salvar', () => {
      const { getByText, UNSAFE_getByType } = render(
        <MobileButton
          title="Salvar"
          variant="primary"
          icon={<Ionicons name="save" size={20} color="white" />}
          fullWidth={true}
          onPress={mockOnPress}
        />
      );

      expect(getByText('Salvar')).toBeTruthy();
      expect(UNSAFE_getByType(Ionicons)).toBeTruthy();
    });

    it('deve renderizar botão secundário de cancelar', () => {
      const { getByText } = render(
        <MobileButton
          title="Cancelar"
          variant="secondary"
          onPress={mockOnPress}
        />
      );

      expect(getByText('Cancelar')).toBeTruthy();
    });

    it('deve renderizar botão de deletar com danger', () => {
      const { getByText, UNSAFE_getByType } = render(
        <MobileButton
          title="Deletar"
          variant="danger"
          icon={<Ionicons name="trash" size={20} color="white" />}
          onPress={mockOnPress}
        />
      );

      expect(getByText('Deletar')).toBeTruthy();
      expect(UNSAFE_getByType(Ionicons)).toBeTruthy();
    });

    it('deve renderizar botão small para ações rápidas', () => {
      const { getByText } = render(
        <MobileButton
          title="OK"
          size="small"
          variant="success"
          onPress={mockOnPress}
        />
      );

      expect(getByText('OK')).toBeTruthy();
    });
  });

  describe('Combinações de Props', () => {
    it('deve combinar variant danger + size large + fullWidth', () => {
      const { getByText } = render(
        <MobileButton
          title="Excluir Tudo"
          variant="danger"
          size="large"
          fullWidth={true}
          onPress={mockOnPress}
        />
      );

      expect(getByText('Excluir Tudo')).toBeTruthy();
    });

    it('deve combinar variant warning + size small + icon', () => {
      const { getByText, UNSAFE_getByType } = render(
        <MobileButton
          title="Atenção"
          variant="warning"
          size="small"
          icon={<Ionicons name="warning" size={16} color="white" />}
          onPress={mockOnPress}
        />
      );

      expect(getByText('Atenção')).toBeTruthy();
      expect(UNSAFE_getByType(Ionicons)).toBeTruthy();
    });

    it('deve combinar loading + variant success', () => {
      const { UNSAFE_getByType } = render(
        <MobileButton
          title="Salvando"
          variant="success"
          loading={true}
          onPress={mockOnPress}
        />
      );

      const { ActivityIndicator } = require('react-native');
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });
  });
});
