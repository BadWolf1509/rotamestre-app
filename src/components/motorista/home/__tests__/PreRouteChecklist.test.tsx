/**
 * Tests for PreRouteChecklist.tsx
 * Verifica GPS, Internet e Bateria antes do motorista iniciar a rota
 */

import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { PreRouteChecklist } from '../PreRouteChecklist';

// Mock expo-location
const mockGetForegroundPermissionsAsync = jest.fn();
const mockRequestForegroundPermissionsAsync = jest.fn();
const mockHasServicesEnabledAsync = jest.fn();

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: () => mockGetForegroundPermissionsAsync(),
  requestForegroundPermissionsAsync: () => mockRequestForegroundPermissionsAsync(),
  hasServicesEnabledAsync: () => mockHasServicesEnabledAsync(),
}));

// Mock expo-network
const mockGetNetworkStateAsync = jest.fn();

jest.mock('expo-network', () => ({
  getNetworkStateAsync: () => mockGetNetworkStateAsync(),
}));

// Mock expo-battery
const mockGetBatteryLevelAsync = jest.fn();

jest.mock('expo-battery', () => ({
  getBatteryLevelAsync: () => mockGetBatteryLevelAsync(),
}));

// Mock react-native Linking
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(),
  openSettings: jest.fn(),
}));

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
      success: '#10b981',
      warning: '#f7a02a',
      error: '#ef4444',
      white: '#ffffff',
      gray50: '#f9fafb',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray400: '#9ca3af',
      gray600: '#4b5563',
      gray700: '#374151',
    },
  };

  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: (t: typeof theme) => Record<string, unknown>) => fn(theme),
    },
  };
});

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, testID }: { name: string; testID?: string }) => {
    const { Text } = require('react-native');
    return <Text testID={testID || `icon-${name}`}>{name}</Text>;
  },
}));

describe('PreRouteChecklist', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks - tudo ok
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockHasServicesEnabledAsync.mockResolvedValue(true);
    mockGetNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
    mockGetBatteryLevelAsync.mockResolvedValue(0.8); // 80%
  });

  describe('Versão Completa', () => {
    it('deve renderizar o título do checklist', async () => {
      const { getByText } = render(<PreRouteChecklist />);

      await waitFor(() => {
        expect(getByText('CHECKLIST PRÉ-ROTA')).toBeTruthy();
      });
    });

    it('deve mostrar status de GPS ativo quando permissão concedida e serviço ativo', async () => {
      const { getByText } = render(<PreRouteChecklist />);

      await waitFor(() => {
        expect(getByText('GPS ativo')).toBeTruthy();
      });
    });

    it('deve mostrar status de Internet conectada', async () => {
      const { getByText } = render(<PreRouteChecklist />);

      await waitFor(() => {
        expect(getByText('Internet conectada')).toBeTruthy();
      });
    });

    it('deve mostrar porcentagem da bateria', async () => {
      const { getByText } = render(<PreRouteChecklist />);

      await waitFor(() => {
        expect(getByText('80%')).toBeTruthy();
      });
    });

    it('deve mostrar mensagem "Tudo pronto para iniciar!" quando tudo ok', async () => {
      const { getByText } = render(<PreRouteChecklist />);

      await waitFor(() => {
        expect(getByText('Tudo pronto para iniciar!')).toBeTruthy();
      });
    });
  });

  describe('Status do GPS', () => {
    it('deve mostrar erro quando permissão GPS negada', async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });

      const mockOnStatusChange = jest.fn();
      const { getByText } = render(
        <PreRouteChecklist onStatusChange={mockOnStatusChange} />
      );

      await waitFor(() => {
        expect(getByText('Ativar')).toBeTruthy();
        expect(mockOnStatusChange).toHaveBeenCalledWith(false, false);
      });
    });

    it('deve mostrar erro quando serviço GPS desativado', async () => {
      mockHasServicesEnabledAsync.mockResolvedValue(false);

      const mockOnStatusChange = jest.fn();
      render(<PreRouteChecklist onStatusChange={mockOnStatusChange} />);

      await waitFor(() => {
        expect(mockOnStatusChange).toHaveBeenCalledWith(false, false);
      });
    });

    it('deve chamar requestForegroundPermissionsAsync ao clicar em Ativar', async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
      mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });

      const { getByText } = render(<PreRouteChecklist />);

      await waitFor(() => {
        expect(getByText('Ativar')).toBeTruthy();
      });

      fireEvent.press(getByText('Ativar'));

      await waitFor(() => {
        expect(mockRequestForegroundPermissionsAsync).toHaveBeenCalled();
      });
    });
  });

  describe('Status da Internet', () => {
    it('deve mostrar "Sem internet" quando não conectado', async () => {
      mockGetNetworkStateAsync.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });

      const { getByText } = render(<PreRouteChecklist />);

      await waitFor(() => {
        expect(getByText('Sem internet')).toBeTruthy();
      });
    });

    it('deve mostrar "Conexão instável" quando isInternetReachable é false', async () => {
      mockGetNetworkStateAsync.mockResolvedValue({
        isConnected: true,
        isInternetReachable: false,
      });

      const { getByText } = render(<PreRouteChecklist />);

      await waitFor(() => {
        expect(getByText('Conexão instável')).toBeTruthy();
      });
    });
  });

  describe('Status da Bateria', () => {
    it('deve mostrar warning quando bateria < 20%', async () => {
      mockGetBatteryLevelAsync.mockResolvedValue(0.15); // 15%

      const mockOnStatusChange = jest.fn();
      const { getByText } = render(
        <PreRouteChecklist onStatusChange={mockOnStatusChange} />
      );

      await waitFor(() => {
        expect(getByText('15%')).toBeTruthy();
        expect(getByText('Bateria baixa')).toBeTruthy();
      });
    });

    it('deve mostrar erro quando bateria < 10%', async () => {
      mockGetBatteryLevelAsync.mockResolvedValue(0.05); // 5%

      const mockOnStatusChange = jest.fn();
      const { getByText } = render(
        <PreRouteChecklist onStatusChange={mockOnStatusChange} />
      );

      await waitFor(() => {
        expect(getByText('5%')).toBeTruthy();
        expect(getByText('Bateria baixa')).toBeTruthy();
      });
    });

    it('deve assumir 100% quando getBatteryLevelAsync retorna -1 (simulador)', async () => {
      mockGetBatteryLevelAsync.mockResolvedValue(-0.01); // -1 * 100 = -1

      const { queryByText, getByText } = render(<PreRouteChecklist />);

      await waitFor(() => {
        expect(getByText('CHECKLIST PRÉ-ROTA')).toBeTruthy();
      });

      // Should show ok status, not warning or error
      expect(queryByText('Bateria baixa')).toBeNull();
    });
  });

  describe('Callback onStatusChange', () => {
    it('deve chamar onStatusChange com (true, true) quando tudo ok', async () => {
      const mockOnStatusChange = jest.fn();
      render(<PreRouteChecklist onStatusChange={mockOnStatusChange} />);

      await waitFor(() => {
        expect(mockOnStatusChange).toHaveBeenCalledWith(true, true);
      });
    });

    it('deve chamar onStatusChange com (true, false) quando há warnings mas pode iniciar', async () => {
      mockGetNetworkStateAsync.mockResolvedValue({
        isConnected: true,
        isInternetReachable: false,
      });

      const mockOnStatusChange = jest.fn();
      render(<PreRouteChecklist onStatusChange={mockOnStatusChange} />);

      await waitFor(() => {
        expect(mockOnStatusChange).toHaveBeenCalledWith(true, false);
      });
    });

    it('deve chamar onStatusChange com (false, false) quando GPS com erro', async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });

      const mockOnStatusChange = jest.fn();
      render(<PreRouteChecklist onStatusChange={mockOnStatusChange} />);

      await waitFor(() => {
        expect(mockOnStatusChange).toHaveBeenCalledWith(false, false);
      });
    });
  });

  describe('Versão Compacta', () => {
    it('deve renderizar versão compacta quando compact=true', async () => {
      const { getByText } = render(<PreRouteChecklist compact={true} />);

      await waitFor(() => {
        expect(getByText('GPS')).toBeTruthy();
        expect(getByText('Rede')).toBeTruthy();
        expect(getByText('80%')).toBeTruthy();
      });
    });

    it('não deve mostrar título na versão compacta', async () => {
      const { queryByText, getByText } = render(<PreRouteChecklist compact={true} />);

      await waitFor(() => {
        expect(getByText('GPS')).toBeTruthy();
      });

      expect(queryByText('CHECKLIST PRÉ-ROTA')).toBeNull();
    });
  });

  describe('Mensagens de Orientação', () => {
    it('deve mostrar mensagem para ativar GPS quando GPS com erro', async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });

      const { getByText } = render(<PreRouteChecklist />);

      await waitFor(() => {
        expect(getByText('Ative o GPS para iniciar a rota')).toBeTruthy();
      });
    });

    it('deve mostrar mensagem para carregar quando bateria com erro', async () => {
      mockGetBatteryLevelAsync.mockResolvedValue(0.05); // 5%

      const { getByText } = render(<PreRouteChecklist />);

      await waitFor(() => {
        expect(getByText('Carregue o celular antes de iniciar')).toBeTruthy();
      });
    });

    it('deve mostrar mensagem para verificar conexão quando apenas warning', async () => {
      mockGetNetworkStateAsync.mockResolvedValue({
        isConnected: true,
        isInternetReachable: false,
      });

      const { getByText } = render(<PreRouteChecklist />);

      await waitFor(() => {
        expect(getByText('Recomendamos verificar a conexão')).toBeTruthy();
      });
    });
  });

  describe('Tratamento de Erros', () => {
    it('deve tratar erro ao verificar GPS graciosamente', async () => {
      mockGetForegroundPermissionsAsync.mockRejectedValue(new Error('GPS error'));

      const mockOnStatusChange = jest.fn();
      render(<PreRouteChecklist onStatusChange={mockOnStatusChange} />);

      await waitFor(() => {
        // Should fallback to error state
        expect(mockOnStatusChange).toHaveBeenCalledWith(false, false);
      });
    });

    it('deve tratar erro ao verificar Internet graciosamente', async () => {
      mockGetNetworkStateAsync.mockRejectedValue(new Error('Network error'));

      const mockOnStatusChange = jest.fn();
      render(<PreRouteChecklist onStatusChange={mockOnStatusChange} />);

      await waitFor(() => {
        // Should fallback to warning state for internet
        expect(mockOnStatusChange).toHaveBeenCalledWith(true, false);
      });
    });

    it('deve tratar erro ao verificar Bateria graciosamente', async () => {
      mockGetBatteryLevelAsync.mockRejectedValue(new Error('Battery error'));

      const mockOnStatusChange = jest.fn();
      render(<PreRouteChecklist onStatusChange={mockOnStatusChange} />);

      await waitFor(() => {
        // Should fallback to ok state for battery (100%)
        expect(mockOnStatusChange).toHaveBeenCalledWith(true, true);
      });
    });
  });
});
