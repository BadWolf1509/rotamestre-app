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

  it('com dados anteriores de hoje: mostra o selo "dados de HH:MM" (hora local)', () => {
    const { getByText } = render(
      <AvisoErroCarga
        mensagem="Não foi possível atualizar."
        dadosDe={new Date(new Date().setHours(9, 5, 0, 0)).getTime()}
        onTentarNovamente={jest.fn()}
      />,
    );

    expect(getByText(/dados de 09:05/)).toBeTruthy();
  });

  it('dados de outro dia: o selo mostra a data junto com a hora', () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    ontem.setHours(18, 30, 0, 0);
    const dia = String(ontem.getDate()).padStart(2, '0');
    const mes = String(ontem.getMonth() + 1).padStart(2, '0');

    const { getByText } = render(
      <AvisoErroCarga
        mensagem="Não foi possível atualizar."
        dadosDe={ontem.getTime()}
        onTentarNovamente={jest.fn()}
      />,
    );

    expect(
      getByText(
        new RegExp(`dados de ${dia}/${mes}/${ontem.getFullYear()} às 18:30`),
      ),
    ).toBeTruthy();
  });

  it('dados de hoje: só a hora', () => {
    const hoje = new Date();
    hoje.setHours(0, 5, 0, 0);
    const { getByText, queryByText } = render(
      <AvisoErroCarga
        mensagem="Não foi possível atualizar."
        dadosDe={hoje.getTime()}
        onTentarNovamente={jest.fn()}
      />,
    );
    expect(getByText(/dados de 00:05\./)).toBeTruthy();
    expect(queryByText(/dados de \d{2}\//)).toBeNull();
  });
});
