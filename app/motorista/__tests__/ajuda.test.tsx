/**
 * FAQ da Ajuda: o texto não pode prometer o que o app não faz nem negar o que
 * ele faz. Desde a 1.14.3/1.14.5, concluir e pular sem rede (com foto) ficam
 * guardados e sobem sozinhos; e o histórico não mostra fotos.
 *
 * Só a resposta aberta é renderizada, então `queryByText` enxerga uma por vez.
 */
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import AjudaScreen from '../ajuda';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('AjudaScreen - FAQ', () => {
  it('"O app funciona offline?" explica que concluir e pular sem rede sobem sozinhos', () => {
    const api = render(<AjudaScreen />);
    fireEvent.press(api.getByText('O app funciona offline?'));

    expect(api.queryByText(/requerem conexão/)).toBeNull();
    expect(api.getByText(/sobe sozinho/)).toBeTruthy();
    expect(api.getByText(/Início mostra um aviso/)).toBeTruthy();
  });

  it('o histórico não promete fotos', () => {
    const api = render(<AjudaScreen />);
    fireEvent.press(api.getByText('Como ver meu histórico de rotas?'));

    expect(
      api.getByText(/Na barra inferior, toque em "Histórico"/),
    ).toBeTruthy();
    expect(api.queryByText(/fotos/i)).toBeNull();
  });
});
