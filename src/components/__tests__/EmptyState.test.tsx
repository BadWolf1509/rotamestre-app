import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('deve renderizar título', () => {
    const { getByText } = render(<EmptyState title="Nada aqui" />);
    expect(getByText('Nada aqui')).toBeTruthy();
  });

  it('deve renderizar descrição se fornecida', () => {
    const { getByText } = render(
      <EmptyState title="Vazio" description="Descrição detalhada" />
    );
    expect(getByText('Descrição detalhada')).toBeTruthy();
  });

  it('deve renderizar botão de ação se fornecido', () => {
    const onAction = jest.fn();
    const { getByText } = render(
      <EmptyState
        title="Vazio"
        actionLabel="Tentar Novamente"
        onActionPress={onAction}
      />
    );

    const button = getByText('Tentar Novamente');
    expect(button).toBeTruthy();

    fireEvent.press(button);
    expect(onAction).toHaveBeenCalled();
  });

  it('não deve renderizar botão se actionLabel não for fornecido', () => {
    const { queryByText } = render(
      <EmptyState title="Vazio" onActionPress={() => { }} />
    );

    expect(queryByText('Tentar Novamente')).toBeNull();
  });

  describe('modos de layout (R-UI-2)', () => {
    const estiloRaiz = (el: { props: { style?: unknown } }) =>
      StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

    it('padrão ocupa o espaço e centraliza (flex 1)', () => {
      const { getByTestId } = render(
        <EmptyState title="Vazio" testID="vazio" />
      );
      expect(estiloRaiz(getByTestId('vazio')).flex).toBe(1);
    });

    it('compact não ocupa a tela inteira (cabe dentro de lista)', () => {
      const { getByTestId } = render(
        <EmptyState title="Vazio" compact testID="vazio" />
      );
      const estilo = estiloRaiz(getByTestId('vazio'));
      expect(estilo.flex).toBeUndefined();
      expect(estilo.alignItems).toBe('center');
    });

    it('fullScreen ocupa a tela com fundo gray50', () => {
      const { getByTestId } = render(
        <EmptyState title="Vazio" fullScreen testID="vazio" />
      );
      const estilo = estiloRaiz(getByTestId('vazio'));
      expect(estilo.flex).toBe(1);
      expect(estilo.backgroundColor).toBeDefined();
    });
  });
});
