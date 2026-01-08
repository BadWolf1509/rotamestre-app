/**
 * Tests for EditStopModal.tsx
 * Modal para editar uma parada existente
 */

import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { EditStopModal, EditStopModalProps } from '../EditStopModal';

// Mock dependencies
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const mockGetPlaceDetails = jest.fn();
const mockGeocodeAddress = jest.fn();

jest.mock('@/lib/google', () => ({
  googleMapsService: {
    getPlaceDetails: (...args: unknown[]) => mockGetPlaceDetails(...args),
    geocodeAddress: (...args: unknown[]) => mockGeocodeAddress(...args),
  },
}));

const mockRecalcularRota = jest.fn();
const mockNotificarMotorista = jest.fn();

jest.mock('@/lib/routeUtils', () => ({
  recalcularRota: (...args: unknown[]) => mockRecalcularRota(...args),
  notificarMotoristaRotaEditada: (...args: unknown[]) => mockNotificarMotorista(...args),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isDesktop: false,
    isMobile: true,
    isTablet: false,
    width: 375,
  }),
}));

jest.mock('@/lib/phone', () => ({
  maskPhone: (text: string) => text.replace(/\D/g, '').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3'),
}));

// Mock theme
// Mock AddressAutocomplete
jest.mock('@/components/AddressAutocomplete', () => ({
  AddressAutocomplete: ({ value, onChangeText, onSelectAddress, placeholder }: {
    value: string;
    onChangeText: (text: string) => void;
    onSelectAddress: (address: string, placeId: string) => void;
    placeholder: string;
  }) => {
    const { TextInput, TouchableOpacity, Text, View } = require('react-native');
    return (
      <View testID="address-autocomplete">
        <TextInput
          testID="address-input"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
        />
        <TouchableOpacity
          testID="address-suggestion"
          onPress={() => onSelectAddress('Rua Nova, 456', 'place_id_456')}
        >
          <Text>Rua Nova, 456</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

// Mock DesktopModal with declarative button API
jest.mock('@/components/desktop/DesktopModal', () => ({
  DesktopModal: ({ visible, onClose, title, children, primaryButton, secondaryButton }: {
    visible: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    primaryButton?: { text: string; onPress: () => void; loading?: boolean; disabled?: boolean };
    secondaryButton?: { text: string; onPress: () => void; disabled?: boolean };
  }) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    if (!visible) return null;
    return (
      <View testID="desktop-modal">
        <Text testID="modal-title">{title}</Text>
        <TouchableOpacity testID="close-button" onPress={onClose}>
          <Text>X</Text>
        </TouchableOpacity>
        {children}
        <View testID="modal-footer">
          {secondaryButton && (
            <TouchableOpacity
              onPress={secondaryButton.onPress}
              disabled={secondaryButton.disabled}
              testID="secondary-button"
            >
              <Text>{secondaryButton.text}</Text>
            </TouchableOpacity>
          )}
          {primaryButton && (
            <TouchableOpacity
              onPress={primaryButton.onPress}
              disabled={primaryButton.disabled || primaryButton.loading}
              testID="primary-button"
            >
              <Text>{primaryButton.text}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  },
}));

// Mock DesktopFormGrid
jest.mock('@/components/desktop/DesktopFormGrid', () => ({
  DesktopFormGrid: ({ children }: { children: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View testID="form-grid">{children}</View>;
  },
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text testID={`icon-${name}`}>{name}</Text>;
  },
}));

describe('EditStopModal', () => {
  const mockParada = {
    id: 'parada-123',
    ordem: 1,
    latitude: -23.56,
    longitude: -46.64,
    endereco: 'Rua Antiga, 100',
    destinatario: 'João Silva',
    telefone: '(11) 99999-8888',
    observacoes: 'Obs original',
    tipo: 'entrega' as const,
    is_checkpoint: true,
    status: 'pendente' as const,
  };

  const defaultProps: EditStopModalProps = {
    visible: true,
    parada: mockParada,
    rotaId: 'rota-123',
    enderecoUnidade: { latitude: -23.55, longitude: -46.63 },
    allParadas: [mockParada],
    onSave: jest.fn(),
    onCancel: jest.fn(),
    usuarioId: 'user-123',
    motoristaId: 'motorista-456',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Renderização', () => {
    it('deve renderizar o modal quando visible=true', () => {
      const { getByTestId, getByText } = render(<EditStopModal {...defaultProps} />);

      expect(getByTestId('desktop-modal')).toBeTruthy();
      expect(getByText('Editar Parada')).toBeTruthy();
    });

    it('não deve renderizar quando visible=false', () => {
      const { queryByTestId } = render(<EditStopModal {...defaultProps} visible={false} />);

      expect(queryByTestId('desktop-modal')).toBeNull();
    });

    it('não deve renderizar quando parada é null', () => {
      const { queryByTestId } = render(<EditStopModal {...defaultProps} parada={null} />);

      expect(queryByTestId('desktop-modal')).toBeNull();
    });

    it('deve preencher formulário com dados da parada', () => {
      const { getByTestId, getByText } = render(<EditStopModal {...defaultProps} />);

      const addressInput = getByTestId('address-input');
      expect(addressInput.props.value).toBe('Rua Antiga, 100');
      expect(getByText('Destinatário')).toBeTruthy();
      expect(getByText('Telefone')).toBeTruthy();
    });
  });

  describe('Interações', () => {
    it('deve alternar tipo para retirada', async () => {
      const { getByText } = render(<EditStopModal {...defaultProps} />);

      fireEvent.press(getByText('Retirada'));

      await waitFor(() => {
        const retiradaText = getByText('Retirada');
        const style = Array.isArray(retiradaText.props.style)
          ? retiradaText.props.style.filter(Boolean)
          : [retiradaText.props.style];
        const merged = Object.assign({}, ...style);
        expect(merged.color).toBe('#ffffff');
      });
    });

    it('deve chamar onCancel quando botão Cancelar é pressionado', () => {
      const { getByText } = render(<EditStopModal {...defaultProps} />);

      fireEvent.press(getByText('Cancelar'));

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('deve exibir nota quando endereço é alterado', async () => {
      mockGetPlaceDetails.mockResolvedValue({
        coordenadas: { latitude: -23.58, longitude: -46.66 },
      });

      const { getByTestId, getByText } = render(<EditStopModal {...defaultProps} />);

      // Selecionar novo endereço
      fireEvent.press(getByTestId('address-suggestion'));

      await waitFor(() => {
        expect(getByText(/rota será recalculada/i)).toBeTruthy();
      });
    });
  });

  describe('Salvamento', () => {
    beforeEach(() => {
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      });
      mockRecalcularRota.mockResolvedValue({ success: true });
      mockNotificarMotorista.mockResolvedValue({ success: true });
    });

    it('deve salvar alterações com sucesso', async () => {
      const { getByText } = render(<EditStopModal {...defaultProps} />);

      fireEvent.press(getByText('Salvar'));

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('paradas');
      });

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalled();
      });
    });

    it('deve recalcular rota quando endereço muda', async () => {
      mockGetPlaceDetails.mockResolvedValue({
        coordenadas: { latitude: -23.58, longitude: -46.66 },
      });

      const { getByTestId, getByText } = render(<EditStopModal {...defaultProps} />);

      // Alterar endereço
      fireEvent.press(getByTestId('address-suggestion'));
      await waitFor(() => expect(mockGetPlaceDetails).toHaveBeenCalled());

      // Salvar
      fireEvent.press(getByText('Salvar'));

      await waitFor(() => {
        expect(mockRecalcularRota).toHaveBeenCalled();
      });
    });

    it('deve usar geocoding se não tem coordenadas após alteração de endereço', async () => {
      // Parada sem coordenadas originais
      const paradaSemCoordenadas = {
        ...mockParada,
        latitude: null as unknown as number,
        longitude: null as unknown as number,
      };

      mockGeocodeAddress.mockResolvedValue({
        coordenadas: { latitude: -23.59, longitude: -46.67 },
      });

      const { getByTestId, getByText } = render(
        <EditStopModal {...defaultProps} parada={paradaSemCoordenadas} />
      );

      // Alterar endereço manualmente
      fireEvent.changeText(getByTestId('address-input'), 'Endereço Novo Manual');
      fireEvent.press(getByText('Salvar'));

      await waitFor(() => {
        expect(mockGeocodeAddress).toHaveBeenCalledWith('Endereço Novo Manual');
      });
    });

    it('deve notificar motorista sobre edição', async () => {
      const { getByText } = render(<EditStopModal {...defaultProps} />);

      fireEvent.press(getByText('Salvar'));

      await waitFor(() => {
        expect(mockNotificarMotorista).toHaveBeenCalledWith(expect.objectContaining({
          rotaId: 'rota-123',
          motoristaId: 'motorista-456',
          tipo: 'rota_parada_editada',
        }));
      });
    });

    it('deve registrar log de edição', async () => {
      const { getByText } = render(<EditStopModal {...defaultProps} />);

      fireEvent.press(getByText('Salvar'));

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('logs');
      });
    });

    it('não deve notificar se motoristaId não está definido', async () => {
      const propsWithoutMotorista = { ...defaultProps, motoristaId: undefined };

      const { getByText } = render(<EditStopModal {...propsWithoutMotorista} />);

      fireEvent.press(getByText('Salvar'));

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalled();
      });

      expect(mockNotificarMotorista).not.toHaveBeenCalled();
    });

    it('não deve registrar log se usuarioId não está definido', async () => {
      const propsWithoutUser = { ...defaultProps, usuarioId: undefined };

      const { getByText } = render(<EditStopModal {...propsWithoutUser} />);

      fireEvent.press(getByText('Salvar'));

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalled();
      });

      // Verificar que 'logs' não foi chamado
      const logsCalls = mockFrom.mock.calls.filter((call) => call[0] === 'logs');
      expect(logsCalls.length).toBe(0);
    });

    it('deve lidar com erro ao salvar', async () => {
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } }),
        }),
      });

      const { getByText } = render(<EditStopModal {...defaultProps} />);

      fireEvent.press(getByText('Salvar'));

      await waitFor(() => {
        // Deve chamar console.error
        expect(console.error).toHaveBeenCalled();
      });
    });
  });

  describe('Inicialização do formulário', () => {
    it('deve reinicializar formulário quando parada muda', () => {
      const { rerender, getByTestId } = render(<EditStopModal {...defaultProps} />);

      const newParada = {
        ...mockParada,
        id: 'parada-456',
        endereco: 'Rua Diferente, 999',
      };

      rerender(<EditStopModal {...defaultProps} parada={newParada} />);

      const input = getByTestId('address-input');
      expect(input.props.value).toBe('Rua Diferente, 999');
    });
  });
});
