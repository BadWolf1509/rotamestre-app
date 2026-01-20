/**
 * Tests for useDrawerContact hook
 */

import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';

// Mock dependencies
jest.mock('@/context/RouteStatusContext', () => ({
  useRouteStatus: jest.fn(() => ({
    route: null,
    currentStop: null,
  })),
}));

jest.mock('@/hooks/useUser', () => ({
  useUser: jest.fn(() => ({
    userData: { nome: 'João Motorista' },
  })),
}));

// Mock supabase
const mockSingle = jest.fn();
const mockRpc = jest.fn(() => ({
  single: mockSingle,
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (name: string) => mockRpc(name),
  },
}));

// Spy on Alert
jest.spyOn(Alert, 'alert');

import { useDrawerContact } from '../useDrawerContact';

describe('useDrawerContact', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSingle.mockResolvedValue({
      data: {
        nome: 'Gestor João',
        email: 'gestor@example.com',
        telefone: '11999999999',
      },
      error: null,
    });
  });

  describe('initialization', () => {
    it('should initialize with showContactModal = false', () => {
      const { result } = renderHook(() => useDrawerContact({ onClose: mockOnClose }));

      expect(result.current.showContactModal).toBe(false);
    });

    it('should initialize with gestorDataForModal = null', () => {
      const { result } = renderHook(() => useDrawerContact({ onClose: mockOnClose }));

      expect(result.current.gestorDataForModal).toBeNull();
    });

    it('should provide all required functions', () => {
      const { result } = renderHook(() => useDrawerContact({ onClose: mockOnClose }));

      expect(typeof result.current.handleContactGestor).toBe('function');
      expect(typeof result.current.handleWebReasonSelect).toBe('function');
      expect(typeof result.current.handleCloseContactModal).toBe('function');
    });
  });

  describe('handleCloseContactModal', () => {
    it('should set showContactModal to false', () => {
      const { result } = renderHook(() => useDrawerContact({ onClose: mockOnClose }));

      act(() => {
        result.current.handleCloseContactModal();
      });

      expect(result.current.showContactModal).toBe(false);
    });
  });

  describe('handleContactGestor', () => {
    it('should call supabase rpc to get gestor data', async () => {
      const { result } = renderHook(() => useDrawerContact({ onClose: mockOnClose }));

      await act(async () => {
        await result.current.handleContactGestor();
      });

      expect(mockRpc).toHaveBeenCalledWith('get_gestor_contato');
    });

    it('should show error alert if gestor data fetch fails', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      const { result } = renderHook(() => useDrawerContact({ onClose: mockOnClose }));

      await act(async () => {
        await result.current.handleContactGestor();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Não foi possível obter os dados do gestor');
    });

    it('should show error alert if gestor not found', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const { result } = renderHook(() => useDrawerContact({ onClose: mockOnClose }));

      await act(async () => {
        await result.current.handleContactGestor();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Gestor não encontrado para esta unidade');
    });

    it('should handle exception during contact', async () => {
      mockSingle.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useDrawerContact({ onClose: mockOnClose }));

      await act(async () => {
        await result.current.handleContactGestor();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Não foi possível contatar o gestor');
    });

    it('should show reason menu when gestor found', async () => {
      const { result } = renderHook(() => useDrawerContact({ onClose: mockOnClose }));

      await act(async () => {
        await result.current.handleContactGestor();
      });

      // On Android/default, Alert.alert should be called to show options
      expect(Alert.alert).toHaveBeenCalled();
    });
  });
});
