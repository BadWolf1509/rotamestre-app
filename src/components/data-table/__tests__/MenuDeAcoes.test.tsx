/**
 * MenuDeAcoes — o botão "⋯" das ações destrutivas de uma linha do DataTable.
 *
 * Abre com toque/clique (no web, Enter e Espaço acionam o mesmo `onPress` do
 * botão), fecha com Esc (`onRequestClose` do Modal, que o react-native-web
 * dispara no Escape), com toque fora e ao escolher um item.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Modal } from 'react-native';

import { MenuDeAcoes } from '../MenuDeAcoes';

import type { DataTableAction } from '../types';

interface Item {
  id: string;
  nome: string;
}

const item: Item = { id: '1', nome: 'Rota da manhã' };

function acoes(onExcluir = jest.fn()): DataTableAction<Item>[] {
  return [
    {
      label: (i) => `Excluir ${i.nome}`,
      icon: 'trash-outline',
      type: 'danger',
      onPress: onExcluir,
    },
  ];
}

describe('MenuDeAcoes', () => {
  it('o botão tem o rótulo "Mais ações" e começa fechado', () => {
    render(<MenuDeAcoes item={item} acoes={acoes()} />);

    const botao = screen.getByLabelText('Mais ações');
    expect(botao.props.accessibilityRole).toBe('button');
    expect(botao.props.accessibilityState).toEqual(
      expect.objectContaining({ expanded: false }),
    );
    expect(screen.queryByText('Excluir Rota da manhã')).toBeNull();
  });

  it('tocar no botão abre a lista com itens de papel menuitem', () => {
    render(<MenuDeAcoes item={item} acoes={acoes()} />);

    fireEvent.press(screen.getByLabelText('Mais ações'));

    expect(
      screen.getByLabelText('Mais ações').props.accessibilityState,
    ).toEqual(expect.objectContaining({ expanded: true }));
    const opcao = screen.getByRole('menuitem', {
      name: 'Excluir Rota da manhã',
    });
    expect(opcao).toBeTruthy();
    // A lista não é elemento acessível próprio (agruparia os itens no nativo).
    expect(
      screen.UNSAFE_getByProps({ accessibilityRole: 'menu' }),
    ).toBeTruthy();
  });

  it('escolher um item chama onPress(item) e fecha o menu', () => {
    const onExcluir = jest.fn();
    render(<MenuDeAcoes item={item} acoes={acoes(onExcluir)} />);

    fireEvent.press(screen.getByLabelText('Mais ações'));
    fireEvent.press(screen.getByText('Excluir Rota da manhã'));

    expect(onExcluir).toHaveBeenCalledTimes(1);
    expect(onExcluir).toHaveBeenCalledWith(item);
    expect(screen.queryByText('Excluir Rota da manhã')).toBeNull();
  });

  it('Esc (onRequestClose) fecha sem chamar a ação', () => {
    const onExcluir = jest.fn();
    render(<MenuDeAcoes item={item} acoes={acoes(onExcluir)} />);

    fireEvent.press(screen.getByLabelText('Mais ações'));
    fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose');

    expect(screen.queryByText('Excluir Rota da manhã')).toBeNull();
    expect(onExcluir).not.toHaveBeenCalled();
  });

  it('tocar fora da lista fecha sem chamar a ação', () => {
    const onExcluir = jest.fn();
    render(
      <MenuDeAcoes item={item} acoes={acoes(onExcluir)} testID="menu-1" />,
    );

    fireEvent.press(screen.getByLabelText('Mais ações'));
    fireEvent.press(screen.getByTestId('menu-1-fora'));

    expect(screen.queryByText('Excluir Rota da manhã')).toBeNull();
    expect(onExcluir).not.toHaveBeenCalled();
  });

  it('o toque no botão e no item não se propaga (a linha não reage)', () => {
    const stopPropagation = jest.fn();
    render(<MenuDeAcoes item={item} acoes={acoes()} />);

    fireEvent.press(screen.getByLabelText('Mais ações'), { stopPropagation });
    fireEvent.press(screen.getByText('Excluir Rota da manhã'), {
      stopPropagation,
    });

    expect(stopPropagation).toHaveBeenCalledTimes(2);
  });
});
