import { render, fireEvent, act } from '@testing-library/react-native';
import React from 'react';

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

  it('deve auto-dismiss após duration quando não é loading', () => {
    jest.useFakeTimers();
    const mockDismiss = jest.fn();

    render(
      <Toast
        visible={true}
        message="Auto dismiss test"
        type="success"
        onDismiss={mockDismiss}
        duration={3000}
      />
    );

    // Avançar o tempo até o duration
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // Avançar mais tempo para a animação de dismissal
    act(() => {
      jest.advanceTimersByTime(250);
    });

    expect(mockDismiss).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('deve chamar handleDismiss quando visible muda de true para false', () => {
    jest.useFakeTimers();
    const mockDismiss = jest.fn();

    const { rerender } = render(
      <Toast
        visible={true}
        message="Teste"
        type="success"
        onDismiss={mockDismiss}
        duration={0} // Sem auto-dismiss
      />
    );

    // Mudar visible para false
    rerender(
      <Toast
        visible={false}
        message="Teste"
        type="success"
        onDismiss={mockDismiss}
        duration={0}
      />
    );

    // Avançar tempo para animação
    act(() => {
      jest.advanceTimersByTime(250);
    });

    expect(mockDismiss).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('esconder pelo pai antes do duration (auto-dispensa ativa) chama onDismiss', () => {
    // B-UI-3: com duration > 0 o efeito saía antes de gravar wasVisibleRef,
    // e o ramo "pai escondeu" nunca rodava.
    jest.useFakeTimers();
    const mockDismiss = jest.fn();
    const props = {
      message: 'Teste',
      type: 'success' as const,
      onDismiss: mockDismiss,
      duration: 3000,
    };

    const { rerender } = render(<Toast visible={true} {...props} />);
    rerender(<Toast visible={false} {...props} />);

    act(() => {
      jest.advanceTimersByTime(250);
    });

    expect(mockDismiss).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
  it('auto-dispensa seguida de o pai esconder chama onDismiss uma vez só', () => {
    jest.useFakeTimers();
    const mockDismiss = jest.fn();
    const props = {
      message: 'Teste',
      type: 'success' as const,
      onDismiss: mockDismiss,
      duration: 1000,
    };

    const { rerender } = render(<Toast visible={true} {...props} />);
    act(() => {
      jest.advanceTimersByTime(1300);
    });
    // O pai reage ao onDismiss escondendo o toast.
    rerender(<Toast visible={false} {...props} />);
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockDismiss).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('mesma instância: dispensa, mostra de novo e o pai esconde → dispensa de novo', () => {
    // I3: o useToast reaproveita a instância; a 1ª dispensa não pode matar o
    // ramo "pai escondeu" dos toasts seguintes (inclusive loading, sem timer).
    jest.useFakeTimers();
    const mockDismiss = jest.fn();
    const props = { message: 'Teste', type: 'loading' as const, onDismiss: mockDismiss };

    const { rerender } = render(<Toast visible={true} {...props} />);
    rerender(<Toast visible={false} {...props} />);
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(mockDismiss).toHaveBeenCalledTimes(1);

    rerender(<Toast visible={true} {...props} />);
    rerender(<Toast visible={false} {...props} />);
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(mockDismiss).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});
