import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

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
});
