/**
 * "Limpar Cache" (motorista e gestor): o diálogo diz o que a limpeza faz de
 * verdade. Ela preserva a sessão e o que ainda não subiu
 * (`chavesParaLimparNoCache`, `src/lib/limpezaDeCache.ts`) — prometer "fazer
 * login novamente" assusta à toa e esconde que as pendências ficam.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';

import ConfiguracoesGestor from '../gestor/configuracoes';
import ConfiguracoesMotorista from '../motorista/perfil/configuracoes';

jest.mock('@/components/ThemeSettings', () => ({ ThemeSettings: () => null }));
jest.mock('@/components/motorista/NavigationSettings', () => ({
  NavigationSettings: () => null,
}));

const TEXTO_ESPERADO =
  'Isso remove dados temporários do app. Sua sessão, as entregas e as fotos que ainda não foram enviadas são mantidas. Deseja continuar?';

beforeEach(() => {
  jest.clearAllMocks();
  global.mockUseAlert.showConfirm.mockResolvedValue(false);
});

describe.each([
  ['motorista', ConfiguracoesMotorista],
  ['gestor', ConfiguracoesGestor],
])('Limpar Cache (%s)', (_nome, Tela) => {
  it('o diálogo diz que a sessão e as pendências são mantidas', async () => {
    render(<Tela />);

    fireEvent.press(await screen.findByText('Limpar Cache'));

    await waitFor(() =>
      expect(global.mockUseAlert.showConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ message: TEXTO_ESPERADO }),
      ),
    );
    const [{ message }] = global.mockUseAlert.showConfirm.mock.calls[0];
    expect(message).not.toMatch(/login novamente/);
  });
});
