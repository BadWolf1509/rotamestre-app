/**
 * Tests for useEnderecoUnidade hook
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// Mock dependencies
const mockShowToast = jest.fn();
jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

const mockUnidadeAtivaData = {
  id: 'unidade-123',
  nome: 'Unidade Teste',
  cidade: 'São Paulo',
  uf: 'SP',
  cep: '01310-100',
  endereco: 'Av. Paulista, 1000',
  sede_endereco: null,
  sede_latitude: null,
  sede_longitude: null,
  updated_at: '2024-01-01T00:00:00Z',
};

let mockUnidadeAtiva = mockUnidadeAtivaData;

jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({
    unidadeAtivaData: mockUnidadeAtiva,
  }),
}));

// Mock Photon service (migrado de Google)
const mockGeocodeAddress = jest.fn();
jest.mock('@/lib/photon', () => ({
  photonService: {
    geocodeAddress: (...args: unknown[]) => mockGeocodeAddress(...args),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

import { logger } from '@/lib/logger';

import { useEnderecoUnidade } from '../useEnderecoUnidade';

describe('useEnderecoUnidade', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUnidadeAtiva = { ...mockUnidadeAtivaData };
    mockGeocodeAddress.mockResolvedValue({
      coordenadas: { latitude: -23.5505, longitude: -46.6333 },
      formatted_address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
    });
  });

  describe('initialization', () => {
    it('should start with isLoading true', () => {
      const { result } = renderHook(() => useEnderecoUnidade());

      expect(result.current.isLoading).toBe(true);
    });

    it('should provide reload function', () => {
      const { result } = renderHook(() => useEnderecoUnidade());

      expect(typeof result.current.reload).toBe('function');
    });
  });

  describe('without unidade', () => {
    it('should have null enderecoUnidade initially', () => {
      // When hook is first rendered before data loads
      const { result } = renderHook(() => useEnderecoUnidade());

      // Initially null (before geocoding completes)
      expect(result.current.enderecoUnidade).toBeNull();
    });
  });

  describe('with coordinates in database', () => {
    it('should use coordinates from database', async () => {
      mockUnidadeAtiva = {
        ...mockUnidadeAtivaData,
        sede_latitude: -23.5505,
        sede_longitude: -46.6333,
        sede_endereco: 'Av. Paulista, 1000',
      };

      const { result } = renderHook(() => useEnderecoUnidade());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.enderecoUnidade).toEqual({
        latitude: -23.5505,
        longitude: -46.6333,
        endereco: 'Av. Paulista, 1000, São Paulo, SP, 01310-100',
      });

      expect(mockGeocodeAddress).not.toHaveBeenCalled();
    });

    it('should handle string coordinates from database', async () => {
      mockUnidadeAtiva = {
        ...mockUnidadeAtivaData,
        sede_latitude: '-23.5505' as any,
        sede_longitude: '-46.6333' as any,
      };

      const { result } = renderHook(() => useEnderecoUnidade());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.enderecoUnidade?.latitude).toBe(-23.5505);
      expect(result.current.enderecoUnidade?.longitude).toBe(-46.6333);
    });

    it('should handle null coordinates', async () => {
      mockUnidadeAtiva = {
        ...mockUnidadeAtivaData,
        sede_latitude: null,
        sede_longitude: null,
      };

      const { result } = renderHook(() => useEnderecoUnidade());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGeocodeAddress).toHaveBeenCalled();
    });
  });

  describe('geocoding', () => {
    it('should geocode address when no coordinates', async () => {
      const { result } = renderHook(() => useEnderecoUnidade());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGeocodeAddress).toHaveBeenCalledWith(
        'Av. Paulista, 1000, São Paulo, SP, 01310-100'
      );

      expect(result.current.enderecoUnidade).toEqual({
        latitude: -23.5505,
        longitude: -46.6333,
        endereco: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
      });
    });

    it('should show error toast when geocoding fails', async () => {
      mockGeocodeAddress.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useEnderecoUnidade());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Endereço da unidade não encontrado. Verifique o cadastro da unidade.',
        'error'
      );

      expect(logger.error).toHaveBeenCalledWith(
        '[useEnderecoUnidade] Não foi possível geocodificar o endereço da unidade'
      );
    });

    it('should show error toast when no address to geocode', async () => {
      mockUnidadeAtiva = {
        ...mockUnidadeAtivaData,
        endereco: null as any,
        sede_endereco: null,
        cidade: null as any,
        uf: null as any,
        cep: null as any,
      };

      const { result } = renderHook(() => useEnderecoUnidade());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Endereço da unidade não encontrado. Complete o cadastro antes de gerar rotas.',
        'error'
      );

      expect(logger.warn).toHaveBeenCalledWith(
        '[useEnderecoUnidade] Unidade sem endereço completo cadastrado'
      );
    });

    it('should handle geocoding exception', async () => {
      mockGeocodeAddress.mockRejectedValueOnce(new Error('Geocoding error'));

      const { result } = renderHook(() => useEnderecoUnidade());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[useEnderecoUnidade] Erro ao geocodificar endereço da unidade',
        expect.any(Error)
      );
    });
  });

  describe('reload', () => {
    it('should reload address on demand', async () => {
      const { result } = renderHook(() => useEnderecoUnidade());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGeocodeAddress).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.reload();
      });

      expect(mockGeocodeAddress).toHaveBeenCalledTimes(2);
    });
  });

  describe('address formatting', () => {
    it('should build complete address from parts', async () => {
      mockUnidadeAtiva = {
        ...mockUnidadeAtivaData,
        sede_endereco: 'Rua Teste',
        cidade: 'Rio de Janeiro',
        uf: 'RJ',
        cep: '20000-000',
      };

      const { result } = renderHook(() => useEnderecoUnidade());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGeocodeAddress).toHaveBeenCalledWith(
        'Rua Teste, Rio de Janeiro, RJ, 20000-000'
      );
    });

    it('should handle missing parts gracefully', async () => {
      mockUnidadeAtiva = {
        ...mockUnidadeAtivaData,
        sede_endereco: 'Rua Teste',
        uf: null as any,
        cep: null as any,
      };

      const { result } = renderHook(() => useEnderecoUnidade());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGeocodeAddress).toHaveBeenCalledWith(
        'Rua Teste, São Paulo'
      );
    });

    it('should fallback to endereco when sede_endereco is null', async () => {
      mockUnidadeAtiva = {
        ...mockUnidadeAtivaData,
        sede_endereco: null,
        endereco: 'Endereco Principal',
      };

      const { result } = renderHook(() => useEnderecoUnidade());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGeocodeAddress).toHaveBeenCalledWith(
        expect.stringContaining('Endereco Principal')
      );
    });
  });
});
