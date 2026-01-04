import { LogBox, Platform } from 'react-native';

/**
 * Configure LogBox to ignore known development warnings that don't affect functionality
 * These warnings are from React Native Web's development mode and not from application code
 */
export function configureLogBox() {
  if (Platform.OS === 'web' && __DEV__) {
    // LogBox on web can throw "Unexpected text node" errors; disable it entirely.
    LogBox.uninstall?.();

    // Disable LogBox completely on web in development
    // The LogBox component itself has issues with React Native Web
    // and generates "Unexpected text node" errors
    LogBox.ignoreAllLogs(true);

    // Additionally suppress console warnings about Google Maps async loading
    // This is a performance optimization suggestion, not an error
    const originalWarn = console.warn;
    const originalError = console.error;

    const normalizeArgs = (args: unknown[]) => args.map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.message;
      if (arg && typeof arg === 'object' && 'message' in arg) {
        return String((arg as { message?: unknown }).message);
      }
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }).join(' ');

    const isTextNodeError = (message: string) => (
      message.includes('Unexpected text node') ||
      message.includes('text node cannot be a child') ||
      message.includes('A text node cannot be a child of a <View>')
    );

    console.warn = (...args) => {
      const message = normalizeArgs(args);

      // Suppress Google Maps warnings
      if (message.includes('Google Maps JavaScript API')) {
        return;
      }

      // Suppress text node warnings from React Native Web
      if (isTextNodeError(message)) {
        return;
      }

      // Suppress useNativeDriver warning on web (expected behavior)
      // The native driver doesn't exist on web, so it falls back to JS-based animations
      if (message.includes('useNativeDriver') && message.includes('not supported')) {
        return;
      }

      originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      const message = normalizeArgs(args);

      // Suppress LogBox-related text node errors
      if (isTextNodeError(message)) {
        return;
      }

      originalError.apply(console, args);
    };
  }
}
