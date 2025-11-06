import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Toast } from '../Toast';

describe('Toast Component', () => {
  it('não deve renderizar quando visible é false', () => {
    const { queryByText } = render(
      <Toast
        visible={false}
        message="Teste"
        type="success"
        onDismiss={jest.fn()}
      />
    );
    expect(queryByText('Teste')).toBeNull();
  });

  it('deve renderizar quando visible é true', () => {
    const { getByText } = render(
      <Toast
        visible={true}
        message="Teste de mensagem"
        type="success"
        onDismiss={jest.fn()}
      />
    );
    expect(getByText('Teste de mensagem')).toBeTruthy();
  });

  it('deve aplicar estilo de sucesso corretamente', () => {
    const { getByText } = render(
      <Toast
        visible={true}
        message="Sucesso!"
        type="success"
        onDismiss={jest.fn()}
      />
    );
    const toast = getByText('Sucesso!').parent?.parent;
    expect(toast).toHaveStyle({ backgroundColor: '#10b981' });
  });

  it('deve aplicar estilo de erro corretamente', () => {
    const { getByText } = render(
      <Toast
        visible={true}
        message="Erro!"
        type="error"
        onDismiss={jest.fn()}
      />
    );
    const toast = getByText('Erro!').parent?.parent;
    expect(toast).toHaveStyle({ backgroundColor: '#ef4444' });
  });

  it('deve aplicar estilo de warning corretamente', () => {
    const { getByText } = render(
      <Toast
        visible={true}
        message="Aviso!"
        type="warning"
        onDismiss={jest.fn()}
      />
    );
    const toast = getByText('Aviso!').parent?.parent;
    expect(toast).toHaveStyle({ backgroundColor: '#f59e0b' });
  });

  it('deve chamar onDismiss quando fechar', () => {
    const mockDismiss = jest.fn();
    const { getByTestId } = render(
      <Toast
        visible={true}
        message="Teste"
        type="success"
        onDismiss={mockDismiss}
      />
    );

    const closeButton = getByTestId('toast-close');
    fireEvent.press(closeButton);
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  it('deve auto-fechar após duration (3000ms)', () => {
    jest.useFakeTimers();
    const mockDismiss = jest.fn();

    render(
      <Toast
        visible={true}
        message="Auto fechar"
        type="success"
        onDismiss={mockDismiss}
        duration={3000}
      />
    );

    expect(mockDismiss).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockDismiss).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('não deve auto-fechar se duration não for fornecido', () => {
    jest.useFakeTimers();
    const mockDismiss = jest.fn();

    render(
      <Toast
        visible={true}
        message="Sem auto fechar"
        type="success"
        onDismiss={mockDismiss}
      />
    );

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockDismiss).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
