import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { ConfirmModal } from '../ConfirmModal';

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, testID }: { name: string; testID?: string }) => {
    const { Text } = require('react-native');
    return <Text testID={testID || `icon-${name}`}>{name}</Text>;
  },
}));

describe('ConfirmModal Component', () => {
  const mockConfirm = jest.fn();
  const mockCancel = jest.fn();

  beforeEach(() => {
    mockConfirm.mockClear();
    mockCancel.mockClear();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar quando visible=true', () => {
      const { getByText } = render(
        <ConfirmModal
          visible={true}
          title="Título do Modal"
          message="Mensagem do modal"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Título do Modal')).toBeTruthy();
      expect(getByText('Mensagem do modal')).toBeTruthy();
    });

    it('deve renderizar botões padrão', () => {
      const { getByText } = render(
        <ConfirmModal
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

    it('deve renderizar botões customizados', () => {
      const { getByText } = render(
        <ConfirmModal
          visible={true}
          title="Deletar"
          message="Confirmar exclusão?"
          confirmText="Sim, deletar"
          cancelText="Não"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Sim, deletar')).toBeTruthy();
      expect(getByText('Não')).toBeTruthy();
    });
  });

  describe('Tipos de Modal', () => {
    it('deve renderizar tipo danger (padrão) com ícone trash-outline', () => {
      const { getByText, getByTestId } = render(
        <ConfirmModal
          visible={true}
          title="Excluir Item"
          message="Esta ação não pode ser desfeita"
          type="danger"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Excluir Item')).toBeTruthy();
      expect(getByTestId('icon-trash-outline')).toBeTruthy();
    });

    it('deve renderizar tipo warning com ícone warning-outline', () => {
      const { getByText, getByTestId } = render(
        <ConfirmModal
          visible={true}
          title="Atenção"
          message="Esta ação requer cuidado"
          type="warning"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Atenção')).toBeTruthy();
      expect(getByTestId('icon-warning-outline')).toBeTruthy();
    });

    it('deve renderizar tipo info com ícone information-circle-outline', () => {
      const { getByText, getByTestId } = render(
        <ConfirmModal
          visible={true}
          title="Informação"
          message="Deseja continuar?"
          type="info"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Informação')).toBeTruthy();
      expect(getByTestId('icon-information-circle-outline')).toBeTruthy();
    });

    it('deve renderizar tipo success com ícone checkmark-circle-outline', () => {
      const { getByText, getByTestId } = render(
        <ConfirmModal
          visible={true}
          title="Sucesso"
          message="Operação concluída"
          type="success"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Sucesso')).toBeTruthy();
      expect(getByTestId('icon-checkmark-circle-outline')).toBeTruthy();
    });
  });

  describe('Interações', () => {
    it('deve chamar onConfirm ao clicar em confirmar', () => {
      const { getByText } = render(
        <ConfirmModal
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
        <ConfirmModal
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

    it('deve chamar callbacks com botões customizados', () => {
      const { getByText } = render(
        <ConfirmModal
          visible={true}
          title="Confirmar"
          message="Prosseguir?"
          confirmText="OK"
          cancelText="Voltar"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      fireEvent.press(getByText('OK'));
      expect(mockConfirm).toHaveBeenCalled();

      fireEvent.press(getByText('Voltar'));
      expect(mockCancel).toHaveBeenCalled();
    });
  });

  describe('Casos de Uso Comuns', () => {
    it('deve renderizar modal de exclusão', () => {
      const { getByText } = render(
        <ConfirmModal
          visible={true}
          title="Excluir Rota"
          message="Tem certeza que deseja excluir esta rota? Esta ação não pode ser desfeita."
          confirmText="Sim, excluir"
          cancelText="Cancelar"
          type="danger"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Excluir Rota')).toBeTruthy();
      expect(
        getByText(
          'Tem certeza que deseja excluir esta rota? Esta ação não pode ser desfeita.'
        )
      ).toBeTruthy();

      fireEvent.press(getByText('Sim, excluir'));
      expect(mockConfirm).toHaveBeenCalled();
    });

    it('deve renderizar modal de aviso', () => {
      const { getByText } = render(
        <ConfirmModal
          visible={true}
          title="Rota em Andamento"
          message="Existem rotas em andamento. Deseja realmente sair?"
          type="warning"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Rota em Andamento')).toBeTruthy();
      expect(
        getByText('Existem rotas em andamento. Deseja realmente sair?')
      ).toBeTruthy();
    });

    it('deve renderizar modal informativo', () => {
      const { getByText } = render(
        <ConfirmModal
          visible={true}
          title="Salvar Alterações"
          message="Deseja salvar as alterações antes de sair?"
          type="info"
          confirmText="Salvar"
          cancelText="Descartar"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Salvar Alterações')).toBeTruthy();
      expect(getByText('Salvar')).toBeTruthy();
      expect(getByText('Descartar')).toBeTruthy();
    });
  });

  describe('Ícones por Tipo (Ionicons)', () => {
    it('deve mostrar ícone trash-outline para danger', () => {
      const { getByTestId } = render(
        <ConfirmModal
          visible={true}
          title="Deletar"
          message="Confirmar?"
          type="danger"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByTestId('icon-trash-outline')).toBeTruthy();
    });

    it('deve mostrar ícone warning-outline para warning', () => {
      const { getByTestId } = render(
        <ConfirmModal
          visible={true}
          title="Atenção"
          message="Cuidado"
          type="warning"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByTestId('icon-warning-outline')).toBeTruthy();
    });

    it('deve mostrar ícone information-circle-outline para info', () => {
      const { getByTestId } = render(
        <ConfirmModal
          visible={true}
          title="Info"
          message="Informação"
          type="info"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByTestId('icon-information-circle-outline')).toBeTruthy();
    });

    it('deve mostrar ícone checkmark-circle-outline para success', () => {
      const { getByTestId } = render(
        <ConfirmModal
          visible={true}
          title="Sucesso"
          message="Operação concluída"
          type="success"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByTestId('icon-checkmark-circle-outline')).toBeTruthy();
    });
  });

  describe('Tipo Success', () => {
    it('deve renderizar tipo success corretamente', () => {
      const { getByText, getByTestId } = render(
        <ConfirmModal
          visible={true}
          title="Operação Concluída"
          message="Sua ação foi realizada com sucesso!"
          type="success"
          confirmText="OK"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('Operação Concluída')).toBeTruthy();
      expect(getByTestId('icon-checkmark-circle-outline')).toBeTruthy();
    });
  });

  describe('Modal Props', () => {
    it('deve ter onRequestClose configurado para onCancel', () => {
      const { UNSAFE_getByType } = render(
        <ConfirmModal
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

    it('deve ter transparent=true', () => {
      const { UNSAFE_getByType } = render(
        <ConfirmModal
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

    it('deve ter animationType slide no mobile (padrão)', () => {
      const { UNSAFE_getByType } = render(
        <ConfirmModal
          visible={true}
          title="Teste"
          message="Mensagem"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      const Modal = require('react-native').Modal;
      const modal = UNSAFE_getByType(Modal);

      // DesktopModal usa 'slide' no mobile e 'fade' no desktop
      expect(modal.props.animationType).toBe('slide');
    });
  });

  describe('Fechamento via onRequestClose', () => {
    it('deve ter onRequestClose configurado que permite fechar o modal', () => {
      const { UNSAFE_getByType } = render(
        <ConfirmModal
          visible={true}
          title="Teste"
          message="Mensagem"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      const Modal = require('react-native').Modal;
      const modal = UNSAFE_getByType(Modal);

      // onRequestClose permite que o Android back button feche o modal
      expect(modal.props.onRequestClose).toBeDefined();
    });
  });

  describe('Visibilidade', () => {
    it('não deve renderizar conteúdo quando visible=false', () => {
      const { queryByText } = render(
        <ConfirmModal
          visible={false}
          title="Teste"
          message="Mensagem"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      // Modal com visible=false não renderiza nada via portal no web
      // No mobile, o RN Modal não renderiza conteúdo visível
      expect(queryByText('Teste')).toBeNull();
    });
  });

  describe('Tipo padrão sem especificar', () => {
    it('deve usar danger como tipo padrão (ícone trash-outline)', () => {
      const { getByTestId } = render(
        <ConfirmModal
          visible={true}
          title="Teste Padrão"
          message="Mensagem"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      // Tipo danger mostra ícone de lixeira
      expect(getByTestId('icon-trash-outline')).toBeTruthy();
    });
  });

  describe('Props padrão', () => {
    it('deve usar confirmText padrão "Confirmar"', () => {
      const { getByText } = render(
        <ConfirmModal
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
        <ConfirmModal
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

  describe('Acessibilidade', () => {
    it('deve ter accessibilityRole header no container do título', () => {
      const { getByRole } = render(
        <ConfirmModal
          visible={true}
          title="Teste"
          message="Mensagem"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByRole('header')).toBeTruthy();
    });

    it('deve ter accessibilityLabel no ícone', () => {
      const { getByLabelText } = render(
        <ConfirmModal
          visible={true}
          title="Teste"
          message="Mensagem"
          type="danger"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByLabelText('Ação destrutiva')).toBeTruthy();
    });
  });

  describe('Confirmação Destrutiva', () => {
    it('deve renderizar campo de confirmação quando destructiveConfirmText é fornecido', () => {
      const { getByText, getByPlaceholderText } = render(
        <ConfirmModal
          visible={true}
          title="Excluir Conta"
          message="Esta ação não pode ser desfeita."
          type="danger"
          destructiveConfirmText="EXCLUIR"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText(/Digite/)).toBeTruthy();
      expect(getByText('EXCLUIR')).toBeTruthy();
      expect(getByPlaceholderText('EXCLUIR')).toBeTruthy();
    });

    it('deve desabilitar botão confirmar até digitar texto correto', () => {
      const { getByText, getByPlaceholderText } = render(
        <ConfirmModal
          visible={true}
          title="Excluir"
          message="Confirmar exclusão"
          type="danger"
          destructiveConfirmText="EXCLUIR"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      const confirmButton = getByText('Confirmar');
      const input = getByPlaceholderText('EXCLUIR');

      // Botão deve estar desabilitado inicialmente
      fireEvent.press(confirmButton);
      expect(mockConfirm).not.toHaveBeenCalled();

      // Digitar texto incorreto
      fireEvent.changeText(input, 'excl');
      fireEvent.press(confirmButton);
      expect(mockConfirm).not.toHaveBeenCalled();

      // Digitar texto correto (case insensitive)
      fireEvent.changeText(input, 'excluir');
      fireEvent.press(confirmButton);
      expect(mockConfirm).toHaveBeenCalledTimes(1);
    });

    it('deve aceitar confirmação case-insensitive', () => {
      const { getAllByText, getByPlaceholderText } = render(
        <ConfirmModal
          visible={true}
          title="Deletar"
          message="Mensagem de confirmação"
          type="danger"
          destructiveConfirmText="DELETE"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      const input = getByPlaceholderText('DELETE');

      // Digitar em minúsculas deve funcionar
      fireEvent.changeText(input, 'delete');
      // Usar getAllByText e pegar o botão (último "Confirmar" encontrado)
      const confirmButtons = getAllByText('Confirmar');
      fireEvent.press(confirmButtons[confirmButtons.length - 1]);
      expect(mockConfirm).toHaveBeenCalled();
    });

    it('deve resetar input quando modal fecha', async () => {
      const { getByPlaceholderText, rerender } = render(
        <ConfirmModal
          visible={true}
          title="Teste"
          message="Mensagem"
          destructiveConfirmText="CONFIRMAR"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      const input = getByPlaceholderText('CONFIRMAR');
      fireEvent.changeText(input, 'CONF');

      // Fechar modal
      rerender(
        <ConfirmModal
          visible={false}
          title="Teste"
          message="Mensagem"
          destructiveConfirmText="CONFIRMAR"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      // Reabrir modal
      rerender(
        <ConfirmModal
          visible={true}
          title="Teste"
          message="Mensagem"
          destructiveConfirmText="CONFIRMAR"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      // Input deve estar vazio
      const newInput = getByPlaceholderText('CONFIRMAR');
      expect(newInput.props.value).toBe('');
    });
  });

  describe('Loading State', () => {
    it('deve desabilitar botões quando loading=true', () => {
      const { getByText } = render(
        <ConfirmModal
          visible={true}
          title="Teste"
          message="Mensagem"
          loading={true}
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      fireEvent.press(getByText('Confirmar'));
      expect(mockConfirm).not.toHaveBeenCalled();
    });

    it('deve desabilitar input de confirmação destrutiva quando loading', () => {
      const { getByPlaceholderText } = render(
        <ConfirmModal
          visible={true}
          title="Teste"
          message="Mensagem"
          destructiveConfirmText="EXCLUIR"
          loading={true}
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      const input = getByPlaceholderText('EXCLUIR');
      expect(input.props.editable).toBe(false);
    });
  });
});
