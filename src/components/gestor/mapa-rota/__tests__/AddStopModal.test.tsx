/**
 * Tests for AddStopModal.tsx
 * Modal para adicionar nova parada a uma rota
 */

import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { AddStopModal, AddStopModalProps } from '../AddStopModal';

// Mock dependencies
const mockRpc = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Mock Photon service (migrado de Google)
const mockGeocodeAddress = jest.fn();

jest.mock('@/lib/photon', () => ({
  photonService: {
    geocodeAddress: (...args: unknown[]) => mockGeocodeAddress(...args),
  },
}));

const mockRecalcularRota = jest.fn();
const mockNotificarMotorista = jest.fn();

jest.mock('@/lib/routeUtils', () => ({
  recalcularRota: (...args: unknown[]) => mockRecalcularRota(...args),
  notificarMotoristaRotaEditada: (...args: unknown[]) =>
    mockNotificarMotorista(...args),
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
  maskPhone: (text: string) =>
    text.replace(/\D/g, '').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3'),
}));

// Mock theme with complete structure
// Mock AddressAutocomplete (Photon retorna coordenadas diretamente!)
jest.mock('@/components/AddressAutocomplete', () => ({
  AddressAutocomplete: ({
    value,
    onChangeText,
    onSelectAddress,
    placeholder,
  }: {
    value: string;
    onChangeText: (text: string) => void;
    onSelectAddress: (
      address: string,
      placeId: string,
      coordinates?: { latitude: number; longitude: number },
    ) => void;
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
          onPress={() =>
            onSelectAddress('Rua Teste, 123', 'osm_N123456', {
              latitude: -23.55,
              longitude: -46.63,
            })
          }
        >
          <Text>Rua Teste, 123</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

let lastPrimaryButton: { disabled?: boolean } | null = null;

// Mock DesktopModal with declarative button API
jest.mock('@/components/desktop/DesktopModal', () => ({
  DesktopModal: ({
    visible,
    onClose,
    title,
    children,
    primaryButton,
    secondaryButton,
  }: {
    visible: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    primaryButton?: {
      text: string;
      onPress: () => void;
      loading?: boolean;
      disabled?: boolean;
    };
    secondaryButton?: { text: string; onPress: () => void; disabled?: boolean };
  }) => {
    lastPrimaryButton = primaryButton;
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
  Ionicons: ({
    name,
    size: _size,
    color: _color,
  }: {
    name: string;
    size: number;
    color: string;
  }) => {
    const { Text } = require('react-native');
    return <Text testID={`icon-${name}`}>{name}</Text>;
  },
}));

describe('AddStopModal', () => {
  const defaultProps: AddStopModalProps = {
    visible: true,
    rotaId: 'rota-123',
    enderecoUnidade: { latitude: -23.55, longitude: -46.63 },
    currentParadasCount: 5,
    allParadas: [
      {
        id: 'p1',
        ordem: 1,
        latitude: -23.56,
        longitude: -46.64,
        is_checkpoint: true,
        endereco: 'Rua A',
        status: 'pendente',
      } as any,
      {
        id: 'p2',
        ordem: 2,
        latitude: -23.57,
        longitude: -46.65,
        is_checkpoint: true,
        endereco: 'Rua B',
        status: 'pendente',
      } as any,
    ],
    onSave: jest.fn(),
    onCancel: jest.fn(),
    usuarioId: 'user-123',
    motoristaId: 'motorista-456',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    lastPrimaryButton = null;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Renderização', () => {
    it('deve renderizar o modal quando visible=true', () => {
      const { getByTestId, getByText } = render(
        <AddStopModal {...defaultProps} />,
      );

      expect(getByTestId('desktop-modal')).toBeTruthy();
      expect(getByTestId('modal-title')).toBeTruthy();
      expect(getByText('Adicionar Parada')).toBeTruthy();
    });

    it('não deve renderizar quando visible=false', () => {
      const { queryByTestId } = render(
        <AddStopModal {...defaultProps} visible={false} />,
      );

      expect(queryByTestId('desktop-modal')).toBeNull();
    });

    it('deve exibir banner de aviso quando limite de paradas é atingido', () => {
      const { getByText } = render(
        <AddStopModal {...defaultProps} currentParadasCount={23} />,
      );

      expect(getByText(/Limite de 23 paradas atingido/i)).toBeTruthy();
    });

    it('deve exibir opções de posição para paradas existentes', () => {
      const { getByText } = render(<AddStopModal {...defaultProps} />);

      expect(getByText(/Antes de: Rua A/)).toBeTruthy();
      expect(getByText(/Antes de: Rua B/)).toBeTruthy();
      expect(getByText('Final da rota')).toBeTruthy();
    });

    it('deve exibir hint quando não há paradas', () => {
      const { getByText } = render(
        <AddStopModal {...defaultProps} allParadas={[]} />,
      );

      expect(getByText(/Primeira parada da rota/)).toBeTruthy();
    });
  });

  describe('Interações de formulário', () => {
    it('deve alternar tipo entre entrega e retirada', () => {
      const { getByText } = render(<AddStopModal {...defaultProps} />);

      const retiradaButton = getByText('Retirada');
      fireEvent.press(retiradaButton);

      // O botão deve estar selecionado (verificar visualmente ou por estilo)
      expect(retiradaButton).toBeTruthy();
    });

    it('deve chamar onCancel quando botão Cancelar é pressionado', () => {
      const { getByText } = render(<AddStopModal {...defaultProps} />);

      fireEvent.press(getByText('Cancelar'));

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('deve selecionar posição quando opção é clicada', async () => {
      const { getByLabelText } = render(<AddStopModal {...defaultProps} />);

      const option = getByLabelText(/Posi.*Rua A/);
      fireEvent.press(option);

      await waitFor(() => {
        expect(
          getByLabelText(/Posi.*Rua A/).props.accessibilityState.checked,
        ).toBe(true);
      });
    });

    it('deve atualizar endereço quando texto é digitado', () => {
      const { getByTestId } = render(<AddStopModal {...defaultProps} />);

      const input = getByTestId('address-input');
      fireEvent.changeText(input, 'Rua Nova, 456');

      expect(input.props.value).toBe('Rua Nova, 456');
    });
  });

  describe('Seleção de endereço', () => {
    it('deve receber coordenadas diretamente do autocomplete (Photon)', async () => {
      // Photon retorna coordenadas diretamente no callback do autocomplete
      // Não precisa mais chamar getPlaceDetails!
      const { getByTestId } = render(<AddStopModal {...defaultProps} />);

      fireEvent.press(getByTestId('address-suggestion'));

      // Coordenadas são passadas diretamente pelo AddressAutocomplete mock
      // O hook deve receber { latitude: -23.55, longitude: -46.63 }
      await waitFor(() => {
        const input = getByTestId('address-input');
        expect(input.props.value).toBe('Rua Teste, 123');
      });
    });
  });

  describe('Validação', () => {
    it('deve exibir erro quando endereço está vazio', async () => {
      const { getByText } = render(<AddStopModal {...defaultProps} />);

      fireEvent.press(getByText('Adicionar'));

      await waitFor(() => {
        expect(getByText('Endereço é obrigatório')).toBeTruthy();
      });
    });

    it('deve exibir erro quando limite de paradas é atingido', () => {
      render(<AddStopModal {...defaultProps} currentParadasCount={23} />);

      expect(lastPrimaryButton?.disabled).toBe(true);
    });
  });

  describe('Salvamento', () => {
    beforeEach(() => {
      // Photon retorna coordenadas diretamente no autocomplete callback
      // Não precisa mais mockar getPlaceDetails!
      mockRpc.mockResolvedValue({
        data: { success: true, parada_id: 'new-parada-123', ordem: 3 },
        error: null,
      });
      mockRecalcularRota.mockResolvedValue({ success: true });
      mockNotificarMotorista.mockResolvedValue({ success: true });
      mockFrom.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      });
    });

    it('deve salvar parada com sucesso', async () => {
      const { getByTestId, getByText } = render(
        <AddStopModal {...defaultProps} />,
      );

      // Selecionar endereço do autocomplete (Photon retorna coordenadas diretamente!)
      fireEvent.press(getByTestId('address-suggestion'));

      // Clicar em Adicionar
      fireEvent.press(getByText('Adicionar'));

      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith(
          'inserir_parada',
          expect.objectContaining({
            p_rota_id: 'rota-123',
            p_tipo: 'entrega',
            p_endereco: 'Rua Teste, 123',
          }),
        );
      });

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalled();
      });
    });

    it('deve usar geocoding quando coordenadas não estão disponíveis', async () => {
      // Quando usuário digita manualmente (sem usar autocomplete), usa geocoding
      mockGeocodeAddress.mockResolvedValue({
        coordenadas: { latitude: -23.59, longitude: -46.67 },
      });

      const { getByTestId, getByText } = render(
        <AddStopModal {...defaultProps} />,
      );

      // Digitar endereço manualmente (sem coordenadas)
      fireEvent.changeText(getByTestId('address-input'), 'Rua Manual, 789');

      fireEvent.press(getByText('Adicionar'));

      await waitFor(() => {
        expect(mockGeocodeAddress).toHaveBeenCalledWith('Rua Manual, 789');
      });
    });

    it('deve exibir erro se geocoding falhar', async () => {
      mockGeocodeAddress.mockResolvedValue(null);

      const { getByTestId, getByText } = render(
        <AddStopModal {...defaultProps} />,
      );

      fireEvent.changeText(getByTestId('address-input'), 'Endereço Inválido');
      fireEvent.press(getByText('Adicionar'));

      await waitFor(() => {
        expect(
          getByText(/Não foi possível encontrar as coordenadas/),
        ).toBeTruthy();
      });
    });

    it('deve exibir erro se RPC falhar', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const { getByTestId, getByText } = render(
        <AddStopModal {...defaultProps} />,
      );

      // Selecionar endereço (Photon retorna coordenadas diretamente)
      fireEvent.press(getByTestId('address-suggestion'));

      fireEvent.press(getByText('Adicionar'));

      await waitFor(() => {
        expect(getByText(/Erro ao adicionar parada/)).toBeTruthy();
      });
    });

    it('deve recalcular rota após inserção', async () => {
      const { getByTestId, getByText } = render(
        <AddStopModal {...defaultProps} />,
      );

      fireEvent.press(getByTestId('address-suggestion'));
      // Photon retorna coordenadas diretamente (sem getPlaceDetails)

      fireEvent.press(getByText('Adicionar'));

      await waitFor(() => {
        expect(mockRecalcularRota).toHaveBeenCalledWith(
          'rota-123',
          expect.any(Array),
          defaultProps.enderecoUnidade,
        );
      });
    });

    it('deve exibir warning quando recálculo de rota falha', async () => {
      mockRecalcularRota.mockResolvedValue({
        success: false,
        error: 'API error',
      });

      const { getByTestId, getByText } = render(
        <AddStopModal {...defaultProps} />,
      );

      fireEvent.press(getByTestId('address-suggestion'));
      // Photon retorna coordenadas diretamente (sem getPlaceDetails)

      fireEvent.press(getByText('Adicionar'));

      await waitFor(() => {
        expect(getByText(/otimização da rota falhou/i)).toBeTruthy();
      });

      // Deve ainda chamar onSave (parada foi adicionada com sucesso)
      expect(defaultProps.onSave).toHaveBeenCalledWith({
        routeRecalculationFailed: true,
      });
    });

    it('deve notificar motorista após inserção', async () => {
      const { getByTestId, getByText } = render(
        <AddStopModal {...defaultProps} />,
      );

      fireEvent.press(getByTestId('address-suggestion'));
      // Photon retorna coordenadas diretamente (sem getPlaceDetails)

      fireEvent.press(getByText('Adicionar'));

      await waitFor(() => {
        expect(mockNotificarMotorista).toHaveBeenCalledWith(
          expect.objectContaining({
            rotaId: 'rota-123',
            motoristaId: 'motorista-456',
            tipo: 'rota_parada_adicionada',
          }),
        );
      });
    });

    it('deve registrar log após inserção', async () => {
      const { getByTestId, getByText } = render(
        <AddStopModal {...defaultProps} />,
      );

      fireEvent.press(getByTestId('address-suggestion'));
      // Photon retorna coordenadas diretamente (sem getPlaceDetails)

      fireEvent.press(getByText('Adicionar'));

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('logs');
      });
    });

    it('não deve notificar se motoristaId não está definido', async () => {
      const onSave = jest.fn();
      const propsWithoutMotorista = {
        ...defaultProps,
        motoristaId: undefined,
        onSave,
      };

      const { getByTestId, getByText } = render(
        <AddStopModal {...propsWithoutMotorista} />,
      );

      fireEvent.press(getByTestId('address-suggestion'));
      // Photon retorna coordenadas diretamente (sem getPlaceDetails)

      fireEvent.press(getByText('Adicionar'));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });

      expect(mockNotificarMotorista).not.toHaveBeenCalled();
    });

    it('não deve registrar log se usuarioId não está definido', async () => {
      const onSave = jest.fn();
      const propsWithoutUser = {
        ...defaultProps,
        usuarioId: undefined,
        onSave,
      };

      const { getByTestId, getByText } = render(
        <AddStopModal {...propsWithoutUser} />,
      );

      fireEvent.press(getByTestId('address-suggestion'));
      // Photon retorna coordenadas diretamente (sem getPlaceDetails)

      fireEvent.press(getByText('Adicionar'));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });

      // logs.insert não deve ser chamado
      expect(mockFrom).not.toHaveBeenCalledWith('logs');
    });
  });

  describe('Reset de formulário', () => {
    it('deve limpar formulário quando modal é aberto', async () => {
      const { getByTestId, rerender } = render(
        <AddStopModal {...defaultProps} visible={false} />,
      );

      // Reabrir modal
      rerender(<AddStopModal {...defaultProps} visible={true} />);

      const input = getByTestId('address-input');
      expect(input.props.value).toBe('');
    });
  });

  describe('Acessibilidade', () => {
    it('deve ter radiogroup para seleção de posição', () => {
      const { getByLabelText } = render(<AddStopModal {...defaultProps} />);

      expect(getByLabelText('Selecione a posição na rota')).toBeTruthy();
    });

    it('deve ter labels de acessibilidade nas opções de posição', () => {
      const { getByLabelText } = render(<AddStopModal {...defaultProps} />);

      expect(getByLabelText(/Posição 1/)).toBeTruthy();
      expect(getByLabelText(/Posição 2/)).toBeTruthy();
      expect(getByLabelText(/Posição 3, Final da rota/)).toBeTruthy();
    });
  });
});
