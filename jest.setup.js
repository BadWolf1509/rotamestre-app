/* global jest */
// Setup para Jest

import '@testing-library/jest-native/extend-expect';

global.fetch = jest.fn();

// Aumentar timeout global para evitar falhas intermitentes em integra��o
jest.setTimeout(20000);

// Modulariza mocks principais de React Native / window
require('./jest.mocks/reactNative').setupReactNativeMocks();
// Modulariza mocks de Expo
require('./jest.mocks/expo').setupExpoMocks();
// Modulariza mocks de Supabase
require('./jest.mocks/supabase').setupSupabaseMocks();

// Mock window event listeners para web (usado por ConfirmDialog etc)
// (mantido por compatibilidade, mas agora configurado em jest.mocks/reactNative)

// Mock do console para testes mais limpos
global.console = {
  ...console,
  log: jest.fn(),
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
  alert: mockAlertFn,
}));

jest.mock('react-native/Libraries/Components/Keyboard/Keyboard', () => ({
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  removeListener: jest.fn(),
  isVisible: jest.fn(() => false),
  dismiss: jest.fn(),
}));

// Garantir que Alert/Keyboard existam mesmo em ambiente de teste
const ReactNative = require('react-native');
if (!ReactNative.Alert || typeof ReactNative.Alert.alert !== 'function') {
  ReactNative.Alert = { alert: mockAlertFn };
}

const keyboardListener = { remove: jest.fn() };
ReactNative.Keyboard = {
  addListener: jest.fn(() => keyboardListener),
  removeListener: jest.fn(),
  dismiss: jest.fn(),
  ...(ReactNative.Keyboard || {}),
};

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
      } catch {
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
    resolveAssetSource: jest.fn((source) => ({
      uri: source?.uri ?? 'mocked-image-uri',
      width: source?.width ?? 100,
      height: source?.height ?? 100,
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
const createMockQueryBuilder = () => {
  const builder = {
    select: jest.fn().mockReturnValue(builder),
    insert: jest.fn().mockReturnValue(builder),
    update: jest.fn().mockReturnValue(builder),
    delete: jest.fn().mockReturnValue(builder),
    eq: jest.fn().mockReturnValue(builder),
    neq: jest.fn().mockReturnValue(builder),
    gt: jest.fn().mockReturnValue(builder),
    gte: jest.fn().mockReturnValue(builder),
    lt: jest.fn().mockReturnValue(builder),
    lte: jest.fn().mockReturnValue(builder),
    like: jest.fn().mockReturnValue(builder),
    ilike: jest.fn().mockReturnValue(builder),
    is: jest.fn().mockReturnValue(builder),
    in: jest.fn().mockReturnValue(builder),
    contains: jest.fn().mockReturnValue(builder),
    containedBy: jest.fn().mockReturnValue(builder),
    rangeGt: jest.fn().mockReturnValue(builder),
    rangeGte: jest.fn().mockReturnValue(builder),
    rangeLt: jest.fn().mockReturnValue(builder),
    rangeLte: jest.fn().mockReturnValue(builder),
    rangeAdjacent: jest.fn().mockReturnValue(builder),
    overlaps: jest.fn().mockReturnValue(builder),
    textSearch: jest.fn().mockReturnValue(builder),
    match: jest.fn().mockReturnValue(builder),
    not: jest.fn().mockReturnValue(builder),
    or: jest.fn().mockReturnValue(builder),
    filter: jest.fn().mockReturnValue(builder),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    limit: jest.fn().mockReturnValue(builder),
    order: jest.fn().mockReturnValue(builder),
    range: jest.fn().mockReturnValue(builder),
  };
  return builder;
};

const mockSupabaseClient = {
  auth: {
    signInWithPassword: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signUp: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    resetPasswordForEmail: jest.fn().mockResolvedValue({ data: {}, error: null }),
    updateUser: jest.fn().mockResolvedValue({ data: {}, error: null }),
    getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  },
  from: jest.fn((_table) => createMockQueryBuilder()),
  channel: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnValue({
      unsubscribe: jest.fn(),
    }),
  })),
};

jest.mock('@/lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

// Mock useResponsive removido daqui para permitir testes unitários do hook.
// Deve ser mockado individualmente nos testes de componentes que o utilizam.

// Mock Expo vector icons
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    Ionicons: jest.fn((props) => React.createElement('Ionicons', props)),
    MaterialIcons: jest.fn((props) => React.createElement('MaterialIcons', props)),
    FontAwesome: jest.fn((props) => React.createElement('FontAwesome', props)),
  };
});

// Mock DateTimePicker
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  return jest.fn((props) => React.createElement('DateTimePicker', props));
});

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
  addEventListener: jest.fn(() => jest.fn()),
  useNetInfo: jest.fn(() => ({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve(null)),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
  clear: jest.fn(() => Promise.resolve(null)),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve(null)),
  multiRemove: jest.fn(() => Promise.resolve(null)),
}));

// Mock expo-speech
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  isSpeakingAsync: jest.fn(() => Promise.resolve(false)),
}));

// Mock @mapbox/polyline
jest.mock('@mapbox/polyline', () => ({
  decode: jest.fn(() => [[0, 0], [1, 1]]),
  encode: jest.fn(() => 'encoded-polyline'),
}));
