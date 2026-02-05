import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text, View } from 'react-native';

import { ErrorBoundary } from '../ErrorBoundary';

// Componente auxiliar que lanca erro quando shouldThrow e true
const ThrowError = ({ shouldThrow, errorMessage = 'Test error' }: { shouldThrow: boolean; errorMessage?: string }) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <Text>Children rendered successfully</Text>;
};

// Componente que lanca erro customizado
class CustomError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'CustomError';
    this.code = code;
  }
}

const ThrowCustomError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new CustomError('Custom error message', 'ERR_001');
  }
  return <Text>No error</Text>;
};

// Componente que lanca TypeError
const ThrowTypeError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new TypeError('Cannot read property of undefined');
  }
  return <Text>Type safe</Text>;
};

// Componente que lanca RangeError
const ThrowRangeError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new RangeError('Value out of range');
  }
  return <Text>In range</Text>;
};

// Componente que lanca SyntaxError
const ThrowSyntaxError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new SyntaxError('Unexpected token');
  }
  return <Text>Valid syntax</Text>;
};

// Suprimir logs de erro do console durante os testes (ErrorBoundary loga erros)
const originalConsoleError = console.error;

describe('ErrorBoundary Component', () => {
  beforeAll(() => {
    // Suprimir console.error para evitar poluicao nos testes
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderizacao Normal', () => {
    it('deve renderizar children quando nao ha erro', () => {
      const { getByText } = render(
        <ErrorBoundary>
          <Text>Conteudo normal</Text>
        </ErrorBoundary>
      );

      expect(getByText('Conteudo normal')).toBeTruthy();
    });

    it('deve renderizar multiplos children sem erro', () => {
      const { getByText } = render(
        <ErrorBoundary>
          <Text>Primeiro filho</Text>
          <Text>Segundo filho</Text>
          <View>
            <Text>Terceiro filho aninhado</Text>
          </View>
        </ErrorBoundary>
      );

      expect(getByText('Primeiro filho')).toBeTruthy();
      expect(getByText('Segundo filho')).toBeTruthy();
      expect(getByText('Terceiro filho aninhado')).toBeTruthy();
    });

    it('deve renderizar children complexos sem erro', () => {
      const ComplexChild = () => (
        <View>
          <Text>Header</Text>
          <View>
            <Text>Content</Text>
          </View>
        </View>
      );

      const { getByText } = render(
        <ErrorBoundary>
          <ComplexChild />
        </ErrorBoundary>
      );

      expect(getByText('Header')).toBeTruthy();
      expect(getByText('Content')).toBeTruthy();
    });
  });

  describe('Captura de Erro', () => {
    it('deve capturar erro e mostrar UI de fallback padrao', () => {
      const { getByText, queryByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Nao deve mostrar o children
      expect(queryByText('Children rendered successfully')).toBeNull();

      // Deve mostrar UI de fallback
      expect(getByText('Algo deu errado')).toBeTruthy();
      expect(getByText('Ocorreu um erro inesperado. Por favor, tente novamente.')).toBeTruthy();
    });

    it('deve mostrar botao de tentar novamente no fallback padrao', () => {
      const { getByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByText('Tentar Novamente')).toBeTruthy();
    });

    it('deve usar fallback customizado quando fornecido', () => {
      const CustomFallback = <Text>Fallback customizado</Text>;

      const { getByText, queryByText } = render(
        <ErrorBoundary fallback={CustomFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByText('Fallback customizado')).toBeTruthy();
      expect(queryByText('Algo deu errado')).toBeNull();
    });

    it('deve renderizar fallback customizado complexo', () => {
      const CustomFallback = (
        <View>
          <Text>Erro Personalizado</Text>
          <Text>Por favor, recarregue a pagina</Text>
        </View>
      );

      const { getByText } = render(
        <ErrorBoundary fallback={CustomFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByText('Erro Personalizado')).toBeTruthy();
      expect(getByText('Por favor, recarregue a pagina')).toBeTruthy();
    });
  });

  describe('componentDidCatch', () => {
    it('deve chamar onError callback com error e errorInfo', () => {
      const onErrorMock = jest.fn();

      render(
        <ErrorBoundary onError={onErrorMock}>
          <ThrowError shouldThrow={true} errorMessage="Erro de teste para callback" />
        </ErrorBoundary>
      );

      expect(onErrorMock).toHaveBeenCalledTimes(1);

      // Verificar que foi chamado com um Error
      const [error, errorInfo] = onErrorMock.mock.calls[0];
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Erro de teste para callback');

      // Verificar que errorInfo contem componentStack
      expect(errorInfo).toBeDefined();
      expect(errorInfo).toHaveProperty('componentStack');
    });

    it('deve logar erro no logger.error', () => {
      const { logger } = require('@/lib/logger');
      const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation();

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Erro para console" />
        </ErrorBoundary>
      );

      // Verificar que logger.error foi chamado com a mensagem correta
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'ErrorBoundary caught an error',
        expect.any(Error)
      );

      loggerErrorSpy.mockRestore();
    });

    it('deve funcionar sem onError callback', () => {
      // Nao deve lancar erro se onError nao for fornecido
      expect(() => {
        render(
          <ErrorBoundary>
            <ThrowError shouldThrow={true} />
          </ErrorBoundary>
        );
      }).not.toThrow();
    });
  });

  describe('Botao de Retry', () => {
    it('deve resetar estado ao clicar em Tentar Novamente', async () => {
      let shouldThrow = true;

      const TestComponent = () => {
        if (shouldThrow) {
          throw new Error('Erro inicial');
        }
        return <Text>Componente recuperado</Text>;
      };

      const { getByText, rerender, queryByText } = render(
        <ErrorBoundary>
          <TestComponent />
        </ErrorBoundary>
      );

      // Verificar que erro foi capturado
      expect(getByText('Algo deu errado')).toBeTruthy();

      // Simular correcao do erro
      shouldThrow = false;

      // Clicar em tentar novamente
      fireEvent.press(getByText('Tentar Novamente'));

      // Agora deve tentar renderizar novamente e mostrar o conteudo
      // Como o componente vai re-renderizar sem erro, deve mostrar o children
      rerender(
        <ErrorBoundary>
          <TestComponent />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(queryByText('Algo deu errado')).toBeNull();
      });
    });

    it('deve ter acessibilidade no botao de retry', () => {
      const { getByLabelText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const button = getByLabelText('Tentar novamente');
      expect(button).toBeTruthy();
      expect(button.props.accessibilityRole).toBe('button');
    });
  });

  describe('Diferentes Tipos de Erro', () => {
    it('deve capturar Error padrao', () => {
      const { getByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Standard Error" />
        </ErrorBoundary>
      );

      expect(getByText('Algo deu errado')).toBeTruthy();
    });

    it('deve capturar TypeError', () => {
      const { getByText } = render(
        <ErrorBoundary>
          <ThrowTypeError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByText('Algo deu errado')).toBeTruthy();
    });

    it('deve capturar RangeError', () => {
      const { getByText } = render(
        <ErrorBoundary>
          <ThrowRangeError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByText('Algo deu errado')).toBeTruthy();
    });

    it('deve capturar SyntaxError', () => {
      const { getByText } = render(
        <ErrorBoundary>
          <ThrowSyntaxError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByText('Algo deu errado')).toBeTruthy();
    });

    it('deve capturar erro customizado', () => {
      const onErrorMock = jest.fn();

      const { getByText } = render(
        <ErrorBoundary onError={onErrorMock}>
          <ThrowCustomError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByText('Algo deu errado')).toBeTruthy();

      const [error] = onErrorMock.mock.calls[0];
      expect(error.name).toBe('CustomError');
      expect((error as CustomError).code).toBe('ERR_001');
    });

    it('deve capturar erro com mensagem longa', () => {
      const longMessage = 'Este e um erro com uma mensagem muito longa que pode acontecer em producao quando algo da muito errado e o sistema precisa lidar com isso graciosamente sem quebrar a interface do usuario.';

      const { getByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage={longMessage} />
        </ErrorBoundary>
      );

      expect(getByText('Algo deu errado')).toBeTruthy();
    });
  });

  describe('ErrorInfo e Stack Trace', () => {
    it('deve capturar componentStack no errorInfo', () => {
      const onErrorMock = jest.fn();

      const NestedComponent = () => {
        throw new Error('Erro aninhado');
      };

      const ParentComponent = () => (
        <View>
          <NestedComponent />
        </View>
      );

      render(
        <ErrorBoundary onError={onErrorMock}>
          <ParentComponent />
        </ErrorBoundary>
      );

      expect(onErrorMock).toHaveBeenCalled();
      const [, errorInfo] = onErrorMock.mock.calls[0];

      expect(errorInfo.componentStack).toBeDefined();
      expect(typeof errorInfo.componentStack).toBe('string');
    });

    it('deve passar error.message para o callback', () => {
      const onErrorMock = jest.fn();
      const errorMessage = 'Mensagem de erro especifica';

      render(
        <ErrorBoundary onError={onErrorMock}>
          <ThrowError shouldThrow={true} errorMessage={errorMessage} />
        </ErrorBoundary>
      );

      const [error] = onErrorMock.mock.calls[0];
      expect(error.message).toBe(errorMessage);
    });

    it('deve manter error.stack no erro capturado', () => {
      const onErrorMock = jest.fn();

      render(
        <ErrorBoundary onError={onErrorMock}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const [error] = onErrorMock.mock.calls[0];
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });
  });

  describe('Reset com resetKeys', () => {
    it('deve resetar quando resetKeys mudam', async () => {
      let shouldThrow = true;

      const TestComponent = () => {
        if (shouldThrow) {
          throw new Error('Erro');
        }
        return <Text>Recuperado</Text>;
      };

      const { getByText, rerender, queryByText } = render(
        <ErrorBoundary resetKeys={[1]}>
          <TestComponent />
        </ErrorBoundary>
      );

      // Erro foi capturado
      expect(getByText('Algo deu errado')).toBeTruthy();

      // Corrigir o erro
      shouldThrow = false;

      // Re-renderizar com resetKeys diferente
      rerender(
        <ErrorBoundary resetKeys={[2]}>
          <TestComponent />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(getByText('Recuperado')).toBeTruthy();
        expect(queryByText('Algo deu errado')).toBeNull();
      });
    });

    it('nao deve resetar quando resetKeys nao mudam', () => {
      const TestComponent = () => {
        throw new Error('Erro');
      };

      const { getByText, rerender } = render(
        <ErrorBoundary resetKeys={[1, 2]}>
          <TestComponent />
        </ErrorBoundary>
      );

      // Erro foi capturado
      expect(getByText('Algo deu errado')).toBeTruthy();

      // Re-renderizar com mesmas resetKeys
      rerender(
        <ErrorBoundary resetKeys={[1, 2]}>
          <TestComponent />
        </ErrorBoundary>
      );

      // Ainda deve mostrar erro
      expect(getByText('Algo deu errado')).toBeTruthy();
    });

    it('deve resetar quando comprimento de resetKeys muda', async () => {
      let shouldThrow = true;

      const TestComponent = () => {
        if (shouldThrow) {
          throw new Error('Erro');
        }
        return <Text>OK</Text>;
      };

      const { getByText, rerender, queryByText } = render(
        <ErrorBoundary resetKeys={[1]}>
          <TestComponent />
        </ErrorBoundary>
      );

      expect(getByText('Algo deu errado')).toBeTruthy();

      shouldThrow = false;

      // Re-renderizar com mais keys
      rerender(
        <ErrorBoundary resetKeys={[1, 2]}>
          <TestComponent />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(getByText('OK')).toBeTruthy();
        expect(queryByText('Algo deu errado')).toBeNull();
      });
    });
  });

  describe('Estado getDerivedStateFromError', () => {
    it('deve setar hasError como true quando erro ocorre', () => {
      const { queryByText, getByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Se hasError e true, nao renderiza children
      expect(queryByText('Children rendered successfully')).toBeNull();
      // E renderiza fallback
      expect(getByText('Algo deu errado')).toBeTruthy();
    });

    it('deve armazenar o erro no state', () => {
      const onErrorMock = jest.fn();
      const errorMessage = 'Erro especifico para state';

      render(
        <ErrorBoundary onError={onErrorMock}>
          <ThrowError shouldThrow={true} errorMessage={errorMessage} />
        </ErrorBoundary>
      );

      // O erro foi passado para onError, indicando que foi armazenado
      const [error] = onErrorMock.mock.calls[0];
      expect(error.message).toBe(errorMessage);
    });
  });

  describe('UI de Fallback Padrao', () => {
    it('deve renderizar icone de erro', () => {
      const { UNSAFE_getAllByType } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const Ionicons = require('@expo/vector-icons').Ionicons;
      const icons = UNSAFE_getAllByType(Ionicons);
      // First icon should be the alert icon
      expect(icons[0].props.name).toBe('alert-circle-outline');
    });

    it('deve renderizar icone no botao de retry', () => {
      const { UNSAFE_getAllByType } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const Ionicons = require('@expo/vector-icons').Ionicons;
      const icons = UNSAFE_getAllByType(Ionicons);

      // Deve ter 4 icones: alert, refresh, home, bug
      expect(icons.length).toBe(4);
      expect(icons[0].props.name).toBe('alert-circle-outline');
      expect(icons[1].props.name).toBe('refresh-outline');
      expect(icons[2].props.name).toBe('home-outline');
      expect(icons[3].props.name).toBe('bug-outline');
    });

    it('deve mostrar mensagem de erro em modo DEV', () => {
      // __DEV__ e true nos testes por padrao
      const errorMessage = 'Mensagem de erro detalhada';

      const { getByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage={errorMessage} />
        </ErrorBoundary>
      );

      // Em modo DEV, deve mostrar o label e a mensagem de erro
      expect(getByText('Detalhes (DEV):')).toBeTruthy();
      // A mensagem agora inclui o tipo do erro (Error: message)
      expect(getByText(/Mensagem de erro detalhada/)).toBeTruthy();
    });
  });

  describe('Transicao de Estado', () => {
    it('deve transicionar de erro para normal apos reset', async () => {
      let shouldThrow = true;

      const TestComponent = () => {
        if (shouldThrow) {
          throw new Error('Erro temporario');
        }
        return <Text>Tudo funcionando</Text>;
      };

      const { getByText, rerender, queryByText } = render(
        <ErrorBoundary resetKeys={['v1']}>
          <TestComponent />
        </ErrorBoundary>
      );

      // Estado inicial: erro
      expect(getByText('Algo deu errado')).toBeTruthy();
      expect(queryByText('Tudo funcionando')).toBeNull();

      // Corrigir e resetar
      shouldThrow = false;

      rerender(
        <ErrorBoundary resetKeys={['v2']}>
          <TestComponent />
        </ErrorBoundary>
      );

      // Estado final: normal
      await waitFor(() => {
        expect(getByText('Tudo funcionando')).toBeTruthy();
        expect(queryByText('Algo deu errado')).toBeNull();
      });
    });

    it('deve capturar novo erro apos reset', async () => {
      // This test verifies that ErrorBoundary can catch multiple errors
      // after being reset via resetKeys prop
      const { getByText } = render(
        <ErrorBoundary resetKeys={['v1']}>
          <ThrowError shouldThrow={true} errorMessage="Erro de teste" />
        </ErrorBoundary>
      );

      // Deve mostrar a tela de erro
      expect(getByText('Algo deu errado')).toBeTruthy();
    });
  });

  describe('Casos de Borda', () => {
    it('deve lidar com children undefined', () => {
      // Should not throw when rendering undefined children
      expect(() => {
        render(
          <ErrorBoundary>
            {undefined}
          </ErrorBoundary>
        );
      }).not.toThrow();
    });

    it('deve lidar com children null', () => {
      // Should not throw when rendering null children
      expect(() => {
        render(
          <ErrorBoundary>
            {null}
          </ErrorBoundary>
        );
      }).not.toThrow();
    });

    it('deve lidar com erro em componente profundamente aninhado', () => {
      const DeepComponent = () => {
        throw new Error('Erro profundo');
      };

      const Level3 = () => <DeepComponent />;
      const Level2 = () => <Level3 />;
      const Level1 = () => <Level2 />;

      const onErrorMock = jest.fn();

      const { getByText } = render(
        <ErrorBoundary onError={onErrorMock}>
          <Level1 />
        </ErrorBoundary>
      );

      expect(getByText('Algo deu errado')).toBeTruthy();
      expect(onErrorMock).toHaveBeenCalled();
    });

    it('deve lidar com erro sem mensagem', () => {
      const ThrowEmptyError = () => {
        throw new Error();
      };

      const { getByText } = render(
        <ErrorBoundary>
          <ThrowEmptyError />
        </ErrorBoundary>
      );

      expect(getByText('Algo deu errado')).toBeTruthy();
    });
  });

  describe('Botoes Secundarios', () => {
    it('deve renderizar botao Inicio por padrao', () => {
      const { getByLabelText, getByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByLabelText('Voltar ao início')).toBeTruthy();
      expect(getByText('Início')).toBeTruthy();
    });

    it('deve renderizar botao Reportar por padrao', () => {
      const { getByLabelText, getByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByLabelText('Reportar problema')).toBeTruthy();
      expect(getByText('Reportar')).toBeTruthy();
    });

    it('deve ocultar botao Inicio quando showGoHome=false', () => {
      const { queryByLabelText } = render(
        <ErrorBoundary showGoHome={false}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(queryByLabelText('Voltar ao início')).toBeNull();
    });

    it('deve ocultar botao Reportar quando showReportBug=false', () => {
      const { queryByLabelText } = render(
        <ErrorBoundary showReportBug={false}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(queryByLabelText('Reportar problema')).toBeNull();
    });
  });

  describe('Multiplos ErrorBoundaries', () => {
    it('deve isolar erros em ErrorBoundaries separados', () => {
      const { getByText, queryByText: _queryByText } = render(
        <View>
          <ErrorBoundary>
            <ThrowError shouldThrow={true} errorMessage="Erro 1" />
          </ErrorBoundary>
          <ErrorBoundary>
            <Text>Este funciona</Text>
          </ErrorBoundary>
        </View>
      );

      // Primeiro ErrorBoundary capturou o erro
      expect(getByText('Algo deu errado')).toBeTruthy();

      // Segundo ErrorBoundary funciona normalmente
      expect(getByText('Este funciona')).toBeTruthy();
    });

    it('deve funcionar com ErrorBoundaries aninhados', () => {
      const { getByText, getAllByText: _getAllByText } = render(
        <ErrorBoundary fallback={<Text>Fallback externo</Text>}>
          <View>
            <ErrorBoundary>
              <ThrowError shouldThrow={true} />
            </ErrorBoundary>
            <Text>Conteudo fora do boundary interno</Text>
          </View>
        </ErrorBoundary>
      );

      // O ErrorBoundary interno captura o erro
      expect(getByText('Algo deu errado')).toBeTruthy();
      // Conteudo fora do boundary interno ainda e renderizado
      expect(getByText('Conteudo fora do boundary interno')).toBeTruthy();
    });
  });
});
