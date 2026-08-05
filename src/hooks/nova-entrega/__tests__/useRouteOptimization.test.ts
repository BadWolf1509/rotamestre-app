/**
 * Tests for useRouteOptimization hook
 */

import { renderHook, act } from '@testing-library/react-native';

import type {
  Parada,
  EnderecoUnidade,
} from '@/components/gestor/nova-entrega/types';
import { googleMapsService } from '@/lib/google';

jest.mock('@/lib/google', () => ({
  googleMapsService: {
    getDirections: jest.fn(),
    getDirectionsSequential: jest.fn(),
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

// Mock routeOptimization
const mockOtimizarRotaComDependencias = jest.fn();
const mockValidarRotaParaOtimizacao = jest.fn();
jest.mock('@/lib/routeOptimization', () => ({
  __esModule: true,
  otimizarRotaComDependencias: (...args: unknown[]) =>
    mockOtimizarRotaComDependencias(...args),
  validarRotaParaOtimizacao: (...args: unknown[]) =>
    mockValidarRotaParaOtimizacao(...args),
  ParadaParaOtimizar: {},
}));

// Mock helper
jest.mock('../../useNovaEntrega.helpers', () => ({
  ordenarParadasPorRota: jest.fn((paradas: Parada[], ordem: number[]) => {
    // If ordem is provided, reorder based on indices. Otherwise return as-is.
    if (ordem && ordem.length > 0) {
      return ordem.map((i) => paradas[i]).filter(Boolean);
    }
    return paradas;
  }),
}));

import { useRouteOptimization } from '../useRouteOptimization';

const mockGetDirections = googleMapsService.getDirections as jest.Mock;
const mockGetDirectionsSequential =
  googleMapsService.getDirectionsSequential as jest.Mock;

describe('useRouteOptimization', () => {
  const mockEnderecoUnidade: EnderecoUnidade = {
    endereco: 'Av. Paulista, 1000',
    latitude: -23.5,
    longitude: -46.6,
  };

  const mockParadas: Parada[] = [
    {
      id: 'parada-1',
      tipo: 'entrega',
      endereco: 'Rua A, 123',
      destinatario: 'João',
      telefone: '11999999999',
      observacoes: '',
      latitude: -23.55,
      longitude: -46.65,
      ordem: 1,
    },
    {
      id: 'parada-2',
      tipo: 'entrega',
      endereco: 'Rua B, 456',
      destinatario: 'Maria',
      telefone: '11888888888',
      observacoes: '',
      latitude: -23.56,
      longitude: -46.66,
      ordem: 2,
    },
  ];

  const defaultOptions = {
    paradas: mockParadas,
    enderecoUnidade: mockEnderecoUnidade,
    showToast: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDirections.mockReset();
    mockOtimizarRotaComDependencias.mockReset();
    mockValidarRotaParaOtimizacao.mockReset();
    mockValidarRotaParaOtimizacao.mockReturnValue({
      valido: true,
      erros: [],
      avisos: [],
    });
    mockGetDirectionsSequential.mockReset();
    // Default: cálculo da distância "antes" sempre sucede, salvo quando um
    // teste específico sobrescreve com mockResolvedValueOnce/mockRejectedValueOnce.
    mockGetDirectionsSequential.mockResolvedValue({
      distancia_total_metros: 10000,
      duracao_total_segundos: 600,
      legs: [],
      polyline: 'antes-default',
      ordem_otimizada: [],
    });
  });

  describe('initialization', () => {
    it('should initialize with null rotaOtimizada', () => {
      const { result } = renderHook(() => useRouteOptimization(defaultOptions));

      expect(result.current.rotaOtimizada).toBeNull();
      expect(result.current.isOptimizing).toBe(false);
      expect(result.current.ordemManual).toBe(false);
    });
  });

  describe('otimizarRota', () => {
    it('should show info toast if no paradas', async () => {
      const options = { ...defaultOptions, paradas: [] };
      const { result } = renderHook(() => useRouteOptimization(options));

      await act(async () => {
        const res = await result.current.otimizarRota();
        expect(res).toBeNull();
      });

      expect(defaultOptions.showToast).toHaveBeenCalledWith(
        'Adicione pelo menos 1 parada para otimizar a rota',
        'info',
      );
    });

    it('should show error toast if no enderecoUnidade', async () => {
      const options = { ...defaultOptions, enderecoUnidade: null };
      const { result } = renderHook(() => useRouteOptimization(options));

      await act(async () => {
        const res = await result.current.otimizarRota();
        expect(res).toBeNull();
      });

      expect(defaultOptions.showToast).toHaveBeenCalledWith(
        'Endereço da unidade não encontrado. Verifique o cadastro da unidade.',
        'error',
      );
    });

    it('should show error toast if paradas lack coordinates', async () => {
      const paradasSemCoords: Parada[] = [
        {
          id: 'parada-1',
          tipo: 'entrega',
          endereco: 'Rua A, 123',
          destinatario: 'João',
          telefone: '',
          observacoes: '',
          latitude: undefined as any,
          longitude: undefined as any,
          ordem: 1,
        },
      ];

      const options = { ...defaultOptions, paradas: paradasSemCoords };
      const { result } = renderHook(() => useRouteOptimization(options));

      await act(async () => {
        const res = await result.current.otimizarRota();
        expect(res).toBeNull();
      });

      expect(defaultOptions.showToast).toHaveBeenCalledWith(
        'Algumas paradas não têm coordenadas válidas. Remova-as e adicione novamente.',
        'error',
      );
    });

    it('should show validation error if validation fails', async () => {
      mockValidarRotaParaOtimizacao.mockReturnValueOnce({
        valido: false,
        erros: ['Erro de validação'],
        avisos: [],
      });

      const { result } = renderHook(() => useRouteOptimization(defaultOptions));

      await act(async () => {
        const res = await result.current.otimizarRota();
        expect(res).toBeNull();
      });

      expect(defaultOptions.showToast).toHaveBeenCalledWith(
        'Erro de validação',
        'error',
      );
    });

    it('should show validation warning if there are avisos', async () => {
      mockValidarRotaParaOtimizacao.mockReturnValueOnce({
        valido: true,
        erros: [],
        avisos: ['Aviso de validação'],
      });

      mockGetDirections.mockResolvedValueOnce({
        distancia_total_metros: 10000,
        duracao_total_segundos: 600,
        legs: [],
        polyline: 'encoded',
        ordem_otimizada: [0, 1],
      });

      const { result } = renderHook(() => useRouteOptimization(defaultOptions));

      await act(async () => {
        await result.current.otimizarRota();
      });

      expect(defaultOptions.showToast).toHaveBeenCalledWith(
        'Aviso de validação',
        'info',
      );
    });

    it('should optimize route with vinculos using otimizarRotaComDependencias', async () => {
      const paradasComVinculo: Parada[] = [
        {
          id: 'retirada-1',
          tipo: 'retirada',
          endereco: 'Origem',
          destinatario: 'Fornecedor',
          telefone: '',
          observacoes: '',
          latitude: -23.5,
          longitude: -46.6,
          ordem: 1,
        },
        {
          id: 'entrega-1',
          tipo: 'entrega',
          endereco: 'Destino',
          destinatario: 'Cliente',
          telefone: '',
          observacoes: '',
          latitude: -23.55,
          longitude: -46.65,
          ordem: 2,
          vinculo_parada_id: 'retirada-1',
        },
      ];

      mockOtimizarRotaComDependencias.mockResolvedValueOnce({
        paradasOrdenadas: [{ id: 'retirada-1' }, { id: 'entrega-1' }],
        distanciaTotalMetros: 12000,
        duracaoTotalSegundos: 720,
        polyline: 'polyline_with_deps',
      });

      const options = { ...defaultOptions, paradas: paradasComVinculo };
      const { result } = renderHook(() => useRouteOptimization(options));

      await act(async () => {
        const res = await result.current.otimizarRota();
        expect(res).not.toBeNull();
        expect(res).toHaveLength(2);
      });

      expect(mockOtimizarRotaComDependencias).toHaveBeenCalled();
      expect(result.current.rotaOtimizada?.distancia_total_metros).toBe(12000);
      expect(defaultOptions.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Rota otimizada com dependências!'),
        'success',
        4000,
      );
    });

    it('should show error if getDirections returns null', async () => {
      mockGetDirections.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useRouteOptimization(defaultOptions));

      await act(async () => {
        const res = await result.current.otimizarRota();
        expect(res).toBeNull();
      });

      expect(defaultOptions.showToast).toHaveBeenCalledWith(
        'Não foi possível otimizar a rota',
        'error',
      );
    });

    it('marks a Haversine fallback as estimated instead of confirmed', async () => {
      mockGetDirections.mockResolvedValueOnce({
        distancia_total_metros: 10000,
        duracao_total_segundos: 600,
        legs: [],
        polyline: '',
        ordem_otimizada: [0, 1],
        is_estimated: true,
      });
      const { result } = renderHook(() => useRouteOptimization(defaultOptions));

      await act(async () => {
        await result.current.otimizarRota();
      });

      expect(result.current.rotaOtimizada?.isEstimated).toBe(true);
      expect(defaultOptions.showToast).toHaveBeenCalledWith(
        expect.stringContaining('apenas uma estimativa'),
        'info',
        6000,
      );
    });

    it('should show error if otimizarRotaComDependencias returns null', async () => {
      const paradasComVinculo: Parada[] = [
        {
          id: 'retirada-1',
          tipo: 'retirada',
          endereco: 'Origem',
          destinatario: 'Fornecedor',
          telefone: '',
          observacoes: '',
          latitude: -23.5,
          longitude: -46.6,
          ordem: 1,
        },
        {
          id: 'entrega-1',
          tipo: 'entrega',
          endereco: 'Destino',
          destinatario: 'Cliente',
          telefone: '',
          observacoes: '',
          latitude: -23.55,
          longitude: -46.65,
          ordem: 2,
          vinculo_parada_id: 'retirada-1',
        },
      ];

      mockOtimizarRotaComDependencias.mockResolvedValueOnce(null);

      const options = { ...defaultOptions, paradas: paradasComVinculo };
      const { result } = renderHook(() => useRouteOptimization(options));

      await act(async () => {
        const res = await result.current.otimizarRota();
        expect(res).toBeNull();
      });

      expect(defaultOptions.showToast).toHaveBeenCalledWith(
        'Não foi possível otimizar a rota',
        'error',
      );
    });

    it('should handle exceptions during optimization', async () => {
      mockGetDirections.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useRouteOptimization(defaultOptions));

      await act(async () => {
        const res = await result.current.otimizarRota();
        expect(res).toBeNull();
      });

      expect(defaultOptions.showToast).toHaveBeenCalledWith(
        'Não foi possível otimizar a rota',
        'error',
      );
    });

    it('should reset isOptimizing after operation completes', async () => {
      mockGetDirections.mockResolvedValueOnce({
        distancia_total_metros: 10000,
        duracao_total_segundos: 600,
        legs: [],
        polyline: 'encoded',
        ordem_otimizada: [0, 1],
      });

      const { result } = renderHook(() => useRouteOptimization(defaultOptions));

      // Initially not optimizing
      expect(result.current.isOptimizing).toBe(false);

      await act(async () => {
        await result.current.otimizarRota();
      });

      // After completion, should be false again
      expect(result.current.isOptimizing).toBe(false);
    });
  });

  describe('distanciaAntesKm', () => {
    it('guarda a distancia da ordem original ao otimizar', async () => {
      mockGetDirectionsSequential.mockResolvedValueOnce({
        distancia_total_metros: 30500,
        duracao_total_segundos: 2400,
        legs: [],
        polyline: 'abc',
        ordem_otimizada: [],
      });
      mockGetDirections.mockResolvedValueOnce({
        distancia_total_metros: 10000,
        duracao_total_segundos: 600,
        legs: [],
        polyline: 'encoded',
        ordem_otimizada: [0, 1],
      });

      const { result } = renderHook(() => useRouteOptimization(defaultOptions));

      await act(async () => {
        await result.current.otimizarRota();
      });

      expect(result.current.rotaOtimizada?.distanciaAntesKm).toBe(30.5);
    });

    it('nao bloqueia a otimizacao quando o calculo do "antes" falha', async () => {
      mockGetDirectionsSequential.mockRejectedValueOnce(new Error('OSRM fora'));
      mockGetDirections.mockResolvedValueOnce({
        distancia_total_metros: 10000,
        duracao_total_segundos: 600,
        legs: [],
        polyline: 'encoded',
        ordem_otimizada: [0, 1],
      });

      const { result } = renderHook(() => useRouteOptimization(defaultOptions));

      await act(async () => {
        await result.current.otimizarRota();
      });

      expect(result.current.rotaOtimizada).not.toBeNull();
      expect(result.current.rotaOtimizada?.distanciaAntesKm).toBeNull();
    });

    it('guarda a distancia "antes" tambem quando a rota tem vinculos (retirada->entrega)', async () => {
      const paradasComVinculo: Parada[] = [
        {
          id: 'retirada-1',
          tipo: 'retirada',
          endereco: 'Origem',
          destinatario: 'Fornecedor',
          telefone: '',
          observacoes: '',
          latitude: -23.5,
          longitude: -46.6,
          ordem: 1,
        },
        {
          id: 'entrega-1',
          tipo: 'entrega',
          endereco: 'Destino',
          destinatario: 'Cliente',
          telefone: '',
          observacoes: '',
          latitude: -23.55,
          longitude: -46.65,
          ordem: 2,
          vinculo_parada_id: 'retirada-1',
        },
      ];

      mockGetDirectionsSequential.mockResolvedValueOnce({
        distancia_total_metros: 20000,
        duracao_total_segundos: 1500,
        legs: [],
        polyline: 'antes-com-vinculo',
        ordem_otimizada: [],
      });
      mockOtimizarRotaComDependencias.mockResolvedValueOnce({
        paradasOrdenadas: [{ id: 'retirada-1' }, { id: 'entrega-1' }],
        distanciaTotalMetros: 12000,
        duracaoTotalSegundos: 720,
        polyline: 'polyline_with_deps',
      });

      const options = { ...defaultOptions, paradas: paradasComVinculo };
      const { result } = renderHook(() => useRouteOptimization(options));

      await act(async () => {
        await result.current.otimizarRota();
      });

      expect(mockOtimizarRotaComDependencias).toHaveBeenCalled();
      expect(result.current.rotaOtimizada?.distanciaAntesKm).toBe(20);
    });
  });

  describe('resetOptimization', () => {
    it('should reset rotaOtimizada and ordemManual', async () => {
      const { result } = renderHook(() => useRouteOptimization(defaultOptions));

      // Manually set rotaOtimizada via setRotaOtimizada
      act(() => {
        result.current.setRotaOtimizada({
          distancia_total_metros: 10000,
          duracao_total_segundos: 600,
          legs: [],
          polyline: 'encoded',
        });
        result.current.setOrdemManual(true);
      });

      expect(result.current.rotaOtimizada).not.toBeNull();
      expect(result.current.ordemManual).toBe(true);

      act(() => {
        result.current.resetOptimization();
      });

      expect(result.current.rotaOtimizada).toBeNull();
      expect(result.current.ordemManual).toBe(false);
    });
  });

  describe('setOrdemManual', () => {
    it('should update ordemManual state', () => {
      const { result } = renderHook(() => useRouteOptimization(defaultOptions));

      expect(result.current.ordemManual).toBe(false);

      act(() => {
        result.current.setOrdemManual(true);
      });

      expect(result.current.ordemManual).toBe(true);
    });
  });
});
