import { InteractionManager, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

/**
 * Performance Optimizer Service
 * Implements various optimization strategies to improve app performance
 */

interface PerformanceMetrics {
  appLaunchTime: number;
  screenLoadTime: Record<string, number>;
  apiResponseTime: Record<string, number[]>;
  memoryUsage: number;
  jsFramerate: number;
}

interface CacheConfig {
  maxSize: number; // MB
  ttl: number; // milliseconds
  strategy: 'LRU' | 'FIFO';
}

interface OptimizationSettings {
  enableLazyLoading: boolean;
  enableImageOptimization: boolean;
  enableDataCaching: boolean;
  enableBatchRequests: boolean;
  enableOfflineMode: boolean;
  cacheConfig: CacheConfig;
}

class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private metrics: PerformanceMetrics;
  private settings: OptimizationSettings;
  private cache: Map<string, { data: any; timestamp: number; size: number }>;
  private requestQueue: Map<string, Promise<any>>;
  private pendingBatch: { endpoint: string; params: any; resolve: Function; reject: Function }[];
  private batchTimer: NodeJS.Timeout | null = null;
  private isOnline: boolean = true;

  private constructor() {
    this.metrics = {
      appLaunchTime: 0,
      screenLoadTime: {},
      apiResponseTime: {},
      memoryUsage: 0,
      jsFramerate: 60,
    };

    this.settings = {
      enableLazyLoading: true,
      enableImageOptimization: true,
      enableDataCaching: true,
      enableBatchRequests: true,
      enableOfflineMode: true,
      cacheConfig: {
        maxSize: 50, // 50MB
        ttl: 5 * 60 * 1000, // 5 minutes
        strategy: 'LRU',
      },
    };

    this.cache = new Map();
    this.requestQueue = new Map();
    this.pendingBatch = [];

    this.initializeMonitoring();
  }

  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  // Initialize performance monitoring
  private async initializeMonitoring() {
    // Monitor network connectivity
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected ?? false;
      if (this.isOnline) {
        this.syncOfflineData();
      }
    });

    // Load settings from storage
    await this.loadSettings();

    // Start memory monitoring
    if (Platform.OS === 'android') {
      this.startMemoryMonitoring();
    }
  }

  // Load settings from AsyncStorage
  private async loadSettings() {
    try {
      const stored = await AsyncStorage.getItem('performanceSettings');
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Error loading performance settings:', error);
    }
  }

  // Save settings to AsyncStorage
  async updateSettings(settings: Partial<OptimizationSettings>) {
    this.settings = { ...this.settings, ...settings };
    try {
      await AsyncStorage.setItem('performanceSettings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Error saving performance settings:', error);
    }
  }

  // Monitor memory usage
  private startMemoryMonitoring() {
    setInterval(() => {
      if ((global as any).performance && (global as any).performance.memory) {
        const memInfo = (global as any).performance.memory;
        this.metrics.memoryUsage = memInfo.usedJSHeapSize / 1048576; // Convert to MB

        // Trigger cleanup if memory usage is high
        if (this.metrics.memoryUsage > 100) { // 100MB threshold
          this.performMemoryCleanup();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  // Cleanup memory
  private performMemoryCleanup() {
    // Clear old cache entries
    this.cleanupCache();

    // Trigger garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  // Cache management with LRU strategy
  async cacheData(key: string, data: any, ttl?: number): Promise<void> {
    if (!this.settings.enableDataCaching) return;

    const size = JSON.stringify(data).length / 1024; // Size in KB
    const timestamp = Date.now();
    const expirationTime = ttl || this.settings.cacheConfig.ttl;

    // Check cache size limit
    const currentSize = this.calculateCacheSize();
    if (currentSize + size > this.settings.cacheConfig.maxSize * 1024) {
      this.cleanupCache();
    }

    this.cache.set(key, { data, timestamp, size });

    // Also persist important data to AsyncStorage for offline access
    if (this.settings.enableOfflineMode) {
      try {
        await AsyncStorage.setItem(`cache_${key}`, JSON.stringify({ data, timestamp }));
      } catch (error) {
        console.error('Error persisting cache:', error);
      }
    }
  }

  // Get cached data
  async getCachedData(key: string): Promise<any | null> {
    if (!this.settings.enableDataCaching) return null;

    // Check in-memory cache first
    const cached = this.cache.get(key);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.settings.cacheConfig.ttl) {
        // Update access time for LRU
        if (this.settings.cacheConfig.strategy === 'LRU') {
          cached.timestamp = Date.now();
        }
        return cached.data;
      } else {
        // Cache expired
        this.cache.delete(key);
      }
    }

    // Check persistent cache if offline mode is enabled
    if (this.settings.enableOfflineMode) {
      try {
        const stored = await AsyncStorage.getItem(`cache_${key}`);
        if (stored) {
          const { data, timestamp } = JSON.parse(stored);
          const age = Date.now() - timestamp;
          if (age < this.settings.cacheConfig.ttl * 2) { // More lenient for offline
            return data;
          }
        }
      } catch (error) {
        console.error('Error reading cache:', error);
      }
    }

    return null;
  }

  // Calculate total cache size
  private calculateCacheSize(): number {
    let totalSize = 0;
    this.cache.forEach(item => {
      totalSize += item.size;
    });
    return totalSize;
  }

  // Cleanup old cache entries
  private cleanupCache() {
    const now = Date.now();
    const ttl = this.settings.cacheConfig.ttl;

    // Remove expired entries
    const keysToDelete: string[] = [];
    this.cache.forEach((item, key) => {
      if (now - item.timestamp > ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));

    // If still over limit, remove oldest entries (LRU/FIFO)
    const maxSize = this.settings.cacheConfig.maxSize * 1024;
    if (this.calculateCacheSize() > maxSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      let currentSize = this.calculateCacheSize();
      for (const [key, item] of entries) {
        if (currentSize <= maxSize * 0.8) break; // Keep 80% of max size
        this.cache.delete(key);
        currentSize -= item.size;
      }
    }
  }

  // Batch API requests
  async batchRequest(endpoint: string, params: any): Promise<any> {
    if (!this.settings.enableBatchRequests) {
      // Fallback to regular request
      return this.makeRequest(endpoint, params);
    }

    return new Promise((resolve, reject) => {
      this.pendingBatch.push({ endpoint, params, resolve, reject });

      // Clear existing timer
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }

      // Set new timer for batch execution
      this.batchTimer = setTimeout(() => {
        this.executeBatch();
      }, 100); // 100ms debounce

      // Execute immediately if batch is large
      if (this.pendingBatch.length >= 10) {
        this.executeBatch();
      }
    });
  }

  // Execute batched requests
  private async executeBatch() {
    if (this.pendingBatch.length === 0) return;

    const batch = [...this.pendingBatch];
    this.pendingBatch = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      // Group by endpoint
      const grouped = batch.reduce((acc, req) => {
        if (!acc[req.endpoint]) {
          acc[req.endpoint] = [];
        }
        acc[req.endpoint].push(req);
        return acc;
      }, {} as Record<string, typeof batch>);

      // Execute each group
      for (const [endpoint, requests] of Object.entries(grouped)) {
        try {
          const params = requests.map(r => r.params);
          const results = await this.makeBatchRequest(endpoint, params);

          // Resolve individual promises
          requests.forEach((req, index) => {
            req.resolve(results[index]);
          });
        } catch (error) {
          // Reject all requests in this group
          requests.forEach(req => req.reject(error));
        }
      }
    } catch (error) {
      // Reject all pending requests
      batch.forEach(req => req.reject(error));
    }
  }

  // Make actual API request
  private async makeRequest(endpoint: string, params: any): Promise<any> {
    // Check if request is already in progress (request deduplication)
    const requestKey = `${endpoint}:${JSON.stringify(params)}`;
    if (this.requestQueue.has(requestKey)) {
      return this.requestQueue.get(requestKey);
    }

    // Check cache first
    const cached = await this.getCachedData(requestKey);
    if (cached) {
      return cached;
    }

    // Make request
    const requestPromise = fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).then(async response => {
      const data = await response.json();

      // Cache successful response
      if (response.ok) {
        await this.cacheData(requestKey, data);
      }

      // Remove from queue
      this.requestQueue.delete(requestKey);

      return data;
    }).catch(error => {
      this.requestQueue.delete(requestKey);
      throw error;
    });

    // Add to queue
    this.requestQueue.set(requestKey, requestPromise);

    return requestPromise;
  }

  // Make batch API request
  private async makeBatchRequest(endpoint: string, params: any[]): Promise<any[]> {
    const response = await fetch(`${endpoint}/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: params }),
    });

    if (!response.ok) {
      throw new Error('Batch request failed');
    }

    const data = await response.json();
    return data.responses || [];
  }

  // Sync offline data when connection is restored
  private async syncOfflineData() {
    if (!this.settings.enableOfflineMode) return;

    try {
      // Get all offline operations
      const keys = await AsyncStorage.getAllKeys();
      const offlineKeys = keys.filter(k => k.startsWith('offline_'));

      if (offlineKeys.length === 0) return;

      const offlineData = await AsyncStorage.multiGet(offlineKeys);

      // Process each offline operation
      for (const [key, value] of offlineData) {
        if (value) {
          try {
            const { endpoint, params } = JSON.parse(value);
            await this.makeRequest(endpoint, params);
            await AsyncStorage.removeItem(key);
          } catch (error) {
            console.error('Error syncing offline data:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error syncing offline data:', error);
    }
  }

  // Optimize image loading
  getOptimizedImageUrl(url: string, width?: number, height?: number): string {
    if (!this.settings.enableImageOptimization) return url;

    // Add image optimization parameters
    const params = new URLSearchParams();
    if (width) params.append('w', width.toString());
    if (height) params.append('h', height.toString());
    params.append('q', '85'); // Quality 85%
    params.append('fmt', 'webp'); // Use WebP format

    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${params.toString()}`;
  }

  // Defer heavy operations
  async deferOperation(operation: () => void | Promise<void>, priority: 'high' | 'normal' | 'low' = 'normal') {
    const delay = priority === 'high' ? 0 : priority === 'normal' ? 100 : 500;

    return new Promise((resolve) => {
      InteractionManager.runAfterInteractions(() => {
        setTimeout(async () => {
          await operation();
          resolve(undefined);
        }, delay);
      });
    });
  }

  // Track screen load time
  trackScreenLoad(screenName: string, startTime: number) {
    const loadTime = Date.now() - startTime;
    this.metrics.screenLoadTime[screenName] = loadTime;

    // Log slow screens
    if (loadTime > 1000) { // More than 1 second
      console.warn(`Slow screen load: ${screenName} took ${loadTime}ms`);
    }
  }

  // Track API response time
  trackApiResponse(endpoint: string, duration: number) {
    if (!this.metrics.apiResponseTime[endpoint]) {
      this.metrics.apiResponseTime[endpoint] = [];
    }
    this.metrics.apiResponseTime[endpoint].push(duration);

    // Keep only last 100 measurements
    if (this.metrics.apiResponseTime[endpoint].length > 100) {
      this.metrics.apiResponseTime[endpoint].shift();
    }
  }

  // Get performance report
  getPerformanceReport(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Clear all caches
  async clearAllCaches() {
    this.cache.clear();

    // Clear AsyncStorage cache
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith('cache_'));
    await AsyncStorage.multiRemove(cacheKeys);
  }

  // Enable/disable specific optimizations
  toggleOptimization(feature: keyof OptimizationSettings, enabled: boolean) {
    if (typeof this.settings[feature] === 'boolean') {
      this.settings[feature] = enabled as any;
      this.updateSettings({ [feature]: enabled });
    }
  }
}

export default PerformanceOptimizer.getInstance();