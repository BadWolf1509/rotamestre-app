/**
 * DevTools Configuration
 * Configurações específicas para desenvolvimento com Edge DevTools
 */

import { Platform } from 'react-native';

// Enable React DevTools
if (__DEV__ && Platform.OS === 'web') {
  // Enable React DevTools profiling
  if (typeof window !== 'undefined') {
    // React DevTools integration
    (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ || {};
    (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__.supportsFiber = true;
    (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__.isDisabled = false;

    // Redux DevTools Extension
    (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || ((f: any) => f);
  }
}

// Performance monitoring for web
export const enablePerformanceMonitoring = () => {
  if (__DEV__ && Platform.OS === 'web' && typeof window !== 'undefined') {
    // Log performance metrics
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          console.group('⚡ Navigation Performance');
          console.log('DNS lookup:', (entry as any).domainLookupEnd - (entry as any).domainLookupStart, 'ms');
          console.log('TCP handshake:', (entry as any).connectEnd - (entry as any).connectStart, 'ms');
          console.log('Request time:', (entry as any).responseStart - (entry as any).requestStart, 'ms');
          console.log('Response time:', (entry as any).responseEnd - (entry as any).responseStart, 'ms');
          console.log('DOM interactive:', (entry as any).domInteractive, 'ms');
          console.log('DOM complete:', (entry as any).domComplete, 'ms');
          console.log('Load complete:', (entry as any).loadEventEnd, 'ms');
          console.groupEnd();
        }

        if (entry.entryType === 'measure') {
          console.log(`⏱️ ${entry.name}: ${entry.duration.toFixed(2)}ms`);
        }
      }
    });

    observer.observe({ entryTypes: ['navigation', 'measure'] });

    // Log long tasks (blocking the main thread)
    if ('PerformanceObserver' in window && 'PerformanceLongTaskTiming' in window) {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.warn('⚠️ Long Task detected:', {
            duration: entry.duration,
            startTime: entry.startTime,
            name: entry.name
          });
        }
      });

      try {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch {
        // Long task observer might not be available
      }
    }
  }
};

// Console enhancements for development
export const enhanceConsole = () => {
  if (__DEV__ && Platform.OS === 'web') {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    // Add timestamp to console logs
    console.log = (...args: any[]) => {
      const timestamp = new Date().toLocaleTimeString();
      originalLog(`[${timestamp}]`, ...args);
    };

    console.warn = (...args: any[]) => {
      const timestamp = new Date().toLocaleTimeString();
      originalWarn(`[${timestamp}] ⚠️`, ...args);
    };

    console.error = (...args: any[]) => {
      const timestamp = new Date().toLocaleTimeString();
      originalError(`[${timestamp}] ❌`, ...args);
    };

    // Add custom console methods
    (console as any).success = (...args: any[]) => {
      const timestamp = new Date().toLocaleTimeString();
      originalLog(`[${timestamp}] ✅`, ...args);
    };

    (console as any).info = (...args: any[]) => {
      const timestamp = new Date().toLocaleTimeString();
      originalLog(`[${timestamp}] ℹ️`, ...args);
    };

    (console as any).debug = (...args: any[]) => {
      if (localStorage.getItem('debug') === 'true') {
        const timestamp = new Date().toLocaleTimeString();
        originalLog(`[${timestamp}] 🐛`, ...args);
      }
    };
  }
};

// Network monitoring for Edge DevTools
export const monitorNetwork = () => {
  if (__DEV__ && Platform.OS === 'web') {
    // Intercept fetch to log network requests
    const originalFetch = window.fetch;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const [resource, config] = args;
      const method = config?.method || 'GET';
      const url = typeof resource === 'string' ? resource : (resource instanceof Request ? resource.url : resource.href);

      console.group(`🌐 ${method} ${url}`);
      const startTime = performance.now();

      try {
        const response = await originalFetch(...args);
        const duration = performance.now() - startTime;

        console.log('Status:', response.status, response.statusText);
        console.log('Duration:', duration.toFixed(2), 'ms');
        console.log('Headers:', response.headers);
        console.groupEnd();

        // Log slow requests
        if (duration > 1000) {
          console.warn(`⚠️ Slow request: ${method} ${url} took ${duration.toFixed(2)}ms`);
        }

        return response;
      } catch (error) {
        const duration = performance.now() - startTime;
        console.error('Failed after', duration.toFixed(2), 'ms');
        console.error('Error:', error);
        console.groupEnd();
        throw error;
      }
    };
  }
};

// Memory monitoring
export const monitorMemory = () => {
  if (__DEV__ && Platform.OS === 'web' && (performance as any).memory) {
    setInterval(() => {
      const memInfo = (performance as any).memory;
      const usedMB = (memInfo.usedJSHeapSize / 1048576).toFixed(2);
      const limitMB = (memInfo.jsHeapSizeLimit / 1048576).toFixed(2);
      const percentage = ((memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100).toFixed(1);

      if (parseFloat(percentage) > 80) {
        console.warn(`⚠️ High memory usage: ${usedMB}MB / ${limitMB}MB (${percentage}%)`);
      }
    }, 10000); // Check every 10 seconds
  }
};

// Debug panel for Edge DevTools
export const createDebugPanel = () => {
  if (__DEV__ && Platform.OS === 'web' && typeof document !== 'undefined') {
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 99999;
      max-width: 300px;
      display: none;
    `;

    document.body.appendChild(panel);

    // Toggle with keyboard shortcut (Ctrl+Shift+D)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      }
    });

    // Update debug info
    setInterval(() => {
      if (panel.style.display !== 'none') {
        const memInfo = (performance as any).memory;
        const usedMB = memInfo ? (memInfo.usedJSHeapSize / 1048576).toFixed(2) : 'N/A';

        panel.innerHTML = `
          <div><strong>Debug Panel</strong> (Ctrl+Shift+D)</div>
          <hr style="margin: 5px 0; border: 0; border-top: 1px solid #444;">
          <div>Memory: ${usedMB} MB</div>
          <div>FPS: ${(performance as any).fps || 'Calculating...'}</div>
          <div>Network: ${navigator.onLine ? '🟢 Online' : '🔴 Offline'}</div>
          <div>Screen: ${window.innerWidth}x${window.innerHeight}</div>
          <div>URL: ${window.location.pathname}</div>
        `;
      }
    }, 1000);

    // FPS counter
    let fps = 0;
    let lastTime = performance.now();
    let frameCount = 0;

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();

      if (currentTime >= lastTime + 1000) {
        fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        (performance as any).fps = fps;
        frameCount = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(measureFPS);
    };

    measureFPS();
  }
};

// Initialize all dev tools
export const initializeDevTools = () => {
  if (__DEV__ && Platform.OS === 'web') {
    console.log('🚀 RotaMestre DevTools initialized');
    console.log('📍 Server: http://localhost:8081');
    console.log('🌐 Edge DevTools: Press F12 to open');
    console.log('🐛 Debug Panel: Press Ctrl+Shift+D');

    enablePerformanceMonitoring();
    enhanceConsole();
    monitorNetwork();
    monitorMemory();
    createDebugPanel();

    // Expose global debug functions
    (window as any).rotamestre = {
      performance: () => {
        const report = performance.getEntriesByType('navigation')[0] as any;
        console.table({
          'DOM Content Loaded': report.domContentLoadedEventEnd - report.domContentLoadedEventStart,
          'DOM Complete': report.domComplete - report.domInteractive,
          'Load Complete': report.loadEventEnd - report.loadEventStart,
          'Response Time': report.responseEnd - report.responseStart,
          'Total Time': report.loadEventEnd - report.fetchStart,
        });
      },
      clearCache: () => {
        localStorage.clear();
        sessionStorage.clear();
        console.log('✅ Cache cleared!');
      },
      toggleDebug: () => {
        const current = localStorage.getItem('debug') === 'true';
        localStorage.setItem('debug', (!current).toString());
        console.log(`✅ Debug mode ${!current ? 'enabled' : 'disabled'}`);
      },
      routes: () => {
        console.log('Available routes:', window.location.origin);
        console.table({
          'Login': '/login',
          'Home (Motorista)': '/motorista',
          'Home (Gestor)': '/gestor',
          'Mapa': '/motorista/mapa',
          'Histórico': '/motorista/historico',
          'Configurações': '/motorista/configuracoes',
        });
      },
    };

    console.log('💡 Debug commands available:');
    console.log('  rotamestre.performance() - Show performance metrics');
    console.log('  rotamestre.clearCache() - Clear all cache');
    console.log('  rotamestre.toggleDebug() - Toggle debug mode');
    console.log('  rotamestre.routes() - Show available routes');
  }
};

export default {
  initializeDevTools,
  enablePerformanceMonitoring,
  enhanceConsole,
  monitorNetwork,
  monitorMemory,
  createDebugPanel,
};
