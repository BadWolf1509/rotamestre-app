import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
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
  });
});
