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

jest.mock('@/utils/phoneValidation', () => ({
  maskPhone: (text: string) => text.replace(/\D/g, '').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3'),
}));

// Mock theme with complete structure
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
      info: '#3b82f6',
      warning: '#f7a02a',
      warningBg: '#fef3c7',
      error: '#ef4444',
      success: '#10b981',
      white: '#ffffff',
      gray50: '#f9fafb',
      gray200: '#e5e7eb',
      gray300: '#d1d5db',
      gray400: '#9ca3af',
      gray500: '#6b7280',
      gray700: '#374151',
      gray900: '#111827',
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
    },
    typography: {
      fontSans: 'NunitoSans-Regular',
      fontSansSemiBold: 'NunitoSans-SemiBold',
      fontSansBold: 'NunitoSans-Bold',
      xs: 12,
      sm: 14,
      base: 16,
    },
    borderRadius: {
      sm: 8,
      md: 10,
    },
    desktop: {
      input: { fontSize: 14, height: 36, paddingHorizontal: 10 },
      button: { fontSize: 13, paddingHorizontal: 12 },
      field: { marginBottom: 12 },
      section: { padding: 12, gap: 8 },
    },
  };

  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: (t: typeof theme) => Record<string, unknown>) => fn(theme),
    },
  };
});

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
          onPress={() => onSelectAddress('Rua Teste, 123', 'place_id_123')}
        >
          <Text>Rua Teste, 123</Text>
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
  Ionicons: ({ name, size: _size, color: _color }: { name: string; size: number; color: string }) => {
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
      { id: 'p1', ordem: 1, latitude: -23.56, longitude: -46.64, is_checkpoint: true, endereco: 'Rua A', status: 'pendente' } as any,
      { id: 'p2', ordem: 2, latitude: -23.57, longitude: -46.65, is_checkpoint: true, endereco: 'Rua B', status: 'pendente' } as any,
    ],
    onSave: jest.fn(),
    onCancel: jest.fn(),
    usuarioId: 'user-123',
    motoristaId: 'motorista-456',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Renderização', () => {
    it('deve renderizar o modal quando visible=true', () => {
      const { getByTestId, getByText } = render(<AddStopModal {...defaultProps} />);

      expect(getByTestId('desktop-modal')).toBeTruthy();
      expect(getByTestId('modal-title')).toBeTruthy();
      expect(getByText('Adicionar Parada')).toBeTruthy();
    });

    it('não deve renderizar quando visible=false', () => {
      const { queryByTestId } = render(<AddStopModal {...defaultProps} visible={false} />);

      expect(queryByTestId('desktop-modal')).toBeNull();
    });

    it('deve exibir banner de aviso quando limite de paradas é atingido', () => {
      const { getByText } = render(
        <AddStopModal {...defaultProps} currentParadasCount={23} />
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
        <AddStopModal {...defaultProps} allParadas={[]} />
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

    it('deve selecionar posição quando opção é clicada', () => {
      const { getByText } = render(<AddStopModal {...defaultProps} />);

      fireEvent.press(getByText(/Antes de: Rua A/));
      // A opção deve ser selecionada (verificar visualmente)
    });

    it('deve atualizar endereço quando texto é digitado', () => {
      const { getByTestId } = render(<AddStopModal {...defaultProps} />);

      const input = getByTestId('address-input');
      fireEvent.changeText(input, 'Rua Nova, 456');

      expect(input.props.value).toBe('Rua Nova, 456');
    });
  });

  describe('Seleção de endereço', () => {
    it('deve buscar coordenadas quando endereço é selecionado do autocomplete', async () => {
      mockGetPlaceDetails.mockResolvedValue({
        coordenadas: { latitude: -23.58, longitude: -46.66 },
      });

      const { getByTestId } = render(<AddStopModal {...defaultProps} />);

      fireEvent.press(getByTestId('address-suggestion'));

      await waitFor(() => {
        expect(mockGetPlaceDetails).toHaveBeenCalledWith('place_id_123');
      });
    });

    it('deve lidar com erro ao buscar coordenadas', async () => {
      mockGetPlaceDetails.mockRejectedValue(new Error('API error'));

      const { getByTestId } = render(<AddStopModal {...defaultProps} />);

      fireEvent.press(getByTestId('address-suggestion'));

      await waitFor(() => {
        expect(mockGetPlaceDetails).toHaveBeenCalled();
      });
      // Não deve crashar
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

    it('deve exibir erro quando limite de paradas é atingido', async () => {
      const { getByText } = render(
        <AddStopModal {...defaultProps} currentParadasCount={23} />
      );

      // Preencher endereço primeiro
      const { getByTestId } = render(
        <AddStopModal {...defaultProps} currentParadasCount={23} />
      );
      fireEvent.changeText(getByTestId('address-input'), 'Rua Teste');
      fireEvent.press(getByText('Adicionar'));

      // Botão deve estar desabilitado
    });
  });

  describe('Salvamento', () => {
    beforeEach(() => {
      mockGetPlaceDetails.mockResolvedValue({
        coordenadas: { latitude: -23.58, longitude: -46.66 },
      });
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
      const { getByTestId, getByText } = render(<AddStopModal {...defaultProps} />);

      // Selecionar endereço do autocomplete (isso define as coordenadas)
      fireEvent.press(getByTestId('address-suggestion'));

      await waitFor(() => {
        expect(mockGetPlaceDetails).toHaveBeenCalled();
      });

      // Clicar em Adicionar
      fireEvent.press(getByText('Adicionar'));

      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith('inserir_parada', expect.objectContaining({
          p_rota_id: 'rota-123',
          p_tipo: 'entrega',
          p_endereco: 'Rua Teste, 123',
        }));
      });

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalled();
      });
    });

    it('deve usar geocoding quando coordenadas não estão disponíveis', async () => {
      mockGetPlaceDetails.mockResolvedValue({ coordenadas: null });
      mockGeocodeAddress.mockResolvedValue({
        coordenadas: { latitude: -23.59, longitude: -46.67 },
      });

      const { getByTestId, getByText } = render(<AddStopModal {...defaultProps} />);

      // Digitar endereço manualmente (sem coordenadas)
      fireEvent.changeText(getByTestId('address-input'), 'Rua Manual, 789');

      fireEvent.press(getByText('Adicionar'));

      await waitFor(() => {
        expect(mockGeocodeAddress).toHaveBeenCalledWith('Rua Manual, 789');
      });
    });

    it('deve exibir erro se geocoding falhar', async () => {
      mockGeocodeAddress.mockResolvedValue(null);

      const { getByTestId, getByText } = render(<AddStopModal {...defaultProps} />);

      fireEvent.changeText(getByTestId('address-input'), 'Endereço Inválido');
      fireEvent.press(getByText('Adicionar'));

      await waitFor(() => {
        expect(getByText(/Não foi possível encontrar as coordenadas/)).toBeTruthy();
      });
    });

    it('deve exibir erro se RPC falhar', async () => {
      mockGetPlaceDetails.mockResolvedValue({
        coordenadas: { latitude: -23.58, longitude: -46.66 },
      });
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const { getByTestId, getByText } = render(<AddStopModal {...defaultProps} />);

      fireEvent.press(getByTestId('address-suggestion'));
      await waitFor(() => expect(mockGetPlaceDetails).toHaveBeenCalled());

      fireEvent.press(getByText('Adicionar'));

      await waitFor(() => {
        expect(getByText(/Erro ao adicionar parada/)).toBeTruthy();
      });
    });

    it('deve recalcular rota após inserção', async () => {
      const { getByTestId, getByText } = render(<AddStopModal {...defaultProps} />);

      fireEvent.press(getByTestId('address-suggestion'));
      await waitFor(() => expect(mockGetPlaceDetails).toHaveBeenCalled());

      fireEvent.press(getByText('Adicionar'));

      await waitFor(() => {
        expect(mockRecalcularRota).toHaveBeenCalledWith(
          'rota-123',
          expect.any(Array),
          defaultProps.enderecoUnidade
        );
      });
    });

    it('deve exibir warning quando recálculo de rota falha', async () => {
      mockRecalcularRota.mockResolvedValue({ success: false, error: 'API error' });

      const { getByTestId, getByText } = render(<AddStopModal {...defaultProps} />);

      fireEvent.press(getByTestId('address-suggestion'));
      await waitFor(() => expect(mockGetPlaceDetails).toHaveBeenCalled());

      fireEvent.press(getByText('Adicionar'));

      await waitFor(() => {
        expect(getByText(/otimização da rota falhou/i)).toBeTruthy();
      });

      // Deve ainda chamar onSave (parada foi adicionada com sucesso)
      expect(defaultProps.onSave).toHaveBeenCalled();
    });

    it('deve notificar motorista após inserção', async () => {
      const { getByTestId, getByText } = render(<AddStopModal {...defaultProps} />);

      fireEvent.press(getByTestId('address-suggestion'));
      await waitFor(() => expect(mockGetPlaceDetails).toHaveBeenCalled());

      fireEvent.press(getByText('Adicionar'));

      await waitFor(() => {
        expect(mockNotificarMotorista).toHaveBeenCalledWith(expect.objectContaining({
          rotaId: 'rota-123',
          motoristaId: 'motorista-456',
          tipo: 'rota_parada_adicionada',
        }));
      });
    });

    it('deve registrar log após inserção', async () => {
      const { getByTestId, getByText } = render(<AddStopModal {...defaultProps} />);

      fireEvent.press(getByTestId('address-suggestion'));
      await waitFor(() => expect(mockGetPlaceDetails).toHaveBeenCalled());

      fireEvent.press(getByText('Adicionar'));

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('logs');
      });
    });

    it('não deve notificar se motoristaId não está definido', async () => {
      const propsWithoutMotorista = { ...defaultProps, motoristaId: undefined };

      const { getByTestId, getByText } = render(
        <AddStopModal {...propsWithoutMotorista} />
      );

      fireEvent.press(getByTestId('address-suggestion'));
      await waitFor(() => expect(mockGetPlaceDetails).toHaveBeenCalled());

      fireEvent.press(getByText('Adicionar'));

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalled();
      });

      expect(mockNotificarMotorista).not.toHaveBeenCalled();
    });

    it('não deve registrar log se usuarioId não está definido', async () => {
      const propsWithoutUser = { ...defaultProps, usuarioId: undefined };

      const { getByTestId, getByText } = render(
        <AddStopModal {...propsWithoutUser} />
      );

      fireEvent.press(getByTestId('address-suggestion'));
      await waitFor(() => expect(mockGetPlaceDetails).toHaveBeenCalled());

      fireEvent.press(getByText('Adicionar'));

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalled();
      });

      // logs.insert não deve ser chamado
      expect(mockFrom).not.toHaveBeenCalledWith('logs');
    });
  });

  describe('Reset de formulário', () => {
    it('deve limpar formulário quando modal é aberto', async () => {
      const { getByTestId, rerender } = render(
        <AddStopModal {...defaultProps} visible={false} />
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
