import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import React, { useState } from 'react';

import { photonService } from '@/lib/photon';

import { AddressAutocomplete } from '../AddressAutocomplete';

// Mock do photonService (migrado de Google para Photon)
jest.mock('@/lib/photon', () => ({
  photonService: {
    autocompleteAddress: jest.fn(),
  },
}));

// Mock do useUnistyles com tema completo inline (jest.mock é hoisted)
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      surface: '#ffffff',
      text: '#000000',
      textSecondary: '#666666',
      border: '#cccccc',
      primary: '#0000ff',
      error: '#ff0000',
      errorLight: '#ffcccc',
      disabled: '#eeeeee',
      gray400: '#9ca3af',
      black: '#000000',
    },
    typography: {
      fontSans: 'NunitoSans-Regular',
      fontSansSemiBold: 'NunitoSans-SemiBold',
      xs: 12,
      sm: 14,
      base: 16,
      xl: 20,
    },
    desktop: {
      input: {
        fontSize: 14,
        height: 36,
      },
    },
    borderRadius: {
      sm: 8,
      md: 12,
      full: 9999,
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    },
    components: {
      input: {
        size: {
          medium: {
            fontSize: 14,
            height: 40,
            paddingHorizontal: 12,
          },
        },
        radius: 6,
      },
    },
  };

  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (stylesFn: (t: typeof theme) => Record<string, unknown>) => stylesFn(theme),
    },
  };
});

// Wrapper para gerenciar estado
const TestWrapper = ({ onSelectAddress = () => { } }) => {
  const [value, setValue] = useState('');
  return (
    <AddressAutocomplete
      value={value}
      onChangeText={setValue}
      onSelectAddress={onSelectAddress}
    />
  );
};

describe('AddressAutocomplete', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('deve renderizar corretamente', () => {
    const { getByPlaceholderText } = render(<TestWrapper />);
    expect(getByPlaceholderText('Digite o endereço completo')).toBeTruthy();
  });

  it('deve buscar endereços após debounce', async () => {
    // Mock Photon retorna coordenadas diretamente (diferente do Google)
    const mockSuggestions = [
      {
        place_id: 'osm_N123456',
        description: 'Rua Teste, 123',
        structured_formatting: {
          main_text: 'Rua Teste',
          secondary_text: '123, Cidade',
        },
        coordinates: {
          latitude: -23.5505,
          longitude: -46.6333,
        },
      },
    ];

    (photonService.autocompleteAddress as jest.Mock).mockResolvedValue(mockSuggestions);

    const { getByPlaceholderText, getByText, queryByText } = render(<TestWrapper />);

    const input = getByPlaceholderText('Digite o endereço completo');

    // Focar no input para habilitar busca (necessário após fix de busca inicial)
    fireEvent(input, 'focus');

    // Digitar texto - O Wrapper vai atualizar o estado value
    fireEvent.changeText(input, 'Rua Teste');

    // Verificar que loading não aparece imediatamente
    expect(queryByText('Buscando endereços...')).toBeNull();

    // Avançar tempo para disparar debounce (1000ms)
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    // Verificar chamada API (Photon não usa sessionToken)
    await waitFor(() => {
      expect(photonService.autocompleteAddress).toHaveBeenCalledWith('Rua Teste');
    });

    // Verificar se sugestões apareceram
    await waitFor(() => {
      expect(getByText('Rua Teste')).toBeTruthy();
      expect(getByText('123, Cidade')).toBeTruthy();
    });
  });

  it('deve selecionar um endereço e esconder sugestões', async () => {
    // Mock Photon retorna coordenadas diretamente
    const mockSuggestions = [
      {
        place_id: 'osm_N123456',
        description: 'Rua Teste, 123',
        structured_formatting: {
          main_text: 'Rua Teste',
          secondary_text: '123, Cidade',
        },
        coordinates: {
          latitude: -23.5505,
          longitude: -46.6333,
        },
      },
    ];

    (photonService.autocompleteAddress as jest.Mock).mockResolvedValue(mockSuggestions);
    const onSelectAddress = jest.fn();

    // Criar wrapper com callback
    const TestWrapperWithCallback = () => {
      const [value, setValue] = useState('');
      return (
        <AddressAutocomplete
          value={value}
          onChangeText={setValue}
          onSelectAddress={(desc, id, coords) => {
            onSelectAddress(desc, id, coords);
            setValue(desc);
          }}
        />
      );
    };

    const { getByPlaceholderText, getByText, getAllByTestId, queryByTestId, UNSAFE_getAllByType } = render(<TestWrapperWithCallback />);

    const input = getByPlaceholderText('Digite o endereço completo');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, 'Rua Teste');

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(getByText('Rua Teste')).toBeTruthy();
    });

    const suggestions = getAllByTestId('suggestion-item');
    expect(suggestions.length).toBeGreaterThan(0);

    const { TouchableOpacity } = require('react-native');
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    const suggestion = touchables.find((node: any) => node.props.testID === 'suggestion-item');
    expect(suggestion).toBeTruthy();

    act(() => {
      suggestion!.props.onPress();
    });

    await waitFor(() => {
      expect(queryByTestId('suggestion-item')).toBeNull();
    }, { timeout: 2000 });

    // Photon retorna coordenadas diretamente no callback
    expect(onSelectAddress).toHaveBeenCalledWith(
      'Rua Teste, 123',
      'osm_N123456',
      { latitude: -23.5505, longitude: -46.6333 }
    );
  });

  it('deve mostrar mensagem quando não encontrar resultados', async () => {
    (photonService.autocompleteAddress as jest.Mock).mockResolvedValue([]);

    const { getByPlaceholderText, getByText } = render(<TestWrapper />);

    const input = getByPlaceholderText('Digite o endereço completo');

    // Focar no input para habilitar busca (necessário após fix de busca inicial)
    fireEvent(input, 'focus');

    fireEvent.changeText(input, 'Endereco Inexistente');

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(getByText('Nenhum endereço encontrado. Tente ser mais específico.')).toBeTruthy();
    });
  });

  describe('Extração de número', () => {
    it('deve preservar número digitado após vírgula', async () => {
      const mockSuggestions = [
        {
          place_id: 'osm_N123456',
          description: 'Rua Teste, Centro, Cidade',
          structured_formatting: {
            main_text: 'Rua Teste',
            secondary_text: 'Centro, Cidade',
          },
          coordinates: { latitude: -23.5505, longitude: -46.6333 },
        },
      ];

      (photonService.autocompleteAddress as jest.Mock).mockResolvedValue(mockSuggestions);
      const onSelectAddress = jest.fn();

      const TestWrapperWithNumber = () => {
        const [value, setValue] = useState('');
        return (
          <AddressAutocomplete
            value={value}
            onChangeText={setValue}
            onSelectAddress={(desc, id, coords) => {
              onSelectAddress(desc, id, coords);
              setValue(desc);
            }}
          />
        );
      };

      const { getByPlaceholderText, getAllByTestId, UNSAFE_getAllByType } = render(<TestWrapperWithNumber />);

      const input = getByPlaceholderText('Digite o endereço completo');
      fireEvent(input, 'focus');
      fireEvent.changeText(input, 'Rua Teste, 430');

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(getAllByTestId('suggestion-item').length).toBeGreaterThan(0);
      });

      const { TouchableOpacity } = require('react-native');
      const touchables = UNSAFE_getAllByType(TouchableOpacity);
      const suggestion = touchables.find((node: any) => node.props.testID === 'suggestion-item');

      act(() => {
        suggestion!.props.onPress();
      });

      await waitFor(() => {
        expect(onSelectAddress).toHaveBeenCalledWith(
          'Rua Teste, 430, Centro, Cidade',
          'osm_N123456',
          expect.any(Object)
        );
      });
    });

    it('deve preservar número com letra (ex: 430A)', async () => {
      const mockSuggestions = [
        {
          place_id: 'osm_N123456',
          description: 'Rua Maria, Centro',
          structured_formatting: {
            main_text: 'Rua Maria',
            secondary_text: 'Centro',
          },
          coordinates: { latitude: -23.5505, longitude: -46.6333 },
        },
      ];

      (photonService.autocompleteAddress as jest.Mock).mockResolvedValue(mockSuggestions);
      const onSelectAddress = jest.fn();

      const TestWrapperWithNumber = () => {
        const [value, setValue] = useState('');
        return (
          <AddressAutocomplete
            value={value}
            onChangeText={setValue}
            onSelectAddress={(desc, id, coords) => {
              onSelectAddress(desc, id, coords);
              setValue(desc);
            }}
          />
        );
      };

      const { getByPlaceholderText, getAllByTestId, UNSAFE_getAllByType } = render(<TestWrapperWithNumber />);

      const input = getByPlaceholderText('Digite o endereço completo');
      fireEvent(input, 'focus');
      fireEvent.changeText(input, 'Rua Maria 430A');

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(getAllByTestId('suggestion-item').length).toBeGreaterThan(0);
      });

      const { TouchableOpacity } = require('react-native');
      const touchables = UNSAFE_getAllByType(TouchableOpacity);
      const suggestion = touchables.find((node: any) => node.props.testID === 'suggestion-item');

      act(() => {
        suggestion!.props.onPress();
      });

      await waitFor(() => {
        expect(onSelectAddress).toHaveBeenCalledWith(
          'Rua Maria, 430A, Centro',
          'osm_N123456',
          expect.any(Object)
        );
      });
    });

    it('deve preservar número com hífen (ex: 430-B)', async () => {
      const mockSuggestions = [
        {
          place_id: 'osm_N123456',
          description: 'Rua José, Bairro',
          structured_formatting: {
            main_text: 'Rua José',
            secondary_text: 'Bairro',
          },
          coordinates: { latitude: -23.5505, longitude: -46.6333 },
        },
      ];

      (photonService.autocompleteAddress as jest.Mock).mockResolvedValue(mockSuggestions);
      const onSelectAddress = jest.fn();

      const TestWrapperWithNumber = () => {
        const [value, setValue] = useState('');
        return (
          <AddressAutocomplete
            value={value}
            onChangeText={setValue}
            onSelectAddress={(desc, id, coords) => {
              onSelectAddress(desc, id, coords);
              setValue(desc);
            }}
          />
        );
      };

      const { getByPlaceholderText, getAllByTestId, UNSAFE_getAllByType } = render(<TestWrapperWithNumber />);

      const input = getByPlaceholderText('Digite o endereço completo');
      fireEvent(input, 'focus');
      fireEvent.changeText(input, 'Rua José 430-B');

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(getAllByTestId('suggestion-item').length).toBeGreaterThan(0);
      });

      const { TouchableOpacity } = require('react-native');
      const touchables = UNSAFE_getAllByType(TouchableOpacity);
      const suggestion = touchables.find((node: any) => node.props.testID === 'suggestion-item');

      act(() => {
        suggestion!.props.onPress();
      });

      await waitFor(() => {
        expect(onSelectAddress).toHaveBeenCalledWith(
          'Rua José, 430-B, Bairro',
          'osm_N123456',
          expect.any(Object)
        );
      });
    });

    it('não deve duplicar número se sugestão já contém número', async () => {
      const mockSuggestions = [
        {
          place_id: 'osm_N123456',
          description: 'Rua Teste, 100, Centro',
          structured_formatting: {
            main_text: 'Rua Teste, 100',
            secondary_text: 'Centro',
          },
          coordinates: { latitude: -23.5505, longitude: -46.6333 },
        },
      ];

      (photonService.autocompleteAddress as jest.Mock).mockResolvedValue(mockSuggestions);
      const onSelectAddress = jest.fn();

      const TestWrapperWithNumber = () => {
        const [value, setValue] = useState('');
        return (
          <AddressAutocomplete
            value={value}
            onChangeText={setValue}
            onSelectAddress={(desc, id, coords) => {
              onSelectAddress(desc, id, coords);
              setValue(desc);
            }}
          />
        );
      };

      const { getByPlaceholderText, getAllByTestId, UNSAFE_getAllByType } = render(<TestWrapperWithNumber />);

      const input = getByPlaceholderText('Digite o endereço completo');
      fireEvent(input, 'focus');
      fireEvent.changeText(input, 'Rua Teste 430');

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(getAllByTestId('suggestion-item').length).toBeGreaterThan(0);
      });

      const { TouchableOpacity } = require('react-native');
      const touchables = UNSAFE_getAllByType(TouchableOpacity);
      const suggestion = touchables.find((node: any) => node.props.testID === 'suggestion-item');

      act(() => {
        suggestion!.props.onPress();
      });

      await waitFor(() => {
        // Deve manter o número original da sugestão, não adicionar o digitado
        expect(onSelectAddress).toHaveBeenCalledWith(
          'Rua Teste, 100, Centro',
          'osm_N123456',
          expect.any(Object)
        );
      });
    });
  });

  describe('Botão limpar', () => {
    it('deve limpar o input ao pressionar o botão X', async () => {
      const TestWrapperWithClear = () => {
        const [value, setValue] = useState('Rua Teste 123');
        return (
          <AddressAutocomplete
            value={value}
            onChangeText={setValue}
            onSelectAddress={() => {}}
          />
        );
      };

      const { UNSAFE_getAllByType, getByPlaceholderText } = render(<TestWrapperWithClear />);

      // Verificar que o input tem valor inicial
      const input = getByPlaceholderText('Digite o endereço completo');
      expect(input.props.value).toBe('Rua Teste 123');

      // Encontrar e pressionar o botão limpar
      const { TouchableOpacity } = require('react-native');
      const touchables = UNSAFE_getAllByType(TouchableOpacity);
      const clearButton = touchables.find((node: any) =>
        node.props.accessibilityLabel === 'Limpar endereço'
      );

      expect(clearButton).toBeTruthy();

      act(() => {
        clearButton!.props.onPress();
      });

      // O estado no TestWrapper será atualizado
      await waitFor(() => {
        const updatedInput = getByPlaceholderText('Digite o endereço completo');
        expect(updatedInput.props.value).toBe('');
      });
    });
  });

  describe('Acessibilidade', () => {
    it('deve ter labels de acessibilidade no input', () => {
      const { getByPlaceholderText } = render(<TestWrapper />);
      const input = getByPlaceholderText('Digite o endereço completo');

      expect(input.props.accessibilityLabel).toBe('Campo de endereço');
      expect(input.props.accessibilityHint).toBe('Digite o endereço para buscar sugestões');
    });

    it('deve ter labels de acessibilidade no botão limpar', () => {
      const TestWrapperWithValue = () => {
        const [value, setValue] = useState('Rua Teste');
        return (
          <AddressAutocomplete
            value={value}
            onChangeText={setValue}
            onSelectAddress={() => {}}
          />
        );
      };

      const { UNSAFE_getAllByType } = render(<TestWrapperWithValue />);

      const { TouchableOpacity } = require('react-native');
      const touchables = UNSAFE_getAllByType(TouchableOpacity);
      const clearButton = touchables.find((node: any) =>
        node.props.accessibilityLabel === 'Limpar endereço'
      );

      expect(clearButton).toBeTruthy();
      expect(clearButton!.props.accessibilityRole).toBe('button');
    });

    it('deve ter labels de acessibilidade nas sugestões', async () => {
      const mockSuggestions = [
        {
          place_id: 'osm_N123456',
          description: 'Rua Teste, Centro',
          structured_formatting: {
            main_text: 'Rua Teste',
            secondary_text: 'Centro',
          },
          coordinates: { latitude: -23.5505, longitude: -46.6333 },
        },
      ];

      (photonService.autocompleteAddress as jest.Mock).mockResolvedValue(mockSuggestions);

      const { getByPlaceholderText, UNSAFE_getAllByType } = render(<TestWrapper />);

      const input = getByPlaceholderText('Digite o endereço completo');
      fireEvent(input, 'focus');
      fireEvent.changeText(input, 'Rua Teste');

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        const { TouchableOpacity } = require('react-native');
        const touchables = UNSAFE_getAllByType(TouchableOpacity);
        const suggestion = touchables.find((node: any) => node.props.testID === 'suggestion-item');

        expect(suggestion).toBeTruthy();
        expect(suggestion!.props.accessibilityRole).toBe('button');
        expect(suggestion!.props.accessibilityLabel).toContain('Selecionar endereço');
        expect(suggestion!.props.accessibilityHint).toBe('Toque para selecionar este endereço');
      });
    });
  });
});
