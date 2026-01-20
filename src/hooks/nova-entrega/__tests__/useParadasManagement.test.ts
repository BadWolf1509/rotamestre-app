/**
 * Tests for useParadasManagement hook
 */

import { renderHook, act } from '@testing-library/react-native';

import type { ParadaFormData, ParadaFormDataWithCoords } from '@/components/gestor/nova-entrega/types'; // eslint-disable-line import/order

// Mock googleMapsService
jest.mock('@/lib/google', () => ({
  googleMapsService: {
    geocodeAddress: jest.fn(),
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock helper
jest.mock('../../useNovaEntrega.helpers', () => ({
  generateUniqueId: jest.fn(() => `id-${Date.now()}-${Math.random()}`),
}));

// Mock routeOptimization constants
jest.mock('@/lib/routeOptimization', () => ({
  MAX_WAYPOINTS: 10,
  WAYPOINTS_RECOMENDADO: 8,
}));

import { googleMapsService } from '@/lib/google';

import { useParadasManagement } from '../useParadasManagement';

describe('useParadasManagement', () => {
  const defaultOptions = {
    rotaOtimizada: null,
    onOrdemManualChange: jest.fn(),
    onRotaOtimizadaReset: jest.fn(),
    onDistanciaManualRealReset: jest.fn(),
    showToast: jest.fn(),
    onFormReset: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with empty paradas', () => {
      const { result } = renderHook(() => useParadasManagement(defaultOptions));

      expect(result.current.paradas).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('should initialize with correct paradasStatus for empty list', () => {
      const { result } = renderHook(() => useParadasManagement(defaultOptions));

      expect(result.current.paradasStatus).toEqual({
        texto: 'Nenhuma parada adicionada',
        cor: 'default',
        icone: null,
      });
    });

    it('should return empty retiradasDisponiveis initially', () => {
      const { result } = renderHook(() => useParadasManagement(defaultOptions));

      expect(result.current.retiradasDisponiveis).toEqual([]);
    });
  });

  describe('onAddParada', () => {
    it('should add parada with coordinates', async () => {
      const { result } = renderHook(() => useParadasManagement(defaultOptions));

      const paradaData: ParadaFormDataWithCoords = {
        tipo: 'entrega',
        endereco: 'Rua A, 123',
        destinatario: 'João',
        telefone: '11999999999',
        observacoes: '',
        latitude: -23.5,
        longitude: -46.6,
      };

      await act(async () => {
        await result.current.onAddParada(paradaData);
      });

      expect(result.current.paradas).toHaveLength(1);
      expect(result.current.paradas[0].endereco).toBe('Rua A, 123');
      expect(result.current.paradas[0].destinatario).toBe('João');
      expect(result.current.paradas[0].ordem).toBe(1);
      expect(defaultOptions.onFormReset).toHaveBeenCalled();
      expect(defaultOptions.showToast).toHaveBeenCalledWith('Parada adicionada à lista!', 'success');
    });

    it('should geocode address if no coordinates', async () => {
      (googleMapsService.geocodeAddress as jest.Mock).mockResolvedValueOnce({
        coordenadas: { latitude: -23.5, longitude: -46.6 },
      });

      const { result } = renderHook(() => useParadasManagement(defaultOptions));

      const paradaData: ParadaFormData = {
        tipo: 'entrega',
        endereco: 'Rua A, 123',
        destinatario: 'João',
        telefone: '11999999999',
        observacoes: '',
      };

      await act(async () => {
        await result.current.onAddParada(paradaData);
      });

      expect(googleMapsService.geocodeAddress).toHaveBeenCalledWith('Rua A, 123');
      expect(result.current.paradas).toHaveLength(1);
    });

    it('should show error if geocoding fails', async () => {
      (googleMapsService.geocodeAddress as jest.Mock).mockResolvedValueOnce(null);

      const { result } = renderHook(() => useParadasManagement(defaultOptions));

      const paradaData: ParadaFormData = {
        tipo: 'entrega',
        endereco: 'Invalid Address',
        destinatario: 'João',
        telefone: '11999999999',
        observacoes: '',
      };

      await act(async () => {
        await result.current.onAddParada(paradaData);
      });

      expect(result.current.paradas).toHaveLength(0);
      expect(defaultOptions.showToast).toHaveBeenCalledWith(
        'Não foi possível localizar o endereço. Use o autocomplete para selecionar um endereço válido.',
        'error'
      );
    });

    it('should add vinculada entrega with message', async () => {
      const { result } = renderHook(() => useParadasManagement(defaultOptions));

      // First add a retirada
      const retirada: ParadaFormDataWithCoords = {
        tipo: 'retirada',
        endereco: 'Rua Origem, 100',
        destinatario: 'Fornecedor',
        telefone: '11888888888',
        observacoes: '',
        latitude: -23.4,
        longitude: -46.5,
      };

      await act(async () => {
        await result.current.onAddParada(retirada);
      });

      const retiradaId = result.current.paradas[0].id;

      // Now add a vinculada entrega
      const entrega: ParadaFormDataWithCoords = {
        tipo: 'entrega',
        endereco: 'Rua Destino, 200',
        destinatario: 'Cliente',
        telefone: '11999999999',
        observacoes: '',
        latitude: -23.5,
        longitude: -46.6,
      };

      await act(async () => {
        await result.current.onAddParada(entrega, retiradaId);
      });

      expect(result.current.paradas).toHaveLength(2);
      expect(result.current.paradas[1].vinculo_parada_id).toBe(retiradaId);
      expect(defaultOptions.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Entrega vinculada!'),
        'success',
        4000
      );
    });
  });

  describe('removeParada', () => {
    it('should remove parada at index', async () => {
      const { result } = renderHook(() => useParadasManagement(defaultOptions));

      // Add two paradas
      await act(async () => {
        await result.current.onAddParada({
          tipo: 'entrega',
          endereco: 'Rua A',
          destinatario: 'João',
          telefone: '',
          observacoes: '',
          latitude: -23.5,
          longitude: -46.6,
        } as ParadaFormDataWithCoords);
      });

      await act(async () => {
        await result.current.onAddParada({
          tipo: 'entrega',
          endereco: 'Rua B',
          destinatario: 'Maria',
          telefone: '',
          observacoes: '',
          latitude: -23.6,
          longitude: -46.7,
        } as ParadaFormDataWithCoords);
      });

      expect(result.current.paradas).toHaveLength(2);

      act(() => {
        result.current.removeParada(0);
      });

      expect(result.current.paradas).toHaveLength(1);
      expect(result.current.paradas[0].destinatario).toBe('Maria');
      expect(result.current.paradas[0].ordem).toBe(1);
      expect(defaultOptions.onRotaOtimizadaReset).toHaveBeenCalled();
    });

    it('should unlink entregas when removing retirada', async () => {
      const { result } = renderHook(() => useParadasManagement(defaultOptions));

      // Add retirada
      await act(async () => {
        await result.current.onAddParada({
          tipo: 'retirada',
          endereco: 'Origem',
          destinatario: 'Fornecedor',
          telefone: '',
          observacoes: '',
          latitude: -23.4,
          longitude: -46.5,
        } as ParadaFormDataWithCoords);
      });

      const retiradaId = result.current.paradas[0].id;

      // Add entrega vinculada
      await act(async () => {
        await result.current.onAddParada({
          tipo: 'entrega',
          endereco: 'Destino',
          destinatario: 'Cliente',
          telefone: '',
          observacoes: '',
          latitude: -23.5,
          longitude: -46.6,
        } as ParadaFormDataWithCoords, retiradaId);
      });

      // Remove retirada
      act(() => {
        result.current.removeParada(0);
      });

      // Entrega should have vinculo_parada_id cleared
      expect(result.current.paradas).toHaveLength(1);
      expect(result.current.paradas[0].vinculo_parada_id).toBeUndefined();
    });
  });

  describe('moveParadaUp', () => {
    it('should move parada up', async () => {
      const { result } = renderHook(() => useParadasManagement(defaultOptions));

      await act(async () => {
        await result.current.onAddParada({
          tipo: 'entrega',
          endereco: 'First',
          destinatario: 'A',
          telefone: '',
          observacoes: '',
          latitude: -23.5,
          longitude: -46.6,
        } as ParadaFormDataWithCoords);
      });

      await act(async () => {
        await result.current.onAddParada({
          tipo: 'entrega',
          endereco: 'Second',
          destinatario: 'B',
          telefone: '',
          observacoes: '',
          latitude: -23.6,
          longitude: -46.7,
        } as ParadaFormDataWithCoords);
      });

      act(() => {
        result.current.moveParadaUp(1);
      });

      expect(result.current.paradas[0].destinatario).toBe('B');
      expect(result.current.paradas[1].destinatario).toBe('A');
      expect(result.current.paradas[0].ordem).toBe(1);
      expect(result.current.paradas[1].ordem).toBe(2);
    });

    it('should not move first parada up', async () => {
      const { result } = renderHook(() => useParadasManagement(defaultOptions));

      await act(async () => {
        await result.current.onAddParada({
          tipo: 'entrega',
          endereco: 'First',
          destinatario: 'A',
          telefone: '',
          observacoes: '',
          latitude: -23.5,
          longitude: -46.6,
        } as ParadaFormDataWithCoords);
      });

      act(() => {
        result.current.moveParadaUp(0);
      });

      expect(result.current.paradas[0].destinatario).toBe('A');
    });

    it('should call onOrdemManualChange when rotaOtimizada exists', async () => {
      const optionsWithRota = {
        ...defaultOptions,
        rotaOtimizada: { status: 'success' as const },
      };

      const { result } = renderHook(() => useParadasManagement(optionsWithRota));

      await act(async () => {
        await result.current.onAddParada({
          tipo: 'entrega',
          endereco: 'First',
          destinatario: 'A',
          telefone: '',
          observacoes: '',
          latitude: -23.5,
          longitude: -46.6,
        } as ParadaFormDataWithCoords);
      });

      await act(async () => {
        await result.current.onAddParada({
          tipo: 'entrega',
          endereco: 'Second',
          destinatario: 'B',
          telefone: '',
          observacoes: '',
          latitude: -23.6,
          longitude: -46.7,
        } as ParadaFormDataWithCoords);
      });

      act(() => {
        result.current.moveParadaUp(1);
      });

      expect(defaultOptions.onOrdemManualChange).toHaveBeenCalledWith(true);
      expect(defaultOptions.onDistanciaManualRealReset).toHaveBeenCalled();
    });
  });

  describe('moveParadaDown', () => {
    it('should move parada down', async () => {
      const { result } = renderHook(() => useParadasManagement(defaultOptions));

      await act(async () => {
        await result.current.onAddParada({
          tipo: 'entrega',
          endereco: 'First',
          destinatario: 'A',
          telefone: '',
          observacoes: '',
          latitude: -23.5,
          longitude: -46.6,
        } as ParadaFormDataWithCoords);
      });

      await act(async () => {
        await result.current.onAddParada({
          tipo: 'entrega',
          endereco: 'Second',
          destinatario: 'B',
          telefone: '',
          observacoes: '',
          latitude: -23.6,
          longitude: -46.7,
        } as ParadaFormDataWithCoords);
      });

      act(() => {
        result.current.moveParadaDown(0);
      });

      expect(result.current.paradas[0].destinatario).toBe('B');
      expect(result.current.paradas[1].destinatario).toBe('A');
    });

    it('should not move last parada down', async () => {
      const { result } = renderHook(() => useParadasManagement(defaultOptions));

      await act(async () => {
        await result.current.onAddParada({
          tipo: 'entrega',
          endereco: 'First',
          destinatario: 'A',
          telefone: '',
          observacoes: '',
          latitude: -23.5,
          longitude: -46.6,
        } as ParadaFormDataWithCoords);
      });

      act(() => {
        result.current.moveParadaDown(0);
      });

      expect(result.current.paradas[0].destinatario).toBe('A');
    });
  });

  describe('clearParadas', () => {
    it('should clear all paradas', async () => {
      const { result } = renderHook(() => useParadasManagement(defaultOptions));

      await act(async () => {
        await result.current.onAddParada({
          tipo: 'entrega',
          endereco: 'Rua A',
          destinatario: 'A',
          telefone: '',
          observacoes: '',
          latitude: -23.5,
          longitude: -46.6,
        } as ParadaFormDataWithCoords);
      });

      expect(result.current.paradas).toHaveLength(1);

      act(() => {
        result.current.clearParadas();
      });

      expect(result.current.paradas).toHaveLength(0);
    });
  });

  describe('retiradasDisponiveis', () => {
    it('should return only retiradas', async () => {
      const { result } = renderHook(() => useParadasManagement(defaultOptions));

      await act(async () => {
        await result.current.onAddParada({
          tipo: 'retirada',
          endereco: 'Retirada 1',
          destinatario: 'Fornecedor',
          telefone: '',
          observacoes: '',
          latitude: -23.4,
          longitude: -46.5,
        } as ParadaFormDataWithCoords);
      });

      await act(async () => {
        await result.current.onAddParada({
          tipo: 'entrega',
          endereco: 'Entrega 1',
          destinatario: 'Cliente',
          telefone: '',
          observacoes: '',
          latitude: -23.5,
          longitude: -46.6,
        } as ParadaFormDataWithCoords);
      });

      expect(result.current.retiradasDisponiveis).toHaveLength(1);
      expect(result.current.retiradasDisponiveis[0].tipo).toBe('retirada');
    });
  });

  describe('paradasStatus', () => {
    it('should show default status for few paradas', async () => {
      const { result } = renderHook(() => useParadasManagement(defaultOptions));

      await act(async () => {
        await result.current.onAddParada({
          tipo: 'entrega',
          endereco: 'Rua A',
          destinatario: 'A',
          telefone: '',
          observacoes: '',
          latitude: -23.5,
          longitude: -46.6,
        } as ParadaFormDataWithCoords);
      });

      expect(result.current.paradasStatus.cor).toBe('default');
      expect(result.current.paradasStatus.texto).toContain('1 parada');
    });
  });
});
