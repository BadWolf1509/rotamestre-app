/**
 * Tests for useNetworkStatus.ts
 * Hook para monitorar status de conectividade de rede
 */

import { renderHook, waitFor } from '@testing-library/react-native';

import { useNetworkStatus, useIsOnline } from '../useNetworkStatus';

// Mock NetInfo
const mockFetch = jest.fn();
const mockAddEventListener = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({
  NetInfoStateType: {
    wifi: 'wifi',
    cellular: 'cellular',
    ethernet: 'ethernet',
    none: 'none',
    unknown: 'unknown',
  },
  fetch: () => mockFetch(),
  addEventListener: (callback: any) => {
    mockAddEventListener(callback);
    return () => {}; // Return unsubscribe function
  },
}));

describe('useNetworkStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default to connected wifi
    mockFetch.mockResolvedValue({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
    });
  });

  describe('Initial state', () => {
    it('should have default connected state', () => {
      const { result } = renderHook(() => useNetworkStatus());

      // Initial state before fetch completes
      expect(result.current.isConnected).toBe(true);
      expect(result.current.connectionType).toBe('unknown');
    });

    it('should fetch initial network state', async () => {
      mockFetch.mockResolvedValue({
        type: 'wifi',
        isConnected: true,
        isInternetReachable: true,
      });

      const { result } = renderHook(() => useNetworkStatus());

      await waitFor(() => {
        expect(result.current.connectionType).toBe('wifi');
      });

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Connection types', () => {
    it('should detect wifi connection', async () => {
      mockFetch.mockResolvedValue({
        type: 'wifi',
        isConnected: true,
        isInternetReachable: true,
      });

      const { result } = renderHook(() => useNetworkStatus());

      await waitFor(() => {
        expect(result.current.isWifi).toBe(true);
        expect(result.current.isCellular).toBe(false);
        expect(result.current.connectionType).toBe('wifi');
      });
    });

    it('should detect cellular connection', async () => {
      mockFetch.mockResolvedValue({
        type: 'cellular',
        isConnected: true,
        isInternetReachable: true,
      });

      const { result } = renderHook(() => useNetworkStatus());

      await waitFor(() => {
        expect(result.current.isCellular).toBe(true);
        expect(result.current.isWifi).toBe(false);
        expect(result.current.connectionType).toBe('cellular');
      });
    });

    it('should detect ethernet connection', async () => {
      mockFetch.mockResolvedValue({
        type: 'ethernet',
        isConnected: true,
        isInternetReachable: true,
      });

      const { result } = renderHook(() => useNetworkStatus());

      await waitFor(() => {
        expect(result.current.connectionType).toBe('ethernet');
        expect(result.current.isConnected).toBe(true);
      });
    });

    it('should detect no connection', async () => {
      mockFetch.mockResolvedValue({
        type: 'none',
        isConnected: false,
        isInternetReachable: false,
      });

      const { result } = renderHook(() => useNetworkStatus());

      await waitFor(() => {
        expect(result.current.connectionType).toBe('none');
        expect(result.current.isConnected).toBe(false);
      });
    });

    it('should handle unknown connection type', async () => {
      mockFetch.mockResolvedValue({
        type: 'bluetooth', // Unknown type
        isConnected: true,
        isInternetReachable: null,
      });

      const { result } = renderHook(() => useNetworkStatus());

      await waitFor(() => {
        expect(result.current.connectionType).toBe('unknown');
      });
    });
  });

  describe('Internet reachability', () => {
    it('should track isInternetReachable', async () => {
      mockFetch.mockResolvedValue({
        type: 'wifi',
        isConnected: true,
        isInternetReachable: true,
      });

      const { result } = renderHook(() => useNetworkStatus());

      await waitFor(() => {
        expect(result.current.isInternetReachable).toBe(true);
      });
    });

    it('should handle null isInternetReachable', async () => {
      mockFetch.mockResolvedValue({
        type: 'wifi',
        isConnected: true,
        isInternetReachable: null,
      });

      const { result } = renderHook(() => useNetworkStatus());

      await waitFor(() => {
        expect(result.current.isInternetReachable).toBeNull();
      });
    });
  });

  describe('Event listener', () => {
    it('should subscribe to network changes', () => {
      renderHook(() => useNetworkStatus());

      expect(mockAddEventListener).toHaveBeenCalled();
    });
  });

  describe('Details', () => {
    it('should store full NetInfo state in details', async () => {
      const mockState = {
        type: 'wifi',
        isConnected: true,
        isInternetReachable: true,
        details: { ssid: 'TestNetwork' },
      };
      mockFetch.mockResolvedValue(mockState);

      const { result } = renderHook(() => useNetworkStatus());

      await waitFor(() => {
        expect(result.current.details).toEqual(mockState);
      });
    });
  });
});

describe('useIsOnline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return true when connected and reachable', async () => {
    mockFetch.mockResolvedValue({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
    });

    const { result } = renderHook(() => useIsOnline());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('should return false when not connected', async () => {
    mockFetch.mockResolvedValue({
      type: 'none',
      isConnected: false,
      isInternetReachable: false,
    });

    const { result } = renderHook(() => useIsOnline());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it('should return false when connected but not reachable', async () => {
    mockFetch.mockResolvedValue({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: false,
    });

    const { result } = renderHook(() => useIsOnline());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it('should use isConnected when isInternetReachable is null', async () => {
    mockFetch.mockResolvedValue({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: null,
    });

    const { result } = renderHook(() => useIsOnline());

    await waitFor(() => {
      // Should fallback to isConnected when isInternetReachable is null
      expect(result.current).toBe(true);
    });
  });
});
