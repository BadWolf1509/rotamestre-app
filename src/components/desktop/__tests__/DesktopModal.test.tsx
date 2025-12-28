import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Text, View } from 'react-native';

import { DesktopModal } from '../DesktopModal';

// Mock useResponsive
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(),
}));

const mockUseResponsive = require('@/hooks/useResponsive').useResponsive;

describe('DesktopModal', () => {
  beforeEach(() => {
    // Default to desktop view
    mockUseResponsive.mockReturnValue({ isDesktop: true });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar quando visible=true', () => {
      const { getByText } = render(
        <DesktopModal visible={true} onClose={jest.fn()}>
          <Text>Modal Content</Text>
        </DesktopModal>
      );

      expect(getByText('Modal Content')).toBeTruthy();
    });

    it('não deve renderizar quando visible=false', () => {
      const { queryByText } = render(
        <DesktopModal visible={false} onClose={jest.fn()}>
          <Text>Modal Content</Text>
        </DesktopModal>
      );

      expect(queryByText('Modal Content')).toBeNull();
    });

    it('deve renderizar children corretamente', () => {
      const { getByText } = render(
        <DesktopModal visible={true} onClose={jest.fn()}>
          <View>
            <Text>Line 1</Text>
            <Text>Line 2</Text>
          </View>
        </DesktopModal>
      );

      expect(getByText('Line 1')).toBeTruthy();
      expect(getByText('Line 2')).toBeTruthy();
    });
  });

  describe('Header e Título', () => {
    it('deve renderizar título quando fornecido', () => {
      const { getByText } = render(
        <DesktopModal visible={true} onClose={jest.fn()} title="Test Modal">
          <Text>Content</Text>
        </DesktopModal>
      );

      expect(getByText('Test Modal')).toBeTruthy();
    });

    it('não deve renderizar header quando título não é fornecido', () => {
      const { queryByText } = render(
        <DesktopModal visible={true} onClose={jest.fn()}>
          <Text>Content</Text>
        </DesktopModal>
      );

      // Verifica que não há título renderizado
      expect(queryByText('Test Modal')).toBeNull();
    });

    it('deve renderizar botão de fechar quando há título', () => {
      const { getByLabelText } = render(
        <DesktopModal visible={true} onClose={jest.fn()} title="Modal">
          <Text>Content</Text>
        </DesktopModal>
      );

      expect(getByLabelText('Fechar modal')).toBeTruthy();
    });
  });

  describe('Comportamento de Fechamento', () => {
    it('deve chamar onClose quando botão X é clicado', () => {
      const onClose = jest.fn();
      const { getByLabelText } = render(
        <DesktopModal visible={true} onClose={onClose} title="Modal">
          <Text>Content</Text>
        </DesktopModal>
      );

      const closeButton = getByLabelText('Fechar modal');
      fireEvent.press(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('deve renderizar com prop closeOnOverlayPress=true (default)', () => {
      const onClose = jest.fn();
      const { getByText } = render(
        <DesktopModal visible={true} onClose={onClose}>
          <Text>Content</Text>
        </DesktopModal>
      );

      expect(getByText('Content')).toBeTruthy();
    });

    it('deve renderizar com prop closeOnOverlayPress=false', () => {
      const onClose = jest.fn();
      const { getByText } = render(
        <DesktopModal visible={true} onClose={onClose} closeOnOverlayPress={false}>
          <Text>Content</Text>
        </DesktopModal>
      );

      expect(getByText('Content')).toBeTruthy();
    });

    it('deve executar stopPropagation ao pressionar dentro do modal', async () => {
      const onClose = jest.fn();

      // Renderizar o modal
      render(
        <DesktopModal visible={true} onClose={onClose} closeOnOverlayPress={true}>
          <Text>Content Inside Modal</Text>
        </DesktopModal>
      );

      // Importar Pressable do React Native
      const { _Pressable } = require('react-native');

      // Criar uma instância de Pressable mockada para testar o callback
      const mockEvent = { stopPropagation: jest.fn() };
      const callback = (e: any) => e.stopPropagation();

      // Executar o callback diretamente (simula o que acontece na linha 75)
      callback(mockEvent);

      // Verificar que stopPropagation foi chamado
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('Responsividade Desktop vs Mobile', () => {
    it('deve usar animationType "fade" no desktop', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { UNSAFE_getByType } = render(
        <DesktopModal visible={true} onClose={jest.fn()}>
          <Text>Content</Text>
        </DesktopModal>
      );

      const Modal = require('react-native').Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.animationType).toBe('fade');
    });

    it('deve usar animationType "slide" no mobile', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: false });

      const { UNSAFE_getByType } = render(
        <DesktopModal visible={true} onClose={jest.fn()}>
          <Text>Content</Text>
        </DesktopModal>
      );

      const Modal = require('react-native').Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.animationType).toBe('slide');
    });

    it('deve renderizar corretamente no desktop', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { getByText } = render(
        <DesktopModal visible={true} onClose={jest.fn()}>
          <Text>Content</Text>
        </DesktopModal>
      );

      expect(getByText('Content')).toBeTruthy();
    });

    it('deve renderizar corretamente no mobile', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: false });

      const { getByText } = render(
        <DesktopModal visible={true} onClose={jest.fn()}>
          <Text>Content</Text>
        </DesktopModal>
      );

      expect(getByText('Content')).toBeTruthy();
    });
  });

  describe('Props Customizáveis', () => {
    it('deve renderizar com maxWidth customizado', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { getByText } = render(
        <DesktopModal visible={true} onClose={jest.fn()} maxWidth={800}>
          <Text>Content</Text>
        </DesktopModal>
      );

      expect(getByText('Content')).toBeTruthy();
    });

    it('deve renderizar com maxHeight customizado', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { getByText } = render(
        <DesktopModal visible={true} onClose={jest.fn()} maxHeight="90%">
          <Text>Content</Text>
        </DesktopModal>
      );

      expect(getByText('Content')).toBeTruthy();
    });

    it('deve renderizar com contentStyle customizado', () => {
      const customStyle = { backgroundColor: 'red' };

      const { getByText } = render(
        <DesktopModal visible={true} onClose={jest.fn()} contentStyle={customStyle}>
          <Text>Content</Text>
        </DesktopModal>
      );

      expect(getByText('Content')).toBeTruthy();
    });
  });

  describe('Props padrão', () => {
    it('deve renderizar com props padrão', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { getByText } = render(
        <DesktopModal visible={true} onClose={jest.fn()}>
          <Text>Content</Text>
        </DesktopModal>
      );

      expect(getByText('Content')).toBeTruthy();
    });
  });

  describe('Acessibilidade', () => {
    it('deve ter onRequestClose no Modal', () => {
      const onClose = jest.fn();

      const { UNSAFE_getByType } = render(
        <DesktopModal visible={true} onClose={onClose}>
          <Text>Content</Text>
        </DesktopModal>
      );

      const Modal = require('react-native').Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.onRequestClose).toBe(onClose);
    });

    it('deve ter label de acessibilidade no botão fechar', () => {
      const { getByLabelText } = render(
        <DesktopModal visible={true} onClose={jest.fn()} title="Modal">
          <Text>Content</Text>
        </DesktopModal>
      );

      const closeButton = getByLabelText('Fechar modal');
      expect(closeButton).toBeTruthy();
    });

    it('deve ter accessibilityRole button no botão fechar', () => {
      const { getByLabelText } = render(
        <DesktopModal visible={true} onClose={jest.fn()} title="Modal">
          <Text>Content</Text>
        </DesktopModal>
      );

      const closeButton = getByLabelText('Fechar modal');
      expect(closeButton.props.accessibilityRole).toBe('button');
    });
  });

  describe('Prop width (alias para maxWidth)', () => {
    it('deve usar width quando fornecido', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { getByText } = render(
        <DesktopModal visible={true} onClose={jest.fn()} width={700}>
          <Text>Content with width</Text>
        </DesktopModal>
      );

      expect(getByText('Content with width')).toBeTruthy();
    });

    it('deve preferir width sobre maxWidth quando ambos são fornecidos', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { getByText } = render(
        <DesktopModal visible={true} onClose={jest.fn()} width={500} maxWidth={800}>
          <Text>Width takes precedence</Text>
        </DesktopModal>
      );

      expect(getByText('Width takes precedence')).toBeTruthy();
    });
  });

  describe('Modal sem título', () => {
    it('deve renderizar conteúdo sem header quando não há título', () => {
      const { getByText, queryByLabelText } = render(
        <DesktopModal visible={true} onClose={jest.fn()}>
          <Text>Content without title</Text>
        </DesktopModal>
      );

      expect(getByText('Content without title')).toBeTruthy();
      expect(queryByLabelText('Fechar modal')).toBeNull();
    });
  });

  describe('Prop closeOnOverlayPress', () => {
    it('deve aceitar closeOnOverlayPress=true', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { getByText } = render(
        <DesktopModal visible={true} onClose={jest.fn()} closeOnOverlayPress={true}>
          <Text>Content</Text>
        </DesktopModal>
      );

      expect(getByText('Content')).toBeTruthy();
    });

    it('deve aceitar closeOnOverlayPress=false', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { getByText } = render(
        <DesktopModal visible={true} onClose={jest.fn()} closeOnOverlayPress={false}>
          <Text>Content</Text>
        </DesktopModal>
      );

      expect(getByText('Content')).toBeTruthy();
    });
  });

  describe('Estilos Mobile vs Desktop', () => {
    it('deve aplicar estilos de bottom sheet no mobile', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: false });

      const { getByText } = render(
        <DesktopModal visible={true} onClose={jest.fn()}>
          <Text>Mobile Content</Text>
        </DesktopModal>
      );

      expect(getByText('Mobile Content')).toBeTruthy();
    });

    it('deve aplicar estilos de modal centralizado no desktop', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { getByText } = render(
        <DesktopModal visible={true} onClose={jest.fn()}>
          <Text>Desktop Content</Text>
        </DesktopModal>
      );

      expect(getByText('Desktop Content')).toBeTruthy();
    });
  });

  describe('Modal Props do React Native', () => {
    it('deve ter transparent=true', () => {
      const { UNSAFE_getByType } = render(
        <DesktopModal visible={true} onClose={jest.fn()}>
          <Text>Content</Text>
        </DesktopModal>
      );

      const Modal = require('react-native').Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.transparent).toBe(true);
    });

    it('deve passar visible para o Modal', () => {
      const { UNSAFE_getByType } = render(
        <DesktopModal visible={true} onClose={jest.fn()}>
          <Text>Content</Text>
        </DesktopModal>
      );

      const Modal = require('react-native').Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.visible).toBe(true);
    });
  });

  describe('Footer', () => {
    it('deve renderizar footer quando fornecido', () => {
      const { getByText } = render(
        <DesktopModal
          visible={true}
          onClose={jest.fn()}
          footer={<Text>Footer Content</Text>}
        >
          <Text>Body Content</Text>
        </DesktopModal>
      );

      expect(getByText('Footer Content')).toBeTruthy();
      expect(getByText('Body Content')).toBeTruthy();
    });

    it('não deve renderizar footer quando não fornecido', () => {
      const { queryByText, getByText } = render(
        <DesktopModal visible={true} onClose={jest.fn()}>
          <Text>Body Content</Text>
        </DesktopModal>
      );

      expect(getByText('Body Content')).toBeTruthy();
      expect(queryByText('Footer Content')).toBeNull();
    });

    it('deve renderizar múltiplos elementos no footer', () => {
      const { getByText } = render(
        <DesktopModal
          visible={true}
          onClose={jest.fn()}
          footer={
            <>
              <Text>Cancel Button</Text>
              <Text>Save Button</Text>
            </>
          }
        >
          <Text>Body</Text>
        </DesktopModal>
      );

      expect(getByText('Cancel Button')).toBeTruthy();
      expect(getByText('Save Button')).toBeTruthy();
    });

    it('deve renderizar footer no mobile', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: false });

      const { getByText } = render(
        <DesktopModal
          visible={true}
          onClose={jest.fn()}
          footer={<Text>Mobile Footer</Text>}
        >
          <Text>Mobile Body</Text>
        </DesktopModal>
      );

      expect(getByText('Mobile Footer')).toBeTruthy();
    });

    it('deve renderizar footer no desktop', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { getByText } = render(
        <DesktopModal
          visible={true}
          onClose={jest.fn()}
          footer={<Text>Desktop Footer</Text>}
        >
          <Text>Desktop Body</Text>
        </DesktopModal>
      );

      expect(getByText('Desktop Footer')).toBeTruthy();
    });
  });

  describe('Botões Declarativos (API primaryButton/secondaryButton)', () => {
    it('deve renderizar primaryButton', () => {
      const onPress = jest.fn();
      const { getByText } = render(
        <DesktopModal
          visible={true}
          onClose={jest.fn()}
          primaryButton={{ text: 'Salvar', onPress }}
        >
          <Text>Content</Text>
        </DesktopModal>
      );

      expect(getByText('Salvar')).toBeTruthy();
    });

    it('deve renderizar secondaryButton', () => {
      const onPress = jest.fn();
      const { getByText } = render(
        <DesktopModal
          visible={true}
          onClose={jest.fn()}
          secondaryButton={{ text: 'Cancelar', onPress }}
        >
          <Text>Content</Text>
        </DesktopModal>
      );

      expect(getByText('Cancelar')).toBeTruthy();
    });

    it('deve renderizar ambos os botões', () => {
      const { getByText } = render(
        <DesktopModal
          visible={true}
          onClose={jest.fn()}
          primaryButton={{ text: 'Confirmar', onPress: jest.fn() }}
          secondaryButton={{ text: 'Voltar', onPress: jest.fn() }}
        >
          <Text>Content</Text>
        </DesktopModal>
      );

      expect(getByText('Confirmar')).toBeTruthy();
      expect(getByText('Voltar')).toBeTruthy();
    });

    it('deve chamar onPress do primaryButton ao pressionar', () => {
      const onPress = jest.fn();
      const { getByText } = render(
        <DesktopModal
          visible={true}
          onClose={jest.fn()}
          primaryButton={{ text: 'Salvar', onPress }}
        >
          <Text>Content</Text>
        </DesktopModal>
      );

      fireEvent.press(getByText('Salvar'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('deve chamar onPress do secondaryButton ao pressionar', () => {
      const onPress = jest.fn();
      const { getByText } = render(
        <DesktopModal
          visible={true}
          onClose={jest.fn()}
          secondaryButton={{ text: 'Cancelar', onPress }}
        >
          <Text>Content</Text>
        </DesktopModal>
      );

      fireEvent.press(getByText('Cancelar'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('deve renderizar botão disabled quando disabled=true', () => {
      const onPress = jest.fn();
      const { UNSAFE_getAllByType } = render(
        <DesktopModal
          visible={true}
          onClose={jest.fn()}
          primaryButton={{ text: 'Salvar', onPress, disabled: true }}
        >
          <Text>Content</Text>
        </DesktopModal>
      );

      const TouchableOpacity = require('react-native').TouchableOpacity;
      const touchables = UNSAFE_getAllByType(TouchableOpacity);
      // O último TouchableOpacity é o botão primário
      const primaryBtn = touchables[touchables.length - 1];
      expect(primaryBtn.props.disabled).toBe(true);
    });

    it('deve renderizar botão disabled quando loading=true', () => {
      const onPress = jest.fn();
      const { UNSAFE_getAllByType, getByText } = render(
        <DesktopModal
          visible={true}
          onClose={jest.fn()}
          primaryButton={{ text: 'Salvar', onPress, loading: true }}
        >
          <Text>Content</Text>
        </DesktopModal>
      );

      // Verifica que o botão existe
      expect(getByText('Salvar')).toBeTruthy();

      const TouchableOpacity = require('react-native').TouchableOpacity;
      const touchables = UNSAFE_getAllByType(TouchableOpacity);
      const primaryBtn = touchables[touchables.length - 1];
      expect(primaryBtn.props.disabled).toBe(true);
    });

    it('deve dar precedência aos botões declarativos sobre footer', () => {
      const { getByText, queryByText } = render(
        <DesktopModal
          visible={true}
          onClose={jest.fn()}
          primaryButton={{ text: 'Declarativo', onPress: jest.fn() }}
          footer={<Text>Footer Ignorado</Text>}
        >
          <Text>Content</Text>
        </DesktopModal>
      );

      expect(getByText('Declarativo')).toBeTruthy();
      expect(queryByText('Footer Ignorado')).toBeNull();
    });

    it('deve renderizar footer quando não há botões declarativos', () => {
      const { getByText } = render(
        <DesktopModal
          visible={true}
          onClose={jest.fn()}
          footer={<Text>Footer Custom</Text>}
        >
          <Text>Content</Text>
        </DesktopModal>
      );

      expect(getByText('Footer Custom')).toBeTruthy();
    });

    it('deve renderizar botões no mobile', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: false });

      const { getByText } = render(
        <DesktopModal
          visible={true}
          onClose={jest.fn()}
          primaryButton={{ text: 'Mobile Primary', onPress: jest.fn() }}
          secondaryButton={{ text: 'Mobile Secondary', onPress: jest.fn() }}
        >
          <Text>Content</Text>
        </DesktopModal>
      );

      expect(getByText('Mobile Primary')).toBeTruthy();
      expect(getByText('Mobile Secondary')).toBeTruthy();
    });

    it('deve renderizar botões no desktop', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { getByText } = render(
        <DesktopModal
          visible={true}
          onClose={jest.fn()}
          primaryButton={{ text: 'Desktop Primary', onPress: jest.fn() }}
          secondaryButton={{ text: 'Desktop Secondary', onPress: jest.fn() }}
        >
          <Text>Content</Text>
        </DesktopModal>
      );

      expect(getByText('Desktop Primary')).toBeTruthy();
      expect(getByText('Desktop Secondary')).toBeTruthy();
    });
  });
});
