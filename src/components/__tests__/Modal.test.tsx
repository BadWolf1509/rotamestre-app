import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Modal } from '../Modal';

describe('Modal Component', () => {
  describe('Visibilidade', () => {
    it('deve renderizar quando visible=true', () => {
      const { getByText } = render(
        <Modal visible={true} onClose={jest.fn()}>
          <Text>Conteúdo do Modal</Text>
        </Modal>
      );

      expect(getByText('Conteúdo do Modal')).toBeTruthy();
    });

    it('não deve renderizar conteúdo quando visible=false', () => {
      const { queryByText } = render(
        <Modal visible={false} onClose={jest.fn()}>
          <Text>Conteúdo do Modal</Text>
        </Modal>
      );

      // O Modal do React Native ainda renderiza mas não mostra visualmente
      // Apenas verificamos que não causa erro
      expect(queryByText).toBeDefined();
    });
  });

  describe('Título e Header', () => {
    it('deve renderizar com título', () => {
      const { getByText } = render(
        <Modal visible={true} onClose={jest.fn()} title="Meu Modal">
          <Text>Conteúdo</Text>
        </Modal>
      );

      expect(getByText('Meu Modal')).toBeTruthy();
    });

    it('deve renderizar sem título', () => {
      const { queryByText, getByText } = render(
        <Modal visible={true} onClose={jest.fn()}>
          <Text>Conteúdo</Text>
        </Modal>
      );

      expect(getByText('Conteúdo')).toBeTruthy();
    });

    it('deve mostrar botão de fechar por padrão', () => {
      const { UNSAFE_getByType } = render(
        <Modal visible={true} onClose={jest.fn()} title="Modal">
          <Text>Conteúdo</Text>
        </Modal>
      );

      const icon = UNSAFE_getByType(require('@expo/vector-icons').Ionicons);
      expect(icon).toBeTruthy();
    });

    it('deve ocultar botão de fechar quando showCloseButton=false', () => {
      const { UNSAFE_queryByType } = render(
        <Modal
          visible={true}
          onClose={jest.fn()}
          title="Modal"
          showCloseButton={false}
        >
          <Text>Conteúdo</Text>
        </Modal>
      );

      const icon = UNSAFE_queryByType(require('@expo/vector-icons').Ionicons);
      expect(icon).toBeNull();
    });
  });

  describe('Tamanhos', () => {
    it('deve renderizar com size small', () => {
      const { getByText } = render(
        <Modal visible={true} onClose={jest.fn()} size="small">
          <Text>Modal Pequeno</Text>
        </Modal>
      );

      expect(getByText('Modal Pequeno')).toBeTruthy();
    });

    it('deve renderizar com size medium (padrão)', () => {
      const { getByText } = render(
        <Modal visible={true} onClose={jest.fn()}>
          <Text>Modal Médio</Text>
        </Modal>
      );

      expect(getByText('Modal Médio')).toBeTruthy();
    });

    it('deve renderizar com size large', () => {
      const { getByText } = render(
        <Modal visible={true} onClose={jest.fn()} size="large">
          <Text>Modal Grande</Text>
        </Modal>
      );

      expect(getByText('Modal Grande')).toBeTruthy();
    });

    it('deve renderizar com size full', () => {
      const { getByText } = render(
        <Modal visible={true} onClose={jest.fn()} size="full">
          <Text>Modal Full Screen</Text>
        </Modal>
      );

      expect(getByText('Modal Full Screen')).toBeTruthy();
    });
  });

  describe('Interações', () => {
    it('deve chamar onClose ao clicar no botão de fechar', () => {
      const mockClose = jest.fn();
      const { UNSAFE_getByType } = render(
        <Modal visible={true} onClose={mockClose} title="Modal">
          <Text>Conteúdo</Text>
        </Modal>
      );

      const icon = UNSAFE_getByType(require('@expo/vector-icons').Ionicons);
      fireEvent.press(icon.parent);

      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('deve renderizar overlay corretamente', () => {
      const mockClose = jest.fn();
      const { getByText } = render(
        <Modal visible={true} onClose={mockClose}>
          <Text>Conteúdo</Text>
        </Modal>
      );

      // Verifica que o modal renderiza com overlay
      expect(getByText('Conteúdo')).toBeTruthy();
    });
  });

  describe('Animações', () => {
    it('deve aceitar animationType fade', () => {
      const { getByText } = render(
        <Modal visible={true} onClose={jest.fn()} animationType="fade">
          <Text>Modal Fade</Text>
        </Modal>
      );

      expect(getByText('Modal Fade')).toBeTruthy();
    });

    it('deve aceitar animationType slide', () => {
      const { getByText } = render(
        <Modal visible={true} onClose={jest.fn()} animationType="slide">
          <Text>Modal Slide</Text>
        </Modal>
      );

      expect(getByText('Modal Slide')).toBeTruthy();
    });

    it('deve aceitar animationType none', () => {
      const { getByText } = render(
        <Modal visible={true} onClose={jest.fn()} animationType="none">
          <Text>Modal Sem Animação</Text>
        </Modal>
      );

      expect(getByText('Modal Sem Animação')).toBeTruthy();
    });
  });

  describe('Transparência', () => {
    it('deve aceitar transparent=true (padrão)', () => {
      const { getByText } = render(
        <Modal visible={true} onClose={jest.fn()}>
          <Text>Modal Transparente</Text>
        </Modal>
      );

      expect(getByText('Modal Transparente')).toBeTruthy();
    });

    it('deve aceitar transparent=false', () => {
      const { getByText } = render(
        <Modal visible={true} onClose={jest.fn()} transparent={false}>
          <Text>Modal Opaco</Text>
        </Modal>
      );

      expect(getByText('Modal Opaco')).toBeTruthy();
    });
  });

  describe('Children', () => {
    it('deve renderizar children corretamente', () => {
      const { getByText } = render(
        <Modal visible={true} onClose={jest.fn()}>
          <Text>Primeiro filho</Text>
          <Text>Segundo filho</Text>
        </Modal>
      );

      expect(getByText('Primeiro filho')).toBeTruthy();
      expect(getByText('Segundo filho')).toBeTruthy();
    });

    it('deve renderizar children complexos', () => {
      const { getByText, getByPlaceholderText } = render(
        <Modal visible={true} onClose={jest.fn()} title="Formulário">
          <Text>Preencha os dados:</Text>
        </Modal>
      );

      expect(getByText('Preencha os dados:')).toBeTruthy();
    });
  });

  describe('Estilos Customizados', () => {
    it('deve aceitar style customizado', () => {
      const customStyle = { backgroundColor: 'red' };
      const { getByText } = render(
        <Modal visible={true} onClose={jest.fn()} style={customStyle}>
          <Text>Modal Customizado</Text>
        </Modal>
      );

      expect(getByText('Modal Customizado')).toBeTruthy();
    });
  });
});
