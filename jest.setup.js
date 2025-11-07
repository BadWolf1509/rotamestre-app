// Setup para Jest
import '@testing-library/jest-native/extend-expect';

global.fetch = jest.fn();

// Mock do console para testes mais limpos
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock NativeEventEmitter (requerido pelo Unistyles)
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');

// Mock Alert - criar antes de importar componentes
const mockAlertFn = jest.fn((title, message, buttons) => {
  // Simular comportamento do Alert se buttons estiver presente
  if (buttons && buttons.length > 0) {
    // Chamar primeiro botão por padrão (OK)
    if (buttons[0].onPress) {
      buttons[0].onPress();
    }
  }
});

// Disponibilizar globalmente
global.mockAlert = mockAlertFn;

// Mock do módulo Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  __esModule: true,
  default: {
    alert: mockAlertFn,
  },
}));

// Mock Expo modules
jest.mock('expo-font', () => ({
  loadAsync: jest.fn(),
  isLoaded: jest.fn(() => true),
}));

jest.mock('expo-asset', () => ({
  Asset: {
    loadAsync: jest.fn(),
  },
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

// Mock react-native-unistyles
const mockTheme = {
  colors: {
    white: '#ffffff',
    gray900: '#111827',
    gray700: '#374151',
    gray600: '#4b5563',
    gray500: '#6b7280',
    gray300: '#d1d5db',
    gray200: '#e5e7eb',
    gray100: '#f3f4f6',
    primary: '#1e5aa8',
    primaryDark: '#164178',
    secondary: '#f7a02a',
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
  },
  typography: {
    xs: 12,
    sm: 14,
    base: 16,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      md: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
    },
    fontSans: 'System',
    fontSansSemiBold: 'System',
    fontSansBold: 'System',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
};

// Mock miniRuntime para Unistyles v3
const mockMiniRuntime = {
  breakpoint: 'xs',
  colorScheme: 'light',
  hasAdaptiveThemes: false,
  themeName: 'light',
  setTheme: jest.fn(),
  updateTheme: jest.fn(),
};

jest.mock('react-native-unistyles', () => ({
  StyleSheet: {
    create: (stylesOrFunction) => {
      // Se for uma função (Unistyles v3), chama com theme e miniRuntime mock
      if (typeof stylesOrFunction === 'function') {
        try {
          const styles = stylesOrFunction(mockTheme, mockMiniRuntime);
          // Garante que retorna um objeto válido de estilos
          return styles || {};
        } catch (error) {
          console.warn('Error in StyleSheet.create mock:', error);
          return {};
        }
      }
      // Se for um objeto, retorna direto
      return stylesOrFunction || {};
    },
    configure: jest.fn(),
  },
  useUnistyles: () => ({
    theme: mockTheme,
    rt: mockMiniRuntime,
  }),
  UnistylesRegistry: {
    addThemes: jest.fn(),
    addBreakpoints: jest.fn(),
    addConfig: jest.fn(),
  },
  createStyleSheet: (stylesOrFunction) => {
    // Alias para StyleSheet.create
    if (typeof stylesOrFunction === 'function') {
      try {
        return stylesOrFunction(mockTheme, mockMiniRuntime) || {};
      } catch (error) {
        return {};
      }
    }
    return stylesOrFunction || {};
  },
}));

// Mock Image e resolveAssetSource
jest.mock('react-native/Libraries/Image/Image', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: jest.fn((props) => React.createElement('Image', props)),
    resolveAssetSource: jest.fn((_source) => ({
      uri: 'mocked-image-uri',
      width: 100,
      height: 100,
    })),
  };
});

// Mock expo-router com funções mock compartilhadas
const mockRouterFunctions = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouterFunctions,
  usePathname: () => '/',
  useSegments: () => [],
  useSearchParams: () => ({}),
  useLocalSearchParams: () => ({}),
  useGlobalSearchParams: () => ({}),
  router: mockRouterFunctions,
}));

// Mock Supabase
const mockSupabaseClient = {
  auth: {
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    updateUser: jest.fn(),
    getSession: jest.fn(),
    getUser: jest.fn(),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  })),
};

jest.mock('@/lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

// Mock useResponsive hook
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isDesktop: false,
    isMobile: true,
    isTablet: false,
    width: 375,
    height: 667,
  }),
}));

