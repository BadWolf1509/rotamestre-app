import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { AvisoErroCarga } from '../AvisoErroCarga';

describe('AvisoErroCarga', () => {
  it('sem dados anteriores: diz que falhou e oferece tentar de novo', () => {
    const tentar = jest.fn();
    const { getByText, queryByText } = render(
      <AvisoErroCarga
        mensagem="Não foi possível carregar as rotas."
        dadosDe={null}
        onTentarNovamente={tentar}
      />,
    );

    expect(getByText(/Não foi possível carregar as rotas\./)).toBeTruthy();
    expect(queryByText(/dados de/)).toBeNull();
    fireEvent.press(getByText('Tentar novamente'));
    expect(tentar).toHaveBeenCalledTimes(1);
  });

  it('com dados anteriores: mostra o selo "dados de HH:MM" (hora local)', () => {
    const { getByText } = render(
      <AvisoErroCarga
        mensagem="Não foi possível atualizar."
        dadosDe={new Date(2026, 9, 22, 9, 5).getTime()}
        onTentarNovamente={jest.fn()}
      />,
    );

    expect(getByText(/dados de 09:05/)).toBeTruthy();
  });
});
