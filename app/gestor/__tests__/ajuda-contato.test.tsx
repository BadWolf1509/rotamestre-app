/**
 * Contato da Ajuda do gestor: abre direto, sem `canOpenURL`.
 *
 * No Android 11+ `canOpenURL('whatsapp://…')` responde false com o app
 * instalado (sem <queries>), e o toque virava "WhatsApp não instalado".
 */
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';

import { SUPORTE_TELEFONE } from '@/constants/suporte';

import AjudaGestorScreen from '../ajuda';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockShowWarning = jest.fn();
jest.mock('@/hooks/useAlert', () => ({
  useAlert: () => ({ showWarning: mockShowWarning, AlertDialog: null }),
}));

describe('AjudaGestorScreen - contato', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockShowWarning.mockClear();
  });

  it('WhatsApp abre o link https do wa.me, sem consultar canOpenURL', async () => {
    const pode = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(false);
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const api = render(<AjudaGestorScreen />);

    fireEvent.press(api.getByText('WhatsApp Empresarial'));

    await waitFor(() => expect(abrir).toHaveBeenCalledTimes(1));
    expect(abrir.mock.calls[0][0]).toContain(
      `https://wa.me/${SUPORTE_TELEFONE}`,
    );
    expect(pode).not.toHaveBeenCalled();
  });

  it('openURL que rejeita mostra aviso de falha', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('sem app'));
    const api = render(<AjudaGestorScreen />);

    fireEvent.press(api.getByText('WhatsApp Empresarial'));

    await waitFor(() =>
      expect(mockShowWarning).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('o WhatsApp'),
      ),
    );
  });

  it('e-mail e telefone que rejeitam também avisam, sem rejeição solta', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('sem app'));
    const api = render(<AjudaGestorScreen />);

    fireEvent.press(api.getByText('Telefone'));
    await waitFor(() =>
      expect(mockShowWarning).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('o discador'),
      ),
    );
  });
});
