import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { Dialog } from '../Dialog';

// Mock hooks
jest.mock('@/hooks/useDialogState', () => ({
  useDialogState: jest.fn(),
  useDialogBackdropHandler: jest.fn(),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isDesktop: false,
    isMobile: true,
    isTablet: false,
  }),
}));

describe('Dialog', () => {
  describe('Variante Alert', () => {
    it('renderiza apenas botão de confirmação', () => {
      const { getByText, queryByText } = render(
        <Dialog
          visible={true}
          variant="alert"
          title="Alerta"
          message="Mensagem de alerta"
          onConfirm={jest.fn()}
        />
      );

      expect(getByText('OK')).toBeTruthy();
      expect(queryByText('Cancelar')).toBeNull();
    });

    it('usa texto customizado no botão de confirmação', () => {
      const { getByText } = render(
        <Dialog
          visible={true}
          variant="alert"
          title="Sucesso"
          message="Operação realizada"
          confirmText="Entendi"
          onConfirm={jest.fn()}
        />
      );

      expect(getByText('Entendi')).toBeTruthy();
    });

    it('fecha ao clicar em confirmar', () => {
      const onConfirm = jest.fn();
      const { getByText } = render(
        <Dialog
          visible={true}
          variant="alert"
          title="Info"
          message="Informação"
          onConfirm={onConfirm}
        />
      );

      fireEvent.press(getByText('OK'));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('renderiza título e mensagem corretamente', () => {
      const { getByText } = render(
        <Dialog
          visible={true}
          variant="alert"
          title="Título do Dialog"
          message="Mensagem do dialog"
          onConfirm={jest.fn()}
        />
      );

      expect(getByText('Título do Dialog')).toBeTruthy();
      expect(getByText('Mensagem do dialog')).toBeTruthy();
    });

    it('não renderiza quando visible é false', () => {
      const { queryByText } = render(
        <Dialog
          visible={false}
          variant="alert"
          title="Hidden"
          message="This should not appear"
          onConfirm={jest.fn()}
        />
      );

      expect(queryByText('Hidden')).toBeNull();
    });
  });

  describe('Variante Confirm', () => {
    it('renderiza botões de confirmar e cancelar', () => {
      const { getByText } = render(
        <Dialog
          visible={true}
          variant="confirm"
          title="Atenção"
          message="Deseja continuar?"
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      expect(getByText('Confirmar')).toBeTruthy();
      expect(getByText('Cancelar')).toBeTruthy();
    });

    it('chama onConfirm ao confirmar', () => {
      const onConfirm = jest.fn();
      const { getByText } = render(
        <Dialog
          visible={true}
          variant="confirm"
          title="Confirmar ação"
          message="Você tem certeza?"
          onConfirm={onConfirm}
          onCancel={jest.fn()}
        />
      );

      fireEvent.press(getByText('Confirmar'));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('chama onCancel ao cancelar', () => {
      const onCancel = jest.fn();
      const { getByText } = render(
        <Dialog
          visible={true}
          variant="confirm"
          title="Confirmar"
          message="Mensagem"
          onConfirm={jest.fn()}
          onCancel={onCancel}
        />
      );

      fireEvent.press(getByText('Cancelar'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('usa texto customizado nos botões', () => {
      const { getByText } = render(
        <Dialog
          visible={true}
          variant="confirm"
          title="Confirmação"
          message="Continuar?"
          confirmText="Sim, continuar"
          cancelText="Não, voltar"
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      expect(getByText('Sim, continuar')).toBeTruthy();
      expect(getByText('Não, voltar')).toBeTruthy();
    });
  });

  describe('Variante Destructive', () => {
    it('requer texto de confirmação para habilitar botão', () => {
      const { getByPlaceholderText, getByTestId } = render(
        <Dialog
          visible={true}
          variant="destructive"
          type="danger"
          title="Excluir conta"
          message="Esta ação não pode ser desfeita"
          destructiveConfirmText="EXCLUIR"
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      // Input should exist
      expect(getByPlaceholderText('EXCLUIR')).toBeTruthy();

      // Confirm button should be disabled initially
      const confirmButton = getByTestId('confirm-reset');
      expect(confirmButton.props.accessibilityState?.disabled).toBe(true);
    });

    it('habilita botão quando texto correto é digitado', async () => {
      const { getByPlaceholderText, getByTestId } = render(
        <Dialog
          visible={true}
          variant="destructive"
          type="danger"
          title="Excluir"
          message="Confirme a exclusão"
          destructiveConfirmText="EXCLUIR"
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      const input = getByPlaceholderText('EXCLUIR');
      fireEvent.changeText(input, 'EXCLUIR');

      await waitFor(() => {
        const confirmButton = getByTestId('confirm-reset');
        expect(confirmButton.props.accessibilityState?.disabled).toBe(false);
      });
    });

    it('aceita texto case-insensitive', async () => {
      const { getByPlaceholderText, getByTestId } = render(
        <Dialog
          visible={true}
          variant="destructive"
          type="danger"
          title="Excluir"
          message="Confirme"
          destructiveConfirmText="EXCLUIR"
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      const input = getByPlaceholderText('EXCLUIR');
      fireEvent.changeText(input, 'excluir');

      await waitFor(() => {
        const confirmButton = getByTestId('confirm-reset');
        expect(confirmButton.props.accessibilityState?.disabled).toBe(false);
      });
    });

    it('não permite confirmar com texto incorreto', () => {
      const onConfirm = jest.fn();
      const { getByPlaceholderText, getByTestId } = render(
        <Dialog
          visible={true}
          variant="destructive"
          type="danger"
          title="Excluir"
          message="Confirme"
          destructiveConfirmText="EXCLUIR"
          onConfirm={onConfirm}
          onCancel={jest.fn()}
        />
      );

      const input = getByPlaceholderText('EXCLUIR');
      fireEvent.changeText(input, 'WRONG');

      const confirmButton = getByTestId('confirm-reset');
      expect(confirmButton.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('Tipos visuais', () => {
    it.each([
      ['success', 'Sucesso'],
      ['warning', 'Aviso'],
      ['error', 'Erro'],
      ['danger', 'Perigo'],
      ['info', 'Info'],
      ['default', 'Default'],
    ])('renderiza tipo %s corretamente', (type, title) => {
      const { getByText } = render(
        <Dialog
          visible={true}
          variant="alert"
          type={type as any}
          title={title}
          message="Mensagem de teste"
          onConfirm={jest.fn()}
        />
      );

      expect(getByText(title)).toBeTruthy();
    });
  });

  describe('Estado de loading', () => {
    it('mostra loading no botão de confirmação', () => {
      const { getByTestId } = render(
        <Dialog
          visible={true}
          variant="confirm"
          title="Salvando"
          message="Aguarde..."
          loading={true}
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      // Confirm button should be disabled when loading
      const confirmButton = getByTestId('confirm-reset');
      expect(confirmButton.props.accessibilityState?.disabled).toBe(true);
    });

    it('desabilita botão de cancelar durante loading', () => {
      const { getByTestId } = render(
        <Dialog
          visible={true}
          variant="confirm"
          title="Processando"
          message="Aguarde..."
          loading={true}
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      const cancelButton = getByTestId('cancel-reset');
      expect(cancelButton.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('Acessibilidade', () => {
    it('botões têm accessibilityLabel correto', () => {
      const { getByLabelText } = render(
        <Dialog
          visible={true}
          variant="confirm"
          title="Confirmar"
          message="Mensagem"
          confirmText="Sim"
          cancelText="Não"
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      expect(getByLabelText('Sim')).toBeTruthy();
      expect(getByLabelText('Não')).toBeTruthy();
    });

    it('botões têm accessibilityRole button', () => {
      const { getByTestId } = render(
        <Dialog
          visible={true}
          variant="confirm"
          title="Confirmar"
          message="Mensagem"
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      expect(getByTestId('confirm-reset').props.accessibilityRole).toBe('button');
      expect(getByTestId('cancel-reset').props.accessibilityRole).toBe('button');
    });
  });
});
