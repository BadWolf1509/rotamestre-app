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
// A RPC pode não devolver linha (loja sem gestor ativo, conta sem loja ativa):
// o hook usa `.maybeSingle()`. O `.single()` fica no mock só para provar que
// não é chamado — com zero linhas ele vira erro 406 (PGRST116).
const mockMaybeSingle = jest.fn();
const mockSingle = jest.fn();
const mockRpc = jest.fn(() => ({
  maybeSingle: mockMaybeSingle,
  single: mockSingle,
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (name: string) => mockRpc(name),
  },
}));

// Spy on Alert
jest.spyOn(Alert, 'alert');

import { logger } from '@/lib/logger';

import { useDrawerContact } from '../useDrawerContact';

describe('useDrawerContact', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({
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

    it('consulta com maybeSingle, nunca single (resposta vazia não é erro)', async () => {
      const { result } = renderHook(() => useDrawerContact({ onClose: mockOnClose }));

      await act(async () => {
        await result.current.handleContactGestor();
      });

      expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
      expect(mockSingle).not.toHaveBeenCalled();
    });

    it('should show error alert if gestor data fetch fails', async () => {
      mockMaybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      const { result } = renderHook(() => useDrawerContact({ onClose: mockOnClose }));

      await act(async () => {
        await result.current.handleContactGestor();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Não foi possível obter os dados do gestor');
    });

    it('sem gestor: mensagem própria, sem log de erro e sem menu de motivos', async () => {
      const errorSpy = jest.spyOn(logger, 'error');
      mockMaybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const { result } = renderHook(() => useDrawerContact({ onClose: mockOnClose }));

      await act(async () => {
        await result.current.handleContactGestor();
      });

      expect(Alert.alert).toHaveBeenCalledTimes(1);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Nenhum gestor disponível',
        'Não há gestor ativo cadastrado para a sua loja no momento. Procure a empresa por outro canal.'
      );
      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('should handle exception during contact', async () => {
      mockMaybeSingle.mockRejectedValueOnce(new Error('Network error'));

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
