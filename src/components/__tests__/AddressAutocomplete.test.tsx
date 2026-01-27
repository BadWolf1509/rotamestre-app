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
    expect(getByPlaceholderText('Digite o endereco completo')).toBeTruthy();
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

    const input = getByPlaceholderText('Digite o endereco completo');

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

    const input = getByPlaceholderText('Digite o endereco completo');
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

    const input = getByPlaceholderText('Digite o endereco completo');

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
});
