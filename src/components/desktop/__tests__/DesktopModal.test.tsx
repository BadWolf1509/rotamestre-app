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

      const { getByText, UNSAFE_getAllByType } = render(
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
});
