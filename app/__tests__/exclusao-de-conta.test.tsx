// Tela de exclusão de conta: a confirmação forte (digitar EXCLUIR) e o que a
// pessoa lê quando o servidor recusa por uma guarda. A exclusão é irreversível
// — o que se prova aqui é que NADA é chamado sem a confirmação, e que a
// recusa chega com o texto que diz o que fazer, não com o "tente novamente /
// escreva ao suporte" do erro genérico.
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { authService } from '@/lib/auth';
import { ExclusaoRecusadaError } from '@/lib/auth/exclusaoRecusada';

import ExclusaoDeConta from '../exclusao-de-conta';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } }, loading: false }),
}));

jest.mock('@/lib/auth', () => ({
  authService: { deleteAccount: jest.fn() },
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const deleteAccount = authService.deleteAccount as jest.Mock;

async function abrirConfirmacao() {
  const tela = render(<ExclusaoDeConta />);
  fireEvent.press(tela.getByLabelText('Excluir minha conta'));
  return tela;
}

describe('ExclusaoDeConta', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exige digitar EXCLUIR: sem isso o botão fica desabilitado e nada é chamado', async () => {
    const tela = await abrirConfirmacao();

    const confirmar = tela.getByTestId('confirm-reset');
    expect(confirmar.props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(confirmar);
    expect(deleteAccount).not.toHaveBeenCalled();

    // Texto parecido não vale.
    fireEvent.changeText(tela.getByPlaceholderText('EXCLUIR'), 'EXCLUI');
    expect(
      tela.getByTestId('confirm-reset').props.accessibilityState?.disabled,
    ).toBe(true);
    fireEvent.press(tela.getByTestId('confirm-reset'));
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('com EXCLUIR digitado, confirma uma vez e mostra o sucesso', async () => {
    deleteAccount.mockResolvedValue({ success: true });
    const tela = await abrirConfirmacao();

    fireEvent.changeText(tela.getByPlaceholderText('EXCLUIR'), 'EXCLUIR');
    expect(
      tela.getByTestId('confirm-reset').props.accessibilityState?.disabled,
    ).toBeFalsy();
    await act(async () => {
      fireEvent.press(tela.getByTestId('confirm-reset'));
    });

    expect(deleteAccount).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(tela.getByText('Conta excluída')).toBeTruthy());
  });

  it('recusa por último gestor: mostra a mensagem do servidor, sem mandar escrever ao suporte', async () => {
    deleteAccount.mockRejectedValue(
      new ExclusaoRecusadaError(
        'ULTIMO_GESTOR',
        'Você é o único gestor ativo da loja Centro. Promova outro gestor.',
      ),
    );
    const tela = await abrirConfirmacao();
    fireEvent.changeText(tela.getByPlaceholderText('EXCLUIR'), 'EXCLUIR');
    await act(async () => {
      fireEvent.press(tela.getByTestId('confirm-reset'));
    });

    await waitFor(() =>
      expect(tela.getByText('Não é possível excluir agora')).toBeTruthy(),
    );
    expect(
      tela.getByText(
        'Você é o único gestor ativo da loja Centro. Promova outro gestor.',
      ),
    ).toBeTruthy();
    expect(tela.queryAllByText(/solicite a exclusão pelo e-mail/)).toHaveLength(0);
  });

  it('recusa por rota em andamento: mesma tela, com a mensagem dela', async () => {
    deleteAccount.mockRejectedValue(
      new ExclusaoRecusadaError(
        'ROTA_EM_ANDAMENTO',
        'Você tem uma rota em andamento. Finalize a rota.',
      ),
    );
    const tela = await abrirConfirmacao();
    fireEvent.changeText(tela.getByPlaceholderText('EXCLUIR'), 'EXCLUIR');
    await act(async () => {
      fireEvent.press(tela.getByTestId('confirm-reset'));
    });

    await waitFor(() =>
      expect(tela.getByText('Não é possível excluir agora')).toBeTruthy(),
    );
    expect(
      tela.getByText('Você tem uma rota em andamento. Finalize a rota.'),
    ).toBeTruthy();
  });

  it('guarda indisponível (503): pede para tentar de novo, sem dizer que a conta é inexcluível', async () => {
    deleteAccount.mockRejectedValue(
      new ExclusaoRecusadaError('GUARDA_INDISPONIVEL', 'Nada foi apagado.'),
    );
    const tela = await abrirConfirmacao();
    fireEvent.changeText(tela.getByPlaceholderText('EXCLUIR'), 'EXCLUIR');
    await act(async () => {
      fireEvent.press(tela.getByTestId('confirm-reset'));
    });

    await waitFor(() =>
      expect(tela.getByText('Tente novamente em instantes')).toBeTruthy(),
    );
    expect(tela.queryByText('Não é possível excluir agora')).toBeNull();
  });

  it('erro qualquer: segue o texto de sempre, com o e-mail do suporte', async () => {
    deleteAccount.mockRejectedValue(new Error('rede'));
    const tela = await abrirConfirmacao();
    fireEvent.changeText(tela.getByPlaceholderText('EXCLUIR'), 'EXCLUIR');
    await act(async () => {
      fireEvent.press(tela.getByTestId('confirm-reset'));
    });

    await waitFor(() =>
      expect(tela.getByText('Não foi possível excluir')).toBeTruthy(),
    );
    expect(
      tela.getAllByText(/solicite a exclusão pelo e-mail/).length,
    ).toBeGreaterThan(0);
  });
});
