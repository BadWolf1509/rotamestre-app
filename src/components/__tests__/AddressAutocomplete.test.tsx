import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AddressAutocomplete } from '../AddressAutocomplete';

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
});
