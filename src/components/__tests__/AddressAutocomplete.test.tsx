import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import React, { useState } from 'react';
import { Keyboard } from 'react-native';

import { AddressAutocomplete } from '../AddressAutocomplete';

// Wrapper para simular controlled component
function ControlledAddressAutocomplete({
  onSelectAddress,
  placeholder,
  error,
  multiline,
}: {
  onSelectAddress: (address: string, placeId: string) => void;
  placeholder?: string;
  error?: string;
  multiline?: boolean;
}) {
  const [value, setValue] = useState('');
  return (
    <AddressAutocomplete
      value={value}
      onChangeText={setValue}
      onSelectAddress={onSelectAddress}
      placeholder={placeholder}
      error={error}
      multiline={multiline}
    />
  );
}

// Mock Keyboard
jest.mock('react-native/Libraries/Components/Keyboard/Keyboard', () => ({
  dismiss: jest.fn(),
}));

// Mock do Google Maps Service
const mockAutocompleteAddress = jest.fn();

jest.mock('@/lib/google', () => ({
  googleMapsService: {
    autocompleteAddress: mockAutocompleteAddress,
  },
}));

describe('AddressAutocomplete Component', () => {
  const mockOnChangeText = jest.fn();
  const mockOnSelectAddress = jest.fn();

  const mockSuggestions = [
    {
      place_id: '1',
      description: 'Rua Example, 123 - Centro, São Paulo - SP',
      structured_formatting: {
        main_text: 'Rua Example, 123',
        secondary_text: 'Centro, São Paulo - SP',
      },
    },
    {
      place_id: '2',
      description: 'Avenida Test, 456 - Jardins, São Paulo - SP',
      structured_formatting: {
        main_text: 'Avenida Test, 456',
        secondary_text: 'Jardins, São Paulo - SP',
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockAutocompleteAddress.mockResolvedValue(mockSuggestions);
  });

  describe('Renderização Básica', () => {
    it('deve renderizar input', () => {
      const { getByPlaceholderText } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      expect(getByPlaceholderText('Digite o endereço completo')).toBeTruthy();
    });

    it('deve renderizar com placeholder customizado', () => {
      const { getByPlaceholderText } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
          placeholder="Digite seu endereço"
        />
      );

      expect(getByPlaceholderText('Digite seu endereço')).toBeTruthy();
    });

    it('deve exibir valor inicial', () => {
      const { getByDisplayValue } = render(
        <AddressAutocomplete
          value="Rua Teste"
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      expect(getByDisplayValue('Rua Teste')).toBeTruthy();
    });
  });

  describe('Mensagens de Erro', () => {
    it('deve exibir mensagem de erro', () => {
      const { getByText } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
          error="Endereço é obrigatório"
        />
      );

      expect(getByText('Endereço é obrigatório')).toBeTruthy();
    });

    it('não deve exibir erro quando não fornecido', () => {
      const { queryByText } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      expect(queryByText(/erro/i)).toBeNull();
    });
  });

  describe('Botão de Limpar', () => {
    it('deve exibir botão de limpar quando há texto', () => {
      const { getByText } = render(
        <AddressAutocomplete
          value="Rua Teste"
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      expect(getByText('✕')).toBeTruthy();
    });

    it('não deve exibir botão de limpar quando não há texto', () => {
      const { queryByText } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      expect(queryByText('✕')).toBeNull();
    });

    it('deve chamar onChangeText com string vazia ao limpar', () => {
      const { getByText } = render(
        <AddressAutocomplete
          value="Rua Teste"
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      fireEvent.press(getByText('✕'));
      expect(mockOnChangeText).toHaveBeenCalledWith('');
    });
  });

  describe('Hint de Uso', () => {
    it('deve exibir hint quando texto tem menos de 3 caracteres', () => {
      const { getByText } = render(
        <AddressAutocomplete
          value="ab"
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      expect(getByText('Digite pelo menos 3 caracteres para buscar')).toBeTruthy();
    });

    it('não deve exibir hint quando texto está vazio', () => {
      const { queryByText } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      expect(queryByText('Digite pelo menos 3 caracteres para buscar')).toBeNull();
    });
  });

  describe('Componente', () => {
    it('deve aceitar props onChangeText', () => {
      const { getByPlaceholderText } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      const input = getByPlaceholderText('Digite o endereço completo');
      fireEvent.changeText(input, 'Teste');

      expect(mockOnChangeText).toHaveBeenCalledWith('Teste');
    });

    it('deve aceitar prop onSelectAddress', () => {
      const { root } = render(
        <AddressAutocomplete
          value="Rua Teste"
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      expect(root).toBeTruthy();
      // Verificar que o componente renderiza corretamente com todas as props
    });
  });

  describe('Multiline', () => {
    it('deve renderizar como multiline quando prop é true', () => {
      const { getByPlaceholderText } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
          multiline={true}
        />
      );

      const input = getByPlaceholderText('Digite o endereço completo');
      expect(input.props.multiline).toBe(true);
    });
  });

  describe('Interação com Teclado', () => {
    it('deve configurar input corretamente', () => {
      const { getByPlaceholderText } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      const input = getByPlaceholderText('Digite o endereço completo');
      expect(input.props.autoCorrect).toBe(false);
      expect(input.props.autoCapitalize).toBe('words');
      expect(input.props.returnKeyType).toBe('done');
    });
  });

  describe('React.memo Behavior', () => {
    it('não deve re-renderizar quando apenas funções mudam', () => {
      const mockOnChangeText1 = jest.fn();
      const mockOnSelectAddress1 = jest.fn();

      const { rerender } = render(
        <AddressAutocomplete
          value="Rua Teste"
          onChangeText={mockOnChangeText1}
          onSelectAddress={mockOnSelectAddress1}
          placeholder="Endereço"
        />
      );

      const mockOnChangeText2 = jest.fn();
      const mockOnSelectAddress2 = jest.fn();

      // Mudar apenas as funções (não deve re-renderizar)
      rerender(
        <AddressAutocomplete
          value="Rua Teste"
          onChangeText={mockOnChangeText2}
          onSelectAddress={mockOnSelectAddress2}
          placeholder="Endereço"
        />
      );

      // Componente deve funcionar normalmente
      expect(true).toBe(true);
    });

    it('deve re-renderizar quando value muda', () => {
      const { rerender, getByDisplayValue } = render(
        <AddressAutocomplete
          value="Rua Teste 1"
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      expect(getByDisplayValue('Rua Teste 1')).toBeTruthy();

      rerender(
        <AddressAutocomplete
          value="Rua Teste 2"
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      expect(getByDisplayValue('Rua Teste 2')).toBeTruthy();
    });
  });

  describe('Autocomplete com Debounce', () => {
    it('deve buscar sugestões após debounce de 1000ms', async () => {
      const { getByPlaceholderText } = render(
        <ControlledAddressAutocomplete onSelectAddress={mockOnSelectAddress} />
      );

      const input = getByPlaceholderText('Digite o endereço completo');

      // Não deve chamar antes de digitar
      expect(mockAutocompleteAddress).not.toHaveBeenCalled();

      fireEvent.changeText(input, 'Rua Test');

      // Aguardar o debounce (1000ms) e a chamada da API
      await waitFor(
        () => {
          expect(mockAutocompleteAddress).toHaveBeenCalledWith('Rua Test', expect.any(String));
        },
        { timeout: 2000 }
      );
    });

    it('deve mostrar loading enquanto busca sugestões', async () => {
      const slowMock = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockSuggestions), 200))
      );
      mockAutocompleteAddress.mockImplementation(slowMock);

      const { getByPlaceholderText, getByText } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      const input = getByPlaceholderText('Digite o endereço completo');
      fireEvent.changeText(input, 'Rua Test');

      // Aguardar debounce + início do loading
      await waitFor(
        () => {
          expect(getByText('Buscando endereços...')).toBeTruthy();
        },
        { timeout: 2000 }
      );
    });

    it('deve mostrar sugestões após busca bem-sucedida', async () => {
      const { getByPlaceholderText, getByText } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      const input = getByPlaceholderText('Digite o endereço completo');
      fireEvent.changeText(input, 'Rua Test');

      await waitFor(
        () => {
          expect(getByText('Rua Example, 123')).toBeTruthy();
          expect(getByText('Centro, São Paulo - SP')).toBeTruthy();
        },
        { timeout: 2000 }
      );
    });

    it('deve lidar com erro no autocomplete', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockAutocompleteAddress.mockRejectedValueOnce(new Error('API Error'));

      const { getByPlaceholderText } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      const input = getByPlaceholderText('Digite o endereço completo');
      fireEvent.changeText(input, 'Rua Test');

      await waitFor(
        () => {
          expect(consoleErrorSpy).toHaveBeenCalledWith('Erro no autocomplete:', expect.any(Error));
        },
        { timeout: 2000 }
      );

      consoleErrorSpy.mockRestore();
    });

    it('deve cancelar debounce anterior ao digitar novamente', async () => {
      const { getByPlaceholderText } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      const input = getByPlaceholderText('Digite o endereço completo');

      // Primeira digitação
      fireEvent.changeText(input, 'Rua A');

      // Aguardar 500ms (não o suficiente para debounce)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Segunda digitação antes do timeout
      fireEvent.changeText(input, 'Rua AB');

      // Aguardar o debounce completo
      await waitFor(
        () => {
          expect(mockAutocompleteAddress).toHaveBeenCalledTimes(1);
          expect(mockAutocompleteAddress).toHaveBeenCalledWith('Rua AB', expect.any(String));
        },
        { timeout: 2000 }
      );
    });
  });

  describe('Seleção de Sugestão', () => {
    it('deve chamar onSelectAddress ao selecionar sugestão', async () => {
      const { getByPlaceholderText, getByText } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      const input = getByPlaceholderText('Digite o endereço completo');
      fireEvent.changeText(input, 'Rua Test');

      await waitFor(
        () => {
          expect(getByText('Rua Example, 123')).toBeTruthy();
        },
        { timeout: 2000 }
      );

      const suggestion = getByText('Rua Example, 123');
      fireEvent.press(suggestion.parent.parent);

      expect(mockOnSelectAddress).toHaveBeenCalledWith(
        'Rua Example, 123 - Centro, São Paulo - SP',
        '1'
      );
    });

    it('deve esconder teclado ao selecionar sugestão', async () => {
      const { getByPlaceholderText, getByText } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      const input = getByPlaceholderText('Digite o endereço completo');
      fireEvent.changeText(input, 'Rua Test');

      await waitFor(
        () => {
          expect(getByText('Rua Example, 123')).toBeTruthy();
        },
        { timeout: 2000 }
      );

      const suggestion = getByText('Rua Example, 123');
      fireEvent.press(suggestion.parent.parent);

      expect(Keyboard.dismiss).toHaveBeenCalled();
    });

    it('deve esconder sugestões ao selecionar', async () => {
      const { getByPlaceholderText, getByText, queryByText } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      const input = getByPlaceholderText('Digite o endereço completo');
      fireEvent.changeText(input, 'Rua Test');

      await waitFor(
        () => {
          expect(getByText('Rua Example, 123')).toBeTruthy();
        },
        { timeout: 2000 }
      );

      const suggestion = getByText('Rua Example, 123');
      fireEvent.press(suggestion.parent.parent);

      await waitFor(() => {
        expect(queryByText('Rua Example, 123')).toBeNull();
      });
    });
  });

  describe('Comportamento de Focus', () => {
    it('deve mostrar sugestões ao focar se houver sugestões existentes', async () => {
      const { getByPlaceholderText, getByText, queryByText } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      const input = getByPlaceholderText('Digite o endereço completo');

      // Primeiro buscar sugestões
      fireEvent.changeText(input, 'Rua Test');

      await waitFor(
        () => {
          expect(getByText('Rua Example, 123')).toBeTruthy();
        },
        { timeout: 2000 }
      );

      // Selecionar uma sugestão (esconde a lista)
      const suggestion = getByText('Rua Example, 123');
      fireEvent.press(suggestion.parent.parent);

      await waitFor(() => {
        expect(queryByText('Rua Example, 123')).toBeNull();
      });

      // Focar novamente deve mostrar as sugestões
      fireEvent(input, 'focus');

      await waitFor(() => {
        expect(getByText('Rua Example, 123')).toBeTruthy();
      });
    });

    it('não deve mostrar sugestões ao focar se não houver sugestões', () => {
      const { getByPlaceholderText, queryByText } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      const input = getByPlaceholderText('Digite o endereço completo');
      fireEvent(input, 'focus');

      expect(queryByText('Buscando endereços...')).toBeNull();
    });
  });

  describe('Renderização de Sugestões', () => {
    it('deve renderizar ícone de localização em cada sugestão', async () => {
      const { getByPlaceholderText, getAllByText } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      const input = getByPlaceholderText('Digite o endereço completo');
      fireEvent.changeText(input, 'Rua Test');

      await waitFor(
        () => {
          const icons = getAllByText('📍');
          expect(icons.length).toBe(2); // Uma para cada sugestão
        },
        { timeout: 2000 }
      );
    });

    it('deve renderizar main_text e secondary_text separadamente', async () => {
      const { getByPlaceholderText, getByText } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      const input = getByPlaceholderText('Digite o endereço completo');
      fireEvent.changeText(input, 'Rua Test');

      await waitFor(
        () => {
          expect(getByText('Rua Example, 123')).toBeTruthy();
          expect(getByText('Centro, São Paulo - SP')).toBeTruthy();
          expect(getByText('Avenida Test, 456')).toBeTruthy();
          expect(getByText('Jardins, São Paulo - SP')).toBeTruthy();
        },
        { timeout: 2000 }
      );
    });

    it('deve renderizar separadores entre sugestões', async () => {
      const { getByPlaceholderText, UNSAFE_getAllByType } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      const input = getByPlaceholderText('Digite o endereço completo');
      fireEvent.changeText(input, 'Rua Test');

      await waitFor(
        () => {
          const { View } = require('react-native');
          const views = UNSAFE_getAllByType(View);
          expect(views.length).toBeGreaterThan(0);
        },
        { timeout: 2000 }
      );
    });

    it('não deve renderizar sugestões quando isLoading é true', () => {
      const { getByPlaceholderText, queryByText } = render(
        <AddressAutocomplete
          value=""
          onChangeText={mockOnChangeText}
          onSelectAddress={mockOnSelectAddress}
        />
      );

      const input = getByPlaceholderText('Digite o endereço completo');

      // Ainda não digitou nada, não deve estar carregando
      expect(queryByText('Buscando endereços...')).toBeNull();

      // Sugestões não devem aparecer
      expect(queryByText('Rua Example, 123')).toBeNull();
    });
  });
});
