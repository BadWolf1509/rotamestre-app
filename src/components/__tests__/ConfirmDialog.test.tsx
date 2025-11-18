import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { ConfirmDialog } from '../ConfirmDialog';

describe('ConfirmDialog Component', () => {
  const mockConfirm = jest.fn();
  const mockCancel = jest.fn();

  beforeEach(() => {
    mockConfirm.mockClear();
    mockCancel.mockClear();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar quando visible=true', () => {
      const { getByText } = render(
        <ConfirmDialog
          visible={true}
          title="Confirmar ação"
          message="Tem certeza que deseja continuar?"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Confirmar ação')).toBeTruthy();
      expect(getByText('Tem certeza que deseja continuar?')).toBeTruthy();
    });

    it('deve renderizar botões padrão', () => {
      const { getByText } = render(
        <ConfirmDialog
          visible={true}
          title="Teste"
          message="Mensagem"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Confirmar')).toBeTruthy();
      expect(getByText('Cancelar')).toBeTruthy();
    });

    it('deve renderizar com textos customizados', () => {
      const { getByText } = render(
        <ConfirmDialog
          visible={true}
          title="Deletar Item"
          message="Esta ação não pode ser desfeita"
          confirmText="Sim, deletar"
          cancelText="Não, manter"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Sim, deletar')).toBeTruthy();
      expect(getByText('Não, manter')).toBeTruthy();
    });
  });

  describe('Tipos de Dialog', () => {
    it('deve renderizar tipo default', () => {
      const { getByText, UNSAFE_getByType } = render(
        <ConfirmDialog
          visible={true}
          title="Confirmação"
          message="Prosseguir?"
          type="default"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Confirmação')).toBeTruthy();
      const icon = UNSAFE_getByType(require('@expo/vector-icons').Ionicons);
      expect(icon.props.name).toBe('help-circle-outline');
    });

    it('deve renderizar tipo destructive', () => {
      const { getByText, UNSAFE_getByType } = render(
        <ConfirmDialog
          visible={true}
          title="Deletar"
          message="Deseja deletar este item?"
          type="destructive"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Deletar')).toBeTruthy();
      const icon = UNSAFE_getByType(require('@expo/vector-icons').Ionicons);
      expect(icon.props.name).toBe('warning-outline');
    });

    it('deve renderizar tipo success', () => {
      const { getByText, UNSAFE_getByType } = render(
        <ConfirmDialog
          visible={true}
          title="Sucesso"
          message="Operação concluída"
          type="success"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Sucesso')).toBeTruthy();
      const icon = UNSAFE_getByType(require('@expo/vector-icons').Ionicons);
      expect(icon.props.name).toBe('checkmark-circle-outline');
    });
  });

  describe('Interações', () => {
    it('deve chamar onConfirm ao clicar em confirmar', () => {
      const { getByText } = render(
        <ConfirmDialog
          visible={true}
          title="Teste"
          message="Mensagem"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      fireEvent.press(getByText('Confirmar'));
      expect(mockConfirm).toHaveBeenCalledTimes(1);
    });

    it('deve chamar onCancel ao clicar em cancelar', () => {
      const { getByText } = render(
        <ConfirmDialog
          visible={true}
          title="Teste"
          message="Mensagem"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      fireEvent.press(getByText('Cancelar'));
      expect(mockCancel).toHaveBeenCalledTimes(1);
    });

    it('deve chamar onConfirm com botão customizado', () => {
      const { getByText } = render(
        <ConfirmDialog
          visible={true}
          title="Confirmar"
          message="Prosseguir?"
          confirmText="Sim"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      fireEvent.press(getByText('Sim'));
      expect(mockConfirm).toHaveBeenCalledTimes(1);
    });

    it('deve chamar onCancel com botão customizado', () => {
      const { getByText } = render(
        <ConfirmDialog
          visible={true}
          title="Confirmar"
          message="Prosseguir?"
          cancelText="Não"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      fireEvent.press(getByText('Não'));
      expect(mockCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Casos de Uso Comuns', () => {
    it('deve renderizar dialog de deleção', () => {
      const { getByText } = render(
        <ConfirmDialog
          visible={true}
          title="Deletar Rota"
          message="Esta ação não pode ser desfeita. Deseja continuar?"
          confirmText="Sim, deletar"
          cancelText="Cancelar"
          type="destructive"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Deletar Rota')).toBeTruthy();
      expect(getByText('Esta ação não pode ser desfeita. Deseja continuar?')).toBeTruthy();
      expect(getByText('Sim, deletar')).toBeTruthy();

      fireEvent.press(getByText('Sim, deletar'));
      expect(mockConfirm).toHaveBeenCalled();
    });

    it('deve renderizar dialog de logout', () => {
      const { getByText } = render(
        <ConfirmDialog
          visible={true}
          title="Encerrar Sessão"
          message="Deseja realmente sair da sua conta?"
          confirmText="Sair"
          cancelText="Permanecer conectado"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Encerrar Sessão')).toBeTruthy();
      expect(getByText('Deseja realmente sair da sua conta?')).toBeTruthy();

      fireEvent.press(getByText('Permanecer conectado'));
      expect(mockCancel).toHaveBeenCalled();
    });

    it('deve renderizar dialog de confirmação simples', () => {
      const { getByText } = render(
        <ConfirmDialog
          visible={true}
          title="Concluir Rota"
          message="Marcar esta rota como concluída?"
          type="success"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Concluir Rota')).toBeTruthy();
      expect(getByText('Marcar esta rota como concluída?')).toBeTruthy();
    });
  });

  describe('Acessibilidade', () => {
    it('deve ter accessibilityLabel nos botões', () => {
      const { getByLabelText } = render(
        <ConfirmDialog
          visible={true}
          title="Teste"
          message="Mensagem"
          confirmText="OK"
          cancelText="Voltar"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByLabelText('OK')).toBeTruthy();
      expect(getByLabelText('Voltar')).toBeTruthy();
    });

    it('deve ter accessibilityRole button nos botões', () => {
      const { getByLabelText } = render(
        <ConfirmDialog
          visible={true}
          title="Teste"
          message="Mensagem"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      const confirmButton = getByLabelText('Confirmar');
      const cancelButton = getByLabelText('Cancelar');

      expect(confirmButton.props.accessibilityRole).toBe('button');
      expect(cancelButton.props.accessibilityRole).toBe('button');
    });
  });

  describe('Visibilidade', () => {
    it('não deve renderizar quando visible=false', () => {
      const { queryByText } = render(
        <ConfirmDialog
          visible={false}
          title="Teste"
          message="Mensagem"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(queryByText('Teste')).toBeNull();
      expect(queryByText('Mensagem')).toBeNull();
    });

    it('deve renderizar quando visible=true', () => {
      const { getByText } = render(
        <ConfirmDialog
          visible={true}
          title="Teste"
          message="Mensagem"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Teste')).toBeTruthy();
      expect(getByText('Mensagem')).toBeTruthy();
    });
  });

  describe('Modal Props', () => {
    it('deve ter onRequestClose configurado para onCancel', () => {
      const { UNSAFE_getByType } = render(
        <ConfirmDialog
          visible={true}
          title="Teste"
          message="Mensagem"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      const Modal = require('react-native').Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.onRequestClose).toBe(mockCancel);
    });

    it('deve ter animationType fade', () => {
      const { UNSAFE_getByType } = render(
        <ConfirmDialog
          visible={true}
          title="Teste"
          message="Mensagem"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      const Modal = require('react-native').Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.animationType).toBe('fade');
    });

    it('deve ter transparent true', () => {
      const { UNSAFE_getByType } = render(
        <ConfirmDialog
          visible={true}
          title="Teste"
          message="Mensagem"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      const Modal = require('react-native').Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.transparent).toBe(true);
    });

    it('deve ter statusBarTranslucent true', () => {
      const { UNSAFE_getByType } = render(
        <ConfirmDialog
          visible={true}
          title="Teste"
          message="Mensagem"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      const Modal = require('react-native').Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.statusBarTranslucent).toBe(true);
    });

    it('deve ter presentationStyle overFullScreen', () => {
      const { UNSAFE_getByType } = render(
        <ConfirmDialog
          visible={true}
          title="Teste"
          message="Mensagem"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      const Modal = require('react-native').Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.presentationStyle).toBe('overFullScreen');
    });
  });

  describe('Cores dos Ícones', () => {
    it('deve usar cor correta para tipo default', () => {
      const { UNSAFE_getByType } = render(
        <ConfirmDialog
          visible={true}
          title="Teste"
          message="Mensagem"
          type="default"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      const icon = UNSAFE_getByType(require('@expo/vector-icons').Ionicons);
      expect(icon).toBeTruthy();
    });

    it('deve usar cor correta para tipo destructive', () => {
      const { UNSAFE_getByType } = render(
        <ConfirmDialog
          visible={true}
          title="Teste"
          message="Mensagem"
          type="destructive"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      const icon = UNSAFE_getByType(require('@expo/vector-icons').Ionicons);
      expect(icon).toBeTruthy();
    });

    it('deve usar cor correta para tipo success', () => {
      const { UNSAFE_getByType } = render(
        <ConfirmDialog
          visible={true}
          title="Teste"
          message="Mensagem"
          type="success"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      const icon = UNSAFE_getByType(require('@expo/vector-icons').Ionicons);
      expect(icon).toBeTruthy();
    });
  });

  describe('Tamanho do Ícone', () => {
    it('deve renderizar ícone com tamanho 28', () => {
      const { UNSAFE_getByType } = render(
        <ConfirmDialog
          visible={true}
          title="Teste"
          message="Mensagem"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      const icon = UNSAFE_getByType(require('@expo/vector-icons').Ionicons);
      expect(icon.props.size).toBe(28);
    });
  });

  describe('Props Customizados', () => {
    it('deve renderizar título longo', () => {
      const longTitle = 'Este é um título muito longo que pode quebrar em múltiplas linhas';
      const { getByText } = render(
        <ConfirmDialog
          visible={true}
          title={longTitle}
          message="Mensagem"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText(longTitle)).toBeTruthy();
    });

    it('deve renderizar mensagem longa', () => {
      const longMessage =
        'Esta é uma mensagem muito longa que deve quebrar em múltiplas linhas para testar o layout do componente.';
      const { getByText } = render(
        <ConfirmDialog
          visible={true}
          title="Título"
          message={longMessage}
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText(longMessage)).toBeTruthy();
    });

    it('deve renderizar com título e mensagem vazios', () => {
      const { getByText } = render(
        <ConfirmDialog
          visible={true}
          title=""
          message=""
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      // Deve renderizar os botões mesmo sem título/mensagem
      expect(getByText('Confirmar')).toBeTruthy();
      expect(getByText('Cancelar')).toBeTruthy();
    });
  });

  describe('Web Implementation (Platform.OS === web)', () => {
    const originalPlatform = require('react-native').Platform.OS;
    const originalWindow = (global as any).window;
    const originalDocument = (global as any).document;
    let createPortalSpy: jest.SpyInstance;

    beforeEach(() => {
      // Mock Platform.OS to be 'web'
      Object.defineProperty(require('react-native').Platform, 'OS', {
        get() {
          return 'web';
        },
        configurable: true,
      });

      // Mock document.body with persistent style object
      (global as any).document = {
        body: {
          style: {
            position: '',
            top: '',
            left: '',
            right: '',
            width: '',
            overflow: '',
          },
        },
        documentElement: {
          style: {
            overflow: '',
            height: '',
          },
          scrollTop: 0,
        },
      };

      // Mock window with persistent functions
      (global as any).window = {
        scrollY: 0,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        scrollTo: jest.fn(),
      };

      // Spy on createPortal
      createPortalSpy = jest.spyOn(require('react-dom'), 'createPortal');
      createPortalSpy.mockImplementation((children) => children);
    });

    afterEach(() => {
      // Restore original platform
      Object.defineProperty(require('react-native').Platform, 'OS', {
        get() {
          return originalPlatform;
        },
      });

      createPortalSpy.mockRestore();

      // Restore globals safely
      (global as any).window = originalWindow;
      (global as any).document = originalDocument;
    });

    it('deve usar createPortal quando Platform.OS === web', () => {
      render(
        <ConfirmDialog
          visible={true}
          title="Web Dialog"
          message="Testing web implementation"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(createPortalSpy).toHaveBeenCalled();
    });

    it('deve renderizar título e mensagem no web', () => {
      const { getByText } = render(
        <ConfirmDialog
          visible={true}
          title="Web Title"
          message="Web Message"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Web Title')).toBeTruthy();
      expect(getByText('Web Message')).toBeTruthy();
    });

    it('deve renderizar botões no web', () => {
      const { getByText } = render(
        <ConfirmDialog
          visible={true}
          title="Test"
          message="Message"
          confirmText="OK"
          cancelText="Fechar"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('OK')).toBeTruthy();
      expect(getByText('Fechar')).toBeTruthy();
    });

    it('deve chamar onConfirm ao clicar no botão confirm (web)', () => {
      const { getByText } = render(
        <ConfirmDialog
          visible={true}
          title="Test"
          message="Message"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      fireEvent.click(getByText('Confirmar'));
      expect(mockConfirm).toHaveBeenCalledTimes(1);
    });

    it('deve chamar onCancel ao clicar no botão cancel (web)', () => {
      const { getByText } = render(
        <ConfirmDialog
          visible={true}
          title="Test"
          message="Message"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      fireEvent.click(getByText('Cancelar'));
      expect(mockCancel).toHaveBeenCalledTimes(1);
    });

    it('deve aplicar estilos de scroll lock quando visible=true (web)', () => {
      const body = (global as any).document.body;
      const html = (global as any).document.documentElement;

      render(
        <ConfirmDialog
          visible={true}
          title="Test"
          message="Message"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(body.style.position).toBe('fixed');
      expect(body.style.overflow).toBe('hidden');
      expect(html.style.overflow).toBe('hidden');
    });

    it('deve adicionar event listeners para prevenir scroll (web)', () => {
      const addEventListener = (global as any).window.addEventListener;

      render(
        <ConfirmDialog
          visible={true}
          title="Test"
          message="Message"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false });
      expect(addEventListener).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: false });
    });

    it('deve renderizar com tipo destructive (web)', () => {
      const { getByText } = render(
        <ConfirmDialog
          visible={true}
          title="Delete Item"
          message="Are you sure?"
          type="destructive"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Delete Item')).toBeTruthy();
    });

    it('deve renderizar com tipo success (web)', () => {
      const { getByText } = render(
        <ConfirmDialog
          visible={true}
          title="Success!"
          message="Operation completed"
          type="success"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Success!')).toBeTruthy();
    });

    it('não deve renderizar quando visible=false (web)', () => {
      const { queryByText } = render(
        <ConfirmDialog
          visible={false}
          title="Test"
          message="Message"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(queryByText('Test')).toBeNull();
      expect(createPortalSpy).not.toHaveBeenCalled();
    });
  });
});
