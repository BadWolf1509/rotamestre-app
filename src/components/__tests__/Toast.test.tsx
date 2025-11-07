import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Toast } from '../Toast';

describe('Toast Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it('deve renderizar com tipo success e ícone correto', () => {
    const { getByText } = render(
      <Toast
        visible={true}
        message="Sucesso!"
        type="success"
        onDismiss={jest.fn()}
      />
    );
    expect(getByText('Sucesso!')).toBeTruthy();
    expect(getByText('✅')).toBeTruthy();
  });

  it('deve renderizar com tipo error e ícone correto', () => {
    const { getByText } = render(
      <Toast
        visible={true}
        message="Erro!"
        type="error"
        onDismiss={jest.fn()}
      />
    );
    expect(getByText('Erro!')).toBeTruthy();
    expect(getByText('❌')).toBeTruthy();
  });

  it('deve renderizar com tipo info e ícone correto', () => {
    const { getByText } = render(
      <Toast
        visible={true}
        message="Info!"
        type="info"
        onDismiss={jest.fn()}
      />
    );
    expect(getByText('Info!')).toBeTruthy();
    expect(getByText('ℹ️')).toBeTruthy();
  });

  it('deve renderizar com tipo loading e ícone correto', () => {
    const { getByText, queryByText } = render(
      <Toast
        visible={true}
        message="Carregando..."
        type="loading"
        onDismiss={jest.fn()}
      />
    );
    expect(getByText('Carregando...')).toBeTruthy();
    expect(getByText('⏳')).toBeTruthy();
    // Loading não tem botão de fechar
    expect(queryByText('✕')).toBeNull();
  });

  it('deve mostrar botão de fechar quando não é loading', () => {
    const { getByText } = render(
      <Toast
        visible={true}
        message="Teste"
        type="success"
        onDismiss={jest.fn()}
      />
    );
    expect(getByText('✕')).toBeTruthy();
  });

  it('deve chamar onDismiss quando clicar no botão fechar', () => {
    jest.useFakeTimers();
    const mockDismiss = jest.fn();
    const { getByText } = render(
      <Toast
        visible={true}
        message="Teste"
        type="success"
        onDismiss={mockDismiss}
      />
    );

    const closeButton = getByText('✕');
    fireEvent.press(closeButton);

    // onDismiss é chamado após a animação (200ms)
    act(() => {
      jest.advanceTimersByTime(250);
    });

    expect(mockDismiss).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
