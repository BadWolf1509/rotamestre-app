import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, InteractionManager } from 'react-native';

import PerformanceOptimizer from '@/services/performanceOptimizer';

interface PerformanceHookOptions {
  trackScreenLoad?: boolean;
  trackApiCalls?: boolean;
  enableOptimizations?: boolean;
  screenName?: string;
}

interface PerformanceMetrics {
  screenLoadTime: number;
  memoryUsage: number;
  isOnline: boolean;
  connectionType: string | null;
}

export function usePerformance(options: PerformanceHookOptions = {}) {
  const {
    trackScreenLoad = true,
    trackApiCalls = true,
    enableOptimizations = true,
    screenName = 'Unknown',
  } = options;

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    screenLoadTime: 0,
    memoryUsage: 0,
    isOnline: true,
    connectionType: null,
  });

  const screenLoadStartTime = useRef<number>(Date.now());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (appStateRef.current === 'background' && nextAppState === 'active') {
      // App came to foreground - refresh data if needed
      if (enableOptimizations) {
        PerformanceOptimizer.deferOperation(() => {
          // Refresh data if needed
        });
      }
    }
    appStateRef.current = nextAppState;
  }, [enableOptimizations]);

  useEffect(() => {
    // Track screen load time
    if (trackScreenLoad) {
      InteractionManager.runAfterInteractions(() => {
        const loadTime = Date.now() - screenLoadStartTime.current;
        PerformanceOptimizer.trackScreenLoad(screenName, screenLoadStartTime.current);
        setMetrics(prev => ({ ...prev, screenLoadTime: loadTime }));
      });
    }

    // Monitor app state changes
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Monitor network connectivity
    const netInfoUnsubscribe = NetInfo.addEventListener(state => {
      setMetrics(prev => ({
        ...prev,
        isOnline: state.isConnected ?? false,
        connectionType: state.type,
      }));
    });

    // Monitor memory usage (if available)
    const memoryInterval = setInterval(() => {
      if ((global as any).performance?.memory) {
        const memInfo = (global as any).performance.memory;
        setMetrics(prev => ({
          ...prev,
          memoryUsage: memInfo.usedJSHeapSize / 1048576, // Convert to MB
        }));
      }
    }, 10000); // Check every 10 seconds

    return () => {
      appStateSubscription.remove();
      netInfoUnsubscribe();
      clearInterval(memoryInterval);
    };
  }, [handleAppStateChange, screenName, trackScreenLoad]);

  // Optimized API call wrapper
  const optimizedApiCall = useCallback(
    async <T,>(
      apiCall: () => Promise<T>,
      options: {
        cacheKey?: string;
        cacheTTL?: number;
        priority?: 'high' | 'normal' | 'low';
      } = {}
    ): Promise<T> => {
      const { cacheKey, cacheTTL, priority: _priority = 'normal' } = options;

      if (!trackApiCalls) {
        return apiCall();
      }

      const startTime = Date.now();

      try {
        // Check cache first
        if (cacheKey && enableOptimizations) {
          const cached = await PerformanceOptimizer.getCachedData(cacheKey);
          if (cached) {
            return cached as T;
          }
        }

        // Make API call with performance tracking
        const data = await apiCall();

        // Track response time
        const duration = Date.now() - startTime;
        PerformanceOptimizer.trackApiResponse(cacheKey || 'unknown', duration);

        // Cache result if needed
        if (cacheKey && enableOptimizations) {
          await PerformanceOptimizer.cacheData(cacheKey, data, cacheTTL);
        }

        return data;
      } catch (error) {
        console.error('API call failed:', error);
        throw error;
      }
    },
    [trackApiCalls, enableOptimizations]
  );

  // Batch multiple API calls
  const batchApiCalls = useCallback(
    async <T,>(
      endpoint: string,
      params: any
    ): Promise<T> => {
      if (!enableOptimizations) {
        // Fallback to regular API call
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        return response.json();
      }

      return PerformanceOptimizer.batchRequest(endpoint, params) as Promise<T>;
    },
    [enableOptimizations]
  );

  // Defer heavy operations
  const deferOperation = useCallback(
    async (
      operation: () => void | Promise<void>,
      priority: 'high' | 'normal' | 'low' = 'normal'
    ) => {
      if (!enableOptimizations) {
        return operation();
      }

      return PerformanceOptimizer.deferOperation(operation, priority);
    },
    [enableOptimizations]
  );

  // Get optimized image URL
  const getOptimizedImageUrl = useCallback(
    (url: string, width?: number, height?: number): string => {
      if (!enableOptimizations) {
        return url;
      }

      return PerformanceOptimizer.getOptimizedImageUrl(url, width, height);
    },
    [enableOptimizations]
  );

  // Clear cache
  const clearCache = useCallback(async () => {
    await PerformanceOptimizer.clearAllCaches();
  }, []);

  // Get performance report
  const getPerformanceReport = useCallback(() => {
    return PerformanceOptimizer.getPerformanceReport();
  }, []);

  return {
    metrics,
    optimizedApiCall,
    batchApiCalls,
    deferOperation,
    getOptimizedImageUrl,
    clearCache,
    getPerformanceReport,
  };
}

// Hook for monitoring render performance
export function useRenderPerformance(componentName: string) {
  const renderCount = useRef(0);
  const renderTimes = useRef<number[]>([]);
  const lastRenderTime = useRef(Date.now());

  useEffect(() => {
    renderCount.current++;
    const now = Date.now();
    const renderTime = now - lastRenderTime.current;
    renderTimes.current.push(renderTime);

    // Keep only last 10 renders
    if (renderTimes.current.length > 10) {
      renderTimes.current.shift();
    }

    // Log if component is re-rendering too frequently
    if (renderCount.current > 1 && renderTime < 100) {
      console.warn(`${componentName} is re-rendering frequently: ${renderTime}ms since last render`);
    }

    lastRenderTime.current = now;
  });

  const getAverageRenderTime = () => {
    if (renderTimes.current.length === 0) return 0;
    const sum = renderTimes.current.reduce((a, b) => a + b, 0);
    return sum / renderTimes.current.length;
  };

  return {
    renderCount: renderCount.current,
    averageRenderTime: getAverageRenderTime(),
    lastRenderTime: renderTimes.current[renderTimes.current.length - 1] || 0,
  };
}

// Hook for lazy loading components
export function useLazyComponent<T>(
  importFn: () => Promise<{ default: T }>,
  options: {
    preload?: boolean;
    delay?: number;
  } = {}
) {
  const { preload = false, delay = 0 } = options;
  const [Component, setComponent] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadComponent = useCallback(async () => {
    if (Component || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const module = await importFn();
      setComponent(() => module.default);
    } catch (err) {
      console.error('Failed to load component:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [Component, isLoading, delay, importFn]);

  useEffect(() => {
    if (preload) {
      loadComponent();
    }
  }, [loadComponent, preload]);

  return {
    Component,
    isLoading,
    error,
    loadComponent,
  };
}

// Hook for detecting memory leaks
export function useMemoryLeakDetector(componentName: string) {
  const mountTime = useRef(Date.now());
  const activeTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const activeIntervals = useRef<Set<ReturnType<typeof setInterval>>>(new Set());
  const activePromises = useRef<Set<Promise<any>>>(new Set());

  // Override setTimeout to track timers
  const safeSetTimeout = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      activeTimers.current.delete(timer);
      callback();
    }, delay);
    activeTimers.current.add(timer);
    return timer;
  }, []);

  // Override setInterval to track intervals
  const safeSetInterval = useCallback((callback: () => void, delay: number) => {
    const interval = setInterval(callback, delay);
    activeIntervals.current.add(interval);
    return interval;
  }, []);

  // Track promises
  const trackPromise = useCallback(<T,>(promise: Promise<T>): Promise<T> => {
    activePromises.current.add(promise);
    return promise.finally(() => {
      activePromises.current.delete(promise);
    });
  }, []);

  useEffect(() => {
    const mountedAt = mountTime.current;
    const timersRef = activeTimers.current;
    const intervalsRef = activeIntervals.current;
    const promisesRef = activePromises.current;

    return () => {
      // Check for memory leaks on unmount
      const lifetime = Date.now() - mountedAt;

      if (timersRef.size > 0) {
        console.warn(
          `${componentName}: ${timersRef.size} timer(s) not cleared after ${lifetime}ms`
        );
        timersRef.forEach(timer => clearTimeout(timer));
      }

      if (intervalsRef.size > 0) {
        console.warn(
          `${componentName}: ${intervalsRef.size} interval(s) not cleared after ${lifetime}ms`
        );
        intervalsRef.forEach(interval => clearInterval(interval));
      }

      if (promisesRef.size > 0) {
        console.warn(
          `${componentName}: ${promisesRef.size} promise(s) still pending after ${lifetime}ms`
        );
      }
    };
  }, [componentName]);

  return {
    setTimeout: safeSetTimeout,
    setInterval: safeSetInterval,
    trackPromise,
  };
}
