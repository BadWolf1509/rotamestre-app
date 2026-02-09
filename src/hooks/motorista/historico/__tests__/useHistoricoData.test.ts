/**
 * Tests for useHistoricoData hook
 *
 * Mocks: useUser, supabase, useAlert (global), logger
 */
import { renderHook, waitFor } from '@testing-library/react-native';

// --- Supabase mock chain ---
const mockOrder2 = jest.fn();
const mockOrder1 = jest.fn(() => ({ order: mockOrder2 }));
const mockEq = jest.fn(() => ({ order: mockOrder1 }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));

const mockIn = jest.fn();
const mockParadasSelect = jest.fn(() => ({ in: mockIn }));

const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const mockUserData = { id: 'user-1', papel: 'motorista' };
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: mockUserData }),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { logger } from '@/lib/logger';

import { useHistoricoData } from '../useHistoricoData';

const mockShowError = (global as any).mockUseAlert.showError;

describe('useHistoricoData', () => {
  const rotasData = [
    {
      id: 'rota-1',
      data: '2026-01-15',
      status: 'concluida',
      distancia_total: 12.5,
      iniciada_em: '2026-01-15T08:00:00Z',
      concluida_em: '2026-01-15T10:00:00Z',
      unidades: { nome: 'Unidade A' },
    },
    {
      id: 'rota-2',
      data: '2026-01-14',
      status: 'pendente',
      distancia_total: null,
      iniciada_em: null,
      concluida_em: null,
      unidades: { nome: 'Unidade A' },
    },
  ];

  const paradasData = [
    { rota_id: 'rota-1', id: 'p1', status: 'concluida', is_checkpoint: null },
    { rota_id: 'rota-1', id: 'p2', status: 'concluida', is_checkpoint: null },
    { rota_id: 'rota-1', id: 'p3', status: 'pendente', is_checkpoint: null },
    { rota_id: 'rota-2', id: 'p4', status: 'pendente', is_checkpoint: null },
    { rota_id: 'rota-2', id: 'p5', status: 'pendente', is_checkpoint: false }, // checkpoint → excluded
  ];

  function setupSuccessMocks() {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'rotas') {
        return { select: mockSelect };
      }
      return { select: mockParadasSelect };
    });
    mockOrder2.mockResolvedValue({ data: rotasData, error: null });
    mockIn.mockResolvedValue({ data: paradasData, error: null });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserData.id = 'user-1';
    setupSuccessMocks();
  });

  describe('successful loading', () => {
    it('loads routes and enriches with paradas counts', async () => {
      const { result } = renderHook(() => useHistoricoData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.rotas).toHaveLength(2);
      // rota-1: 3 paradas (p1,p2,p3 — p3 not checkpoint:false), 2 concluidas
      expect(result.current.rotas[0]).toMatchObject({
        id: 'rota-1',
        paradas_count: 3,
        paradas_concluidas: 2,
      });
      // rota-2: 1 real parada (p5 has is_checkpoint:false → excluded), 0 concluidas
      expect(result.current.rotas[1]).toMatchObject({
        id: 'rota-2',
        paradas_count: 1,
        paradas_concluidas: 0,
      });
    });

    it('calls supabase with correct motorista_id', async () => {
      renderHook(() => useHistoricoData());

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('rotas');
      });

      expect(mockEq).toHaveBeenCalledWith('motorista_id', 'user-1');
    });

    it('fetches paradas for all route ids', async () => {
      renderHook(() => useHistoricoData());

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('paradas');
      });

      expect(mockIn).toHaveBeenCalledWith('rota_id', ['rota-1', 'rota-2']);
    });

    it('starts in loading state', () => {
      const { result } = renderHook(() => useHistoricoData());
      expect(result.current.loading).toBe(true);
      expect(result.current.rotas).toEqual([]);
    });
  });

  describe('empty results', () => {
    it('sets empty array when no routes found', async () => {
      mockOrder2.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useHistoricoData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.rotas).toEqual([]);
    });

    it('sets empty array when rotasData is null', async () => {
      mockOrder2.mockResolvedValue({ data: null, error: null });

      const { result } = renderHook(() => useHistoricoData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.rotas).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('shows error alert on rotas query failure', async () => {
      mockOrder2.mockResolvedValue({ data: null, error: { message: 'Network error' } });

      const { result } = renderHook(() => useHistoricoData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Erro ao carregar histórico',
        expect.anything(),
      );
      expect(mockShowError).toHaveBeenCalledWith({
        title: 'Erro',
        message: 'Não foi possível carregar o histórico',
      });
    });

    it('logs error but continues when paradas query fails', async () => {
      mockIn.mockResolvedValue({ data: null, error: { message: 'Paradas error' } });

      const { result } = renderHook(() => useHistoricoData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(logger.error).toHaveBeenCalledWith('Erro ao buscar paradas', expect.anything());
      // Routes still returned with 0 paradas
      expect(result.current.rotas).toHaveLength(2);
      expect(result.current.rotas[0].paradas_count).toBe(0);
    });
  });

  describe('no user data', () => {
    it('sets empty routes when userData is null', async () => {
      mockUserData.id = undefined as any;

      const { result } = renderHook(() => useHistoricoData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.rotas).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('sets refreshing true then false after reload', async () => {
      const { result } = renderHook(() => useHistoricoData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      jest.clearAllMocks();
      setupSuccessMocks();

      result.current.onRefresh();

      await waitFor(() => {
        expect(result.current.refreshing).toBe(false);
        expect(result.current.loading).toBe(false);
      });

      // Verify data was reloaded
      expect(mockFrom).toHaveBeenCalledWith('rotas');
      expect(result.current.rotas).toHaveLength(2);
    });
  });

  describe('checkpoint filtering', () => {
    it('counts paradas where is_checkpoint is not false', async () => {
      const customParadas = [
        { rota_id: 'rota-1', id: 'p1', status: 'concluida', is_checkpoint: true },
        { rota_id: 'rota-1', id: 'p2', status: 'concluida', is_checkpoint: null },
        { rota_id: 'rota-1', id: 'p3', status: 'pendente', is_checkpoint: false }, // excluded
        { rota_id: 'rota-1', id: 'p4', status: 'concluida', is_checkpoint: false }, // excluded
      ];
      mockIn.mockResolvedValue({ data: customParadas, error: null });

      const { result } = renderHook(() => useHistoricoData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Only p1 and p2 count (is_checkpoint !== false)
      expect(result.current.rotas[0].paradas_count).toBe(2);
      expect(result.current.rotas[0].paradas_concluidas).toBe(2);
    });
  });

  describe('AlertDialog', () => {
    it('provides AlertDialog from useAlert', () => {
      const { result } = renderHook(() => useHistoricoData());
      expect(result.current.AlertDialog).toBeDefined();
    });
  });
});
