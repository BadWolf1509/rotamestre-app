import { useEffect } from 'react';
import { Platform } from 'react-native';

export function DevToolsInitializer() {
  useEffect(() => {
    if (__DEV__ && Platform.OS === 'web') {
      // Initialize DevTools
      try {
        const initDevTools = () => {
          const devtools = require('@/config/devtools');
          if (devtools && devtools.initializeDevTools) {
            devtools.initializeDevTools();
            console.log('🚀 DevTools initialized successfully');
          }
        };

        // Small delay to ensure DOM is ready
        setTimeout(initDevTools, 100);
      } catch (error) {
        console.log('DevTools not available:', error);
      }
    }
  }, []);

  return null;
}