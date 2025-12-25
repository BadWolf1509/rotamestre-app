/**
 * Tests for useMilestones.ts
 * Hook para calcular milestones em tempo real
 */

import { renderHook, waitFor } from '@testing-library/react-native';

import {
  useMilestones,
  checkNewMilestone,
  getMilestoneProgressText,
  getMilestoneColor,
} from '../useMilestones';

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

describe('checkNewMilestone', () => {
  it('should return milestone when just reached', () => {
    expect(checkNewMilestone(9, 10)).toBe(10);
    expect(checkNewMilestone(24, 25)).toBe(25);
    expect(checkNewMilestone(49, 50)).toBe(50);
    expect(checkNewMilestone(99, 100)).toBe(100);
  });

  it('should return null when no new milestone', () => {
    expect(checkNewMilestone(5, 8)).toBeNull();
    expect(checkNewMilestone(15, 20)).toBeNull();
    expect(checkNewMilestone(100, 150)).toBeNull();
  });

  it('should return first milestone crossed when jumping over', () => {
    // Jump from 8 to 12 - should return 10
    expect(checkNewMilestone(8, 12)).toBe(10);
  });

  it('should handle edge case at 0', () => {
    expect(checkNewMilestone(0, 10)).toBe(10);
    expect(checkNewMilestone(0, 5)).toBeNull();
  });

  it('should handle same values', () => {
    expect(checkNewMilestone(10, 10)).toBeNull();
  });
});

describe('getMilestoneProgressText', () => {
  it('should show loading text', () => {
    const data = {
      isLoading: true,
      error: null,
      totalEntregas: 0,
      nextMilestone: 10,
      currentMilestone: null,
      progress: 0,
      remaining: 10,
      weeklyData: [],
      averagePerDay: 0,
      bestDay: 0,
      totalRotas: 0,
    };

    expect(getMilestoneProgressText(data)).toBe('Carregando...');
  });

  it('should show error text', () => {
    const data = {
      isLoading: false,
      error: 'Some error',
      totalEntregas: 0,
      nextMilestone: 10,
      currentMilestone: null,
      progress: 0,
      remaining: 10,
      weeklyData: [],
      averagePerDay: 0,
      bestDay: 0,
      totalRotas: 0,
    };

    expect(getMilestoneProgressText(data)).toBe('Erro ao carregar');
  });

  it('should show mestre text when all milestones achieved', () => {
    const data = {
      isLoading: false,
      error: null,
      totalEntregas: 1500,
      nextMilestone: null,
      currentMilestone: 1000,
      progress: 100,
      remaining: 0,
      weeklyData: [],
      averagePerDay: 0,
      bestDay: 0,
      totalRotas: 0,
    };

    expect(getMilestoneProgressText(data)).toBe('1500 entregas - Mestre!');
  });

  it('should show progress towards next milestone', () => {
    const data = {
      isLoading: false,
      error: null,
      totalEntregas: 35,
      nextMilestone: 50,
      currentMilestone: 25,
      progress: 40,
      remaining: 15,
      weeklyData: [],
      averagePerDay: 0,
      bestDay: 0,
      totalRotas: 0,
    };

    expect(getMilestoneProgressText(data)).toBe('35/50 entregas');
  });
});

describe('getMilestoneColor', () => {
  it('should return success for progress >= 90', () => {
    expect(getMilestoneColor(90)).toBe('success');
    expect(getMilestoneColor(95)).toBe('success');
    expect(getMilestoneColor(100)).toBe('success');
  });

  it('should return primary for progress >= 50 and < 90', () => {
    expect(getMilestoneColor(50)).toBe('primary');
    expect(getMilestoneColor(70)).toBe('primary');
    expect(getMilestoneColor(89)).toBe('primary');
  });

  it('should return warning for progress < 50', () => {
    expect(getMilestoneColor(0)).toBe('warning');
    expect(getMilestoneColor(25)).toBe('warning');
    expect(getMilestoneColor(49)).toBe('warning');
  });
});
