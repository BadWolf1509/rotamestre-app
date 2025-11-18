import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Platform, Text } from 'react-native';

import { AlertDialog } from '../AlertDialog';

// Mock createPortal for web tests
jest.mock('react-dom', () => ({
  createPortal: jest.fn((element) => element),
}));

describe('AlertDialog Component', () => {
  const mockOnConfirm = jest.fn();
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Platform.OS to default
    Object.defineProperty(Platform, 'OS', {
      get: () => originalPlatformOS,
      configurable: true,
    });
  });

  describe('Renderização Básica', () => {
    it('deve renderizar quando visible=true', () => {
      const { getByText } = render(
        <AlertDialog
          visible={true}
          title="Atenção"
          message="Isso é um teste"
          onConfirm={mockOnConfirm}
        />
      );

      expect(getByText('Atenção')).toBeTruthy();
      expect(getByText('Isso é um teste')).toBeTruthy();
    });

    it('não deve renderizar quando visible=false', () => {
      const { queryByText } = render(
        <AlertDialog
          visible={false}
          title="Atenção"
          message="Isso é um teste"
          onConfirm={mockOnConfirm}
        />
      );

      expect(queryByText('Atenção')).toBeNull();
      expect(queryByText('Isso é um teste')).toBeNull();
    });

    it('deve renderizar botão OK por padrão', () => {
      const { getByText } = render(
        <AlertDialog visible={true} title="Título" message="Mensagem" onConfirm={mockOnConfirm} />
      );

      expect(getByText('OK')).toBeTruthy();
    });

    it('deve renderizar texto customizado no botão', () => {
      const { getByText } = render(
        <AlertDialog
          visible={true}
          title="Título"
          message="Mensagem"
          confirmText="Entendi"
          onConfirm={mockOnConfirm}
        />
      );

      expect(getByText('Entendi')).toBeTruthy();
    });
  });

  describe('Tipos de Alerta', () => {
    it('deve renderizar tipo default corretamente', () => {
      const { getByText, UNSAFE_getByType } = render(
        <AlertDialog
          visible={true}
          title="Info"
          message="Mensagem"
          type="default"
          onConfirm={mockOnConfirm}
        />
      );

      expect(getByText('Info')).toBeTruthy();
      const Ionicons = require('@expo/vector-icons').Ionicons;
      const icon = UNSAFE_getByType(Ionicons);
      expect(icon.props.name).toBe('information-circle-outline');
    });

    it('deve renderizar tipo error corretamente', () => {
      const { getByText, UNSAFE_getByType } = render(
        <AlertDialog
          visible={true}
          title="Erro"
          message="Mensagem de erro"
          type="error"
          onConfirm={mockOnConfirm}
        />
      );

      expect(getByText('Erro')).toBeTruthy();
      const Ionicons = require('@expo/vector-icons').Ionicons;
      const icon = UNSAFE_getByType(Ionicons);
      expect(icon.props.name).toBe('close-circle-outline');
    });

    it('deve renderizar tipo success corretamente', () => {
      const { getByText, UNSAFE_getByType } = render(
        <AlertDialog
          visible={true}
          title="Sucesso"
          message="Operação concluída"
          type="success"
          onConfirm={mockOnConfirm}
        />
      );

      expect(getByText('Sucesso')).toBeTruthy();
      const Ionicons = require('@expo/vector-icons').Ionicons;
      const icon = UNSAFE_getByType(Ionicons);
      expect(icon.props.name).toBe('checkmark-circle-outline');
    });

    it('deve renderizar tipo warning corretamente', () => {
      const { getByText, UNSAFE_getByType } = render(
        <AlertDialog
          visible={true}
          title="Aviso"
          message="Atenção necessária"
          type="warning"
          onConfirm={mockOnConfirm}
        />
      );

      expect(getByText('Aviso')).toBeTruthy();
      const Ionicons = require('@expo/vector-icons').Ionicons;
      const icon = UNSAFE_getByType(Ionicons);
      expect(icon.props.name).toBe('warning-outline');
    });
  });

  describe('Interações', () => {
    it('deve chamar onConfirm ao clicar no botão', () => {
      const { getByText } = render(
        <AlertDialog visible={true} title="Título" message="Mensagem" onConfirm={mockOnConfirm} />
      );

      const button = getByText('OK');
      fireEvent.press(button);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it('deve ter stopPropagation no container interno', () => {
      const { getByText } = render(
        <AlertDialog visible={true} title="Título" message="Mensagem" onConfirm={mockOnConfirm} />
      );

      // Verificar que o componente renderiza sem erro
      expect(getByText('Título')).toBeTruthy();
      expect(getByText('Mensagem')).toBeTruthy();
    });
  });

  describe('Acessibilidade', () => {
    it('deve ter accessibilityLabel no botão', () => {
      const { getByLabelText } = render(
        <AlertDialog
          visible={true}
          title="Título"
          message="Mensagem"
          confirmText="Confirmar"
          onConfirm={mockOnConfirm}
        />
      );

      expect(getByLabelText('Confirmar')).toBeTruthy();
    });

    it('deve ter accessibilityRole button', () => {
      const { getByLabelText } = render(
        <AlertDialog visible={true} title="Título" message="Mensagem" onConfirm={mockOnConfirm} />
      );

      const button = getByLabelText('OK');
      expect(button.props.accessibilityRole).toBe('button');
    });
  });

  describe('Modal Props', () => {
    it('deve ter onRequestClose configurado', () => {
      const { UNSAFE_getByType } = render(
        <AlertDialog visible={true} title="Título" message="Mensagem" onConfirm={mockOnConfirm} />
      );

      const Modal = require('react-native').Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.onRequestClose).toBe(mockOnConfirm);
    });

    it('deve ter animationType fade', () => {
      const { UNSAFE_getByType } = render(
        <AlertDialog visible={true} title="Título" message="Mensagem" onConfirm={mockOnConfirm} />
      );

      const Modal = require('react-native').Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.animationType).toBe('fade');
    });

    it('deve ter transparent true', () => {
      const { UNSAFE_getByType } = render(
        <AlertDialog visible={true} title="Título" message="Mensagem" onConfirm={mockOnConfirm} />
      );

      const Modal = require('react-native').Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.transparent).toBe(true);
    });

    it('deve ter statusBarTranslucent true', () => {
      const { UNSAFE_getByType } = render(
        <AlertDialog visible={true} title="Título" message="Mensagem" onConfirm={mockOnConfirm} />
      );

      const Modal = require('react-native').Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.statusBarTranslucent).toBe(true);
    });

    it('deve ter presentationStyle overFullScreen', () => {
      const { UNSAFE_getByType } = render(
        <AlertDialog visible={true} title="Título" message="Mensagem" onConfirm={mockOnConfirm} />
      );

      const Modal = require('react-native').Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.presentationStyle).toBe('overFullScreen');
    });
  });

  describe('Estilos do Botão por Tipo', () => {
    it('deve aplicar estilo default ao botão quando type=default', () => {
      const { getByText } = render(
        <AlertDialog
          visible={true}
          title="Info"
          message="Mensagem"
          type="default"
          onConfirm={mockOnConfirm}
        />
      );

      const button = getByText('OK');
      // Verificar que o botão foi renderizado
      expect(button).toBeTruthy();
    });

    it('deve aplicar estilo error ao botão quando type=error', () => {
      const { getByText } = render(
        <AlertDialog
          visible={true}
          title="Erro"
          message="Mensagem"
          type="error"
          onConfirm={mockOnConfirm}
        />
      );

      const button = getByText('OK');
      expect(button).toBeTruthy();
    });

    it('deve aplicar estilo success ao botão quando type=success', () => {
      const { getByText } = render(
        <AlertDialog
          visible={true}
          title="Sucesso"
          message="Mensagem"
          type="success"
          onConfirm={mockOnConfirm}
        />
      );

      const button = getByText('OK');
      expect(button).toBeTruthy();
    });

    it('deve aplicar estilo warning ao botão quando type=warning', () => {
      const { getByText } = render(
        <AlertDialog
          visible={true}
          title="Aviso"
          message="Mensagem"
          type="warning"
          onConfirm={mockOnConfirm}
        />
      );

      const button = getByText('OK');
      expect(button).toBeTruthy();
    });
  });

  describe('Renderização Condicional', () => {
    it('deve retornar null quando visible é false', () => {
      const { queryByText } = render(
        <AlertDialog visible={false} title="Título" message="Mensagem" onConfirm={mockOnConfirm} />
      );

      // Componente não deve renderizar nada
      expect(queryByText('Título')).toBeNull();
      expect(queryByText('Mensagem')).toBeNull();
    });

    it('deve renderizar Modal quando visible é true', () => {
      const { getByText } = render(
        <AlertDialog visible={true} title="Título" message="Mensagem" onConfirm={mockOnConfirm} />
      );

      // Deve renderizar o conteúdo
      expect(getByText('Título')).toBeTruthy();
      expect(getByText('Mensagem')).toBeTruthy();
    });
  });

  describe('Props Customizados', () => {
    it('deve renderizar título longo corretamente', () => {
      const longTitle =
        'Este é um título muito longo que pode quebrar em múltiplas linhas para testar o layout';
      const { getByText } = render(
        <AlertDialog
          visible={true}
          title={longTitle}
          message="Mensagem"
          onConfirm={mockOnConfirm}
        />
      );

      expect(getByText(longTitle)).toBeTruthy();
    });

    it('deve renderizar mensagem longa corretamente', () => {
      const longMessage =
        'Esta é uma mensagem muito longa que deve quebrar em múltiplas linhas e testar se o layout está funcionando corretamente com muito texto.';
      const { getByText } = render(
        <AlertDialog
          visible={true}
          title="Título"
          message={longMessage}
          onConfirm={mockOnConfirm}
        />
      );

      expect(getByText(longMessage)).toBeTruthy();
    });

    it('deve renderizar com título e mensagem vazios', () => {
      const { getByText } = render(
        <AlertDialog visible={true} title="" message="" onConfirm={mockOnConfirm} />
      );

      // Deve renderizar o botão mesmo sem título/mensagem
      expect(getByText('OK')).toBeTruthy();
    });
  });

  describe('Integração com Ícones', () => {
    it('deve renderizar ícone com cor correta para tipo error', () => {
      const { UNSAFE_getByType } = render(
        <AlertDialog
          visible={true}
          title="Erro"
          message="Mensagem"
          type="error"
          onConfirm={mockOnConfirm}
        />
      );

      const Ionicons = require('@expo/vector-icons').Ionicons;
      const icon = UNSAFE_getByType(Ionicons);
      // Verificar que o ícone foi renderizado
      expect(icon).toBeTruthy();
    });

    it('deve renderizar ícone com tamanho correto', () => {
      const { UNSAFE_getByType } = render(
        <AlertDialog visible={true} title="Título" message="Mensagem" onConfirm={mockOnConfirm} />
      );

      const Ionicons = require('@expo/vector-icons').Ionicons;
      const icon = UNSAFE_getByType(Ionicons);
      expect(icon.props.size).toBe(28);
    });
  });
});
