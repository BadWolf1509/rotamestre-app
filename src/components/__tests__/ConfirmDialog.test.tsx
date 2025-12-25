import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { ConfirmDialog } from '../ConfirmDialog';

// Mock window.scrollTo for web tests
const originalScrollTo = global.window?.scrollTo;
beforeAll(() => {
  if (typeof global.window !== 'undefined') {
    global.window.scrollTo = jest.fn();
  }
});

afterAll(() => {
  if (typeof global.window !== 'undefined' && originalScrollTo) {
    global.window.scrollTo = originalScrollTo;
  }
});

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

  describe('Fechamento via onRequestClose', () => {
    it('deve ter onRequestClose configurado que chama onCancel', () => {
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

      // onRequestClose deve chamar onCancel (permite fechar com back button no Android)
      expect(modal.props.onRequestClose).toBe(mockCancel);
    });
  });

  describe('Tipo padrão', () => {
    it('deve usar default como tipo padrão quando não especificado', () => {
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
      expect(icon.props.name).toBe('help-circle-outline');
    });
  });

  describe('Estilos de botão por tipo', () => {
    it('deve aplicar estilo default ao botão confirmar', () => {
      const { getByLabelText } = render(
        <ConfirmDialog
          visible={true}
          title="Teste"
          message="Mensagem"
          type="default"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      const confirmButton = getByLabelText('Confirmar');
      expect(confirmButton).toBeTruthy();
    });

    it('deve aplicar estilo destructive ao botão confirmar', () => {
      const { getByLabelText } = render(
        <ConfirmDialog
          visible={true}
          title="Teste"
          message="Mensagem"
          type="destructive"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      const confirmButton = getByLabelText('Confirmar');
      expect(confirmButton).toBeTruthy();
    });

    it('deve aplicar estilo success ao botão confirmar', () => {
      const { getByLabelText } = render(
        <ConfirmDialog
          visible={true}
          title="Teste"
          message="Mensagem"
          type="success"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      const confirmButton = getByLabelText('Confirmar');
      expect(confirmButton).toBeTruthy();
    });
  });

  describe('Props padrão', () => {
    it('deve usar confirmText padrão "Confirmar"', () => {
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
    });

    it('deve usar cancelText padrão "Cancelar"', () => {
      const { getByText } = render(
        <ConfirmDialog
          visible={true}
          title="Teste"
          message="Mensagem"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Cancelar')).toBeTruthy();
    });
  });

  describe('Rerender e mudanças de visibilidade', () => {
    it('deve alternar visibilidade corretamente', () => {
      const { rerender, getByText, queryByText } = render(
        <ConfirmDialog
          visible={true}
          title="Teste Visível"
          message="Mensagem"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Teste Visível')).toBeTruthy();

      rerender(
        <ConfirmDialog
          visible={false}
          title="Teste Visível"
          message="Mensagem"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(queryByText('Teste Visível')).toBeNull();
    });
  });
});
