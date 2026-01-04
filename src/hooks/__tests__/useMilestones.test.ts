/**
 * Tests for useMilestones.ts
 * Hook para calcular milestones em tempo real
 */

import { renderHook, waitFor } from '@testing-library/react-native';

import { useMilestones } from '../useMilestones';

// Mock Supabase
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockIn = jest.fn();
const mockGte = jest.fn();
const mockOrder = jest.fn();
const mockOr = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: mockSelect,
    })),
  },
}));

describe('useMilestones', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup chain mocks
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ eq: mockEq, in: mockIn, gte: mockGte, or: mockOr });
    mockIn.mockReturnValue({ eq: mockEq, or: mockOr });
    mockGte.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockOr.mockResolvedValue({ count: 0, error: null });
  });

  describe('Initial state', () => {
    it('should start with loading state', () => {
      const { result } = renderHook(() =>
        useMilestones({ motoristaId: 'driver-1' })
      );

      expect(result.current.isLoading).toBe(true);
    });

    it('should have default values', () => {
      const { result } = renderHook(() =>
        useMilestones({ motoristaId: 'driver-1' })
      );

      expect(result.current.totalEntregas).toBe(0);
      expect(result.current.currentMilestone).toBeNull();
      expect(result.current.nextMilestone).toBe(10);
      expect(result.current.progress).toBe(0);
      expect(result.current.remaining).toBe(10);
    });
  });

  describe('Without motorista', () => {
    it('should not load when motoristaId is undefined', async () => {
      const { result } = renderHook(() => useMilestones({}));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockSelect).not.toHaveBeenCalled();
    });

    it('should not load when enabled is false', async () => {
      const { result } = renderHook(() =>
        useMilestones({ motoristaId: 'driver-1', enabled: false })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockSelect).not.toHaveBeenCalled();
    });
  });

  describe('Milestone calculations', () => {
    it('should keep default values when no completed routes', async () => {
      // Mock: no completed routes
      mockEq.mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const { result } = renderHook(() =>
        useMilestones({ motoristaId: 'driver-1' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // With no routes, should have 0 deliveries
      expect(result.current.totalEntregas).toBe(0);
      expect(result.current.currentMilestone).toBeNull();
      expect(result.current.nextMilestone).toBe(10);
    });
  });

  describe('Error handling', () => {
    it('should set error state on query failure', async () => {
      mockEq.mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Query failed' },
        }),
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() =>
        useMilestones({ motoristaId: 'driver-1' })
      );

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Weekly data', () => {
    it('should initialize with empty weekly data', () => {
      const { result } = renderHook(() =>
        useMilestones({ motoristaId: 'driver-1' })
      );

      expect(result.current.weeklyData).toEqual([]);
    });
  });
});
