/**
 * useIncidentesModals - Tests
 */

import { renderHook, act } from '@testing-library/react-native';

import { useIncidentesModals } from '../useIncidentesModals';

import type { Incidente } from '../types';

// Mock dependencies
const mockShowToast = jest.fn();
jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

const mockFetchIncidentes = jest.fn();
jest.mock('@/lib/queries/incidentes', () => ({
  fetchIncidentesForGestor: (...args: unknown[]) =>
    mockFetchIncidentes(...args),
}));

const mockIncidente: Incidente = {
  id: 'inc-1',
  categoria: 'accident',
  descricao: 'Test incident',
  endereco: 'Test address',
  status: 'aberto',
  foto_url: 'http://example.com/photo.jpg',
  created_at: '2026-01-15T10:00:00Z',
  motorista_nome: 'João Silva',
  motorista_id: 'driver-1',
  unidade_nome: 'Unit Test',
  rota_id: 'route-1',
  rota_data: '2026-01-15',
  parada_endereco: 'Stop address',
  observacoes_gestao: 'Previous observations',
};

const mockIncidentes: Incidente[] = [
  mockIncidente,
  {
    ...mockIncidente,
    id: 'inc-2',
    motorista_id: 'driver-2',
    motorista_nome: 'Maria Santos',
  },
  {
    ...mockIncidente,
    id: 'inc-3',
    motorista_id: 'driver-1',
    descricao: 'Another incident by driver-1',
  },
];

const mockOnStatusUpdate = jest.fn().mockResolvedValue(undefined);

describe('useIncidentesModals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('returns correct initial values', () => {
      const { result } = renderHook(() =>
        useIncidentesModals({
          incidentes: mockIncidentes,
          onStatusUpdate: mockOnStatusUpdate,
        }),
      );

      // Detalhes modal
      expect(result.current.incidenteSelecionado).toBeNull();
      expect(result.current.showDetalhesModal).toBe(false);
      expect(result.current.fotoLoading).toBe(true);
      expect(result.current.fotoError).toBe(false);

      // Status modal
      expect(result.current.showAlterarStatusModal).toBe(false);
      expect(result.current.novoStatus).toBe('');
      expect(result.current.observacoes).toBe('');
      expect(result.current.atualizando).toBe(false);

      // Histórico modal
      expect(result.current.showHistoricoMotoristaModal).toBe(false);
      expect(result.current.motoristaSelecionado).toBeNull();
      expect(result.current.incidentesMotorista).toEqual([]);
      expect(result.current.historicoLoading).toBe(false);
    });
  });

  describe('detalhes modal', () => {
    it('handleVerDetalhes opens modal with incidente', () => {
      const { result } = renderHook(() =>
        useIncidentesModals({
          incidentes: mockIncidentes,
          onStatusUpdate: mockOnStatusUpdate,
        }),
      );

      act(() => {
        result.current.handleVerDetalhes(mockIncidente);
      });

      expect(result.current.incidenteSelecionado).toEqual(mockIncidente);
      expect(result.current.showDetalhesModal).toBe(true);
      expect(result.current.fotoLoading).toBe(true);
      expect(result.current.fotoError).toBe(false);
    });

    it('handleFotoLoad sets loading to false', () => {
      const { result } = renderHook(() =>
        useIncidentesModals({
          incidentes: mockIncidentes,
          onStatusUpdate: mockOnStatusUpdate,
        }),
      );

      act(() => {
        result.current.handleFotoLoad();
      });

      expect(result.current.fotoLoading).toBe(false);
      expect(result.current.fotoError).toBe(false);
    });

    it('handleFotoError sets error state', () => {
      const { result } = renderHook(() =>
        useIncidentesModals({
          incidentes: mockIncidentes,
          onStatusUpdate: mockOnStatusUpdate,
        }),
      );

      act(() => {
        result.current.handleFotoError();
      });

      expect(result.current.fotoLoading).toBe(false);
      expect(result.current.fotoError).toBe(true);
    });

    it('handleFotoRetry resets photo state for a new attempt', () => {
      const { result } = renderHook(() =>
        useIncidentesModals({
          incidentes: mockIncidentes,
          onStatusUpdate: mockOnStatusUpdate,
        }),
      );

      act(() => {
        result.current.handleFotoError();
        result.current.handleFotoRetry();
      });

      expect(result.current.fotoLoading).toBe(true);
      expect(result.current.fotoError).toBe(false);
    });

    it('setShowDetalhesModal works', () => {
      const { result } = renderHook(() =>
        useIncidentesModals({
          incidentes: mockIncidentes,
          onStatusUpdate: mockOnStatusUpdate,
        }),
      );

      act(() => {
        result.current.setShowDetalhesModal(true);
      });

      expect(result.current.showDetalhesModal).toBe(true);

      act(() => {
        result.current.setShowDetalhesModal(false);
      });

      expect(result.current.showDetalhesModal).toBe(false);
    });
  });

  describe('status modal', () => {
    it('handleAlterarStatus opens modal with incidente data', () => {
      const { result } = renderHook(() =>
        useIncidentesModals({
          incidentes: mockIncidentes,
          onStatusUpdate: mockOnStatusUpdate,
        }),
      );

      act(() => {
        result.current.handleAlterarStatus(mockIncidente);
      });

      expect(result.current.incidenteSelecionado).toEqual(mockIncidente);
      expect(result.current.novoStatus).toBe(mockIncidente.status);
      expect(result.current.observacoes).toBe(mockIncidente.observacoes_gestao);
      expect(result.current.showAlterarStatusModal).toBe(true);
    });

    it('setNovoStatus updates status', () => {
      const { result } = renderHook(() =>
        useIncidentesModals({
          incidentes: mockIncidentes,
          onStatusUpdate: mockOnStatusUpdate,
        }),
      );

      act(() => {
        result.current.setNovoStatus('resolvido');
      });

      expect(result.current.novoStatus).toBe('resolvido');
    });

    it('setObservacoes updates observacoes', () => {
      const { result } = renderHook(() =>
        useIncidentesModals({
          incidentes: mockIncidentes,
          onStatusUpdate: mockOnStatusUpdate,
        }),
      );

      act(() => {
        result.current.setObservacoes('New observation');
      });

      expect(result.current.observacoes).toBe('New observation');
    });

    it('setShowAlterarStatusModal works', () => {
      const { result } = renderHook(() =>
        useIncidentesModals({
          incidentes: mockIncidentes,
          onStatusUpdate: mockOnStatusUpdate,
        }),
      );

      act(() => {
        result.current.setShowAlterarStatusModal(true);
      });

      expect(result.current.showAlterarStatusModal).toBe(true);
    });
  });

  describe('histórico motorista modal', () => {
    const driver1Incidents: Incidente[] = [
      mockIncidente,
      { ...mockIncidente, id: 'inc-3', descricao: 'Another incident' },
    ];

    it('fetches from Supabase with correct motorista ID', async () => {
      mockFetchIncidentes.mockResolvedValue({
        success: true,
        data: driver1Incidents,
      });

      const { result } = renderHook(() =>
        useIncidentesModals({
          incidentes: mockIncidentes,
          onStatusUpdate: mockOnStatusUpdate,
        }),
      );

      await act(async () => {
        await result.current.handleVerHistoricoMotorista(
          'driver-1',
          'João Silva',
        );
      });

      expect(mockFetchIncidentes).toHaveBeenCalledWith({
        motoristasIds: ['driver-1'],
      });
    });

    it('opens modal and sets motorista data', async () => {
      mockFetchIncidentes.mockResolvedValue({
        success: true,
        data: driver1Incidents,
      });

      const { result } = renderHook(() =>
        useIncidentesModals({
          incidentes: mockIncidentes,
          onStatusUpdate: mockOnStatusUpdate,
        }),
      );

      await act(async () => {
        await result.current.handleVerHistoricoMotorista(
          'driver-1',
          'João Silva',
        );
      });

      expect(result.current.motoristaSelecionado).toEqual({
        id: 'driver-1',
        nome: 'João Silva',
      });
      expect(result.current.showHistoricoMotoristaModal).toBe(true);
      expect(result.current.incidentesMotorista).toEqual(driver1Incidents);
    });

    it('historicoLoading is true during fetch', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchIncidentes.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
      );

      const { result } = renderHook(() =>
        useIncidentesModals({
          incidentes: mockIncidentes,
          onStatusUpdate: mockOnStatusUpdate,
        }),
      );

      // Start the fetch (don't await)
      let fetchPromise: Promise<void>;
      act(() => {
        fetchPromise = result.current.handleVerHistoricoMotorista(
          'driver-1',
          'João',
        );
      });

      // Loading should be true while waiting
      expect(result.current.historicoLoading).toBe(true);

      // Resolve and complete
      await act(async () => {
        resolvePromise!({ success: true, data: [] });
        await fetchPromise!;
      });

      expect(result.current.historicoLoading).toBe(false);
    });

    it('shows toast on fetch error', async () => {
      mockFetchIncidentes.mockResolvedValue({
        success: false,
        error: new Error('Network error'),
      });

      const { result } = renderHook(() =>
        useIncidentesModals({
          incidentes: mockIncidentes,
          onStatusUpdate: mockOnStatusUpdate,
        }),
      );

      await act(async () => {
        await result.current.handleVerHistoricoMotorista(
          'driver-1',
          'João Silva',
        );
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Erro ao carregar histórico',
        'error',
      );
      expect(result.current.incidentesMotorista).toEqual([]);
      expect(result.current.historicoLoading).toBe(false);
    });

    it('clears previous data before fetching', async () => {
      mockFetchIncidentes.mockResolvedValue({
        success: true,
        data: driver1Incidents,
      });

      const { result } = renderHook(() =>
        useIncidentesModals({
          incidentes: mockIncidentes,
          onStatusUpdate: mockOnStatusUpdate,
        }),
      );

      // First fetch
      await act(async () => {
        await result.current.handleVerHistoricoMotorista(
          'driver-1',
          'João Silva',
        );
      });
      expect(result.current.incidentesMotorista).toHaveLength(2);

      // Second fetch - data should be cleared before loading
      mockFetchIncidentes.mockResolvedValue({ success: true, data: [] });
      await act(async () => {
        await result.current.handleVerHistoricoMotorista('driver-2', 'Maria');
      });

      expect(result.current.incidentesMotorista).toEqual([]);
    });

    it('setShowHistoricoMotoristaModal works', () => {
      const { result } = renderHook(() =>
        useIncidentesModals({
          incidentes: mockIncidentes,
          onStatusUpdate: mockOnStatusUpdate,
        }),
      );

      act(() => {
        result.current.setShowHistoricoMotoristaModal(true);
      });

      expect(result.current.showHistoricoMotoristaModal).toBe(true);
    });
  });
});
