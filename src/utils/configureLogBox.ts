import { LogBox, Platform } from 'react-native';

/**
 * Configure LogBox to ignore known development warnings that don't affect functionality
 * These warnings are from React Native Web's development mode and not from application code
 */
export function configureLogBox() {
  if (Platform.OS === 'web' && __DEV__) {
    // Disable LogBox completely on web in development
    // The LogBox component itself has issues with React Native Web
    // and generates "Unexpected text node" errors
    LogBox.ignoreAllLogs(true);

    // Additionally suppress console warnings about Google Maps async loading
    // This is a performance optimization suggestion, not an error
    const originalWarn = console.warn;
    const originalError = console.error;

    console.warn = (...args) => {
      const message = args[0]?.toString() || '';

      // Suppress Google Maps warnings
      if (message.includes('Google Maps JavaScript API')) {
        return;
      }

      // Suppress text node warnings from React Native Web
      if (message.includes('text node') || message.includes('Text node')) {
        return;
      }

      originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      const message = args[0]?.toString() || '';

      // Suppress LogBox-related text node errors
      if (message.includes('text node cannot be a child') ||
          message.includes('Unexpected text node')) {
        return;
      }

      originalError.apply(console, args);
    };
  }
}