import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { ConfirmModal } from '../ConfirmModal';

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
    it('deve renderizar tipo danger (padrão)', () => {
      const { getByText } = render(
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
      expect(getByText('🗑️')).toBeTruthy();
    });

    it('deve renderizar tipo warning', () => {
      const { getByText } = render(
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
      expect(getByText('⚠️')).toBeTruthy();
    });

    it('deve renderizar tipo info', () => {
      const { getByText } = render(
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
      expect(getByText('ℹ️')).toBeTruthy();
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

  describe('Ícones por Tipo', () => {
    it('deve mostrar ícone de lixeira para danger', () => {
      const { getByText } = render(
        <ConfirmModal
          visible={true}
          title="Deletar"
          message="Confirmar?"
          type="danger"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('🗑️')).toBeTruthy();
    });

    it('deve mostrar ícone de alerta para warning', () => {
      const { getByText } = render(
        <ConfirmModal
          visible={true}
          title="Atenção"
          message="Cuidado"
          type="warning"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('⚠️')).toBeTruthy();
    });

    it('deve mostrar ícone de info para info', () => {
      const { getByText } = render(
        <ConfirmModal
          visible={true}
          title="Info"
          message="Informação"
          type="info"
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      expect(getByText('ℹ️')).toBeTruthy();
    });
  });
});
