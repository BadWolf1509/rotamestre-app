/* global jest, beforeEach */
// Setup para Jest
// Note: @/utils/color is mocked via moduleNameMapper in jest.config.js

// fetch sem mock no teste falha com mensagem clara, em vez de devolver undefined
// e quebrar longe da causa ("Cannot read properties of undefined").
global.fetch = jest.fn(() => Promise.reject(new Error('fetch sem mock neste teste')));

// Mock MapLibre Native (avoid native module errors in tests)
// v11 API shape: named exports Map/Marker/GeoJSONSource/Layer/Camera.
// CameraRef methods: setStop/fitBounds/flyTo/easeTo/jumpTo/zoomTo.
jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');

  const createView = (defaultTestId) => ({ children, testID, ...props }) =>
    React.createElement(View, { testID: testID ?? defaultTestId, ...props }, children);

  const Camera = React.forwardRef(({ children, testID, ...props }, ref) => {
    React.useImperativeHandle(ref, () => ({
      setStop: jest.fn(),
      fitBounds: jest.fn(),
      flyTo: jest.fn(),
      easeTo: jest.fn(),
      jumpTo: jest.fn(),
      zoomTo: jest.fn(),
    }));
    return React.createElement(View, { testID: testID ?? 'map-camera', ...props }, children);
  });

  // MapRef: project/unproject resolvem em dp, como o nativo.
  const Map = React.forwardRef(({ children, testID, ...props }, ref) => {
    React.useImperativeHandle(ref, () => ({
      project: jest.fn(async () => [0, 0]),
      unproject: jest.fn(async () => [0, 0]),
    }));
    return React.createElement(View, { testID: testID ?? 'map-view', ...props }, children);
  });
  const Marker = createView('marker');
  const GeoJSONSource = createView('shape-source');
  const Layer = createView('line-layer');
  const Callout = createView('callout');
  const ViewAnnotation = createView('view-annotation');
  const UserLocation = createView('user-location');

  return {
    __esModule: true,
    Map,
    Camera,
    Marker,
    GeoJSONSource,
    Layer,
    Callout,
    ViewAnnotation,
    UserLocation,
  };
});

// Aumentar timeout global para evitar falhas intermitentes em integração
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

// Aviso inesperado de console.error/warn falha o teste (jest.mocks/consoleAvisos.js).
require('./jest.mocks/consoleAvisos').instalarVigiaDoConsole(global.console);

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
// Tema dos testes: o tema REAL (fonte única), não uma cópia à mão. A cópia
// divergiu em 4 cores (primary, primaryDark, secondary, success) e deixava
// teste de cor verde com o valor antigo. Sobrescrita só onde o teste exigir.
const mockTheme = jest.requireActual('./src/utils/styles.base').defaultTheme;

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
  // O real devolve um proxy NOVO de theme a cada render (useProxifiedUnistyles),
  // com theme.colors estável. Theme em deps de memo/efeito muda todo render.
  useUnistyles: () => ({
    theme: { ...mockTheme },
    rt: mockMiniRuntime,
  }),
  UnistylesRegistry: {
    addThemes: jest.fn(),
    addBreakpoints: jest.fn(),
    addConfig: jest.fn(),
  },
  UnistylesRuntime: {
    colorScheme: 'light',
    themeName: 'light',
    setTheme: jest.fn(),
    setAdaptiveThemes: jest.fn(),
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

// Mock @/utils/styles with mockTheme for tests
jest.mock('@/utils/styles', () => {
  return {
    defaultTheme: mockTheme,
    useUnistyles: () => ({
      theme: { ...mockTheme }, // novo a cada render, como o real
    }),
    StyleSheet: {
      create: (stylesOrFunction) =>
        typeof stylesOrFunction === 'function'
          ? stylesOrFunction(mockTheme)
          : stylesOrFunction || {},
    },
  };
});

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

// Mock de `@/lib/supabase`: `jest.mocks/supabase.js`, chamado acima (setupSupabaseMocks).

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

// Mock @mapbox/polyline
jest.mock('@mapbox/polyline', () => ({
  decode: jest.fn(() => [[0, 0], [1, 1]]),
  encode: jest.fn(() => 'encoded-polyline'),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const defaultInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  const defaultFrame = { x: 0, y: 0, width: 390, height: 844 };

  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children, style }) =>
      React.createElement('SafeAreaView', { style }, children),
    useSafeAreaInsets: () => defaultInsets,
    useSafeAreaFrame: () => defaultFrame,
    initialWindowMetrics: {
      insets: defaultInsets,
      frame: defaultFrame,
    },
  };
});

// Mock useAlert - Provides testable alert functions
// Tests can spy on these functions to verify alert behavior
const mockShowAlert = jest.fn();
const mockShowSuccess = jest.fn();
const mockShowWarning = jest.fn();
const mockShowError = jest.fn();
const mockShowConfirm = jest.fn().mockResolvedValue(true);
const mockShowDestructive = jest.fn().mockResolvedValue(true);
const mockHideAlert = jest.fn();

// Reset useAlert mocks before each test
beforeEach(() => {
  mockShowAlert.mockClear();
  mockShowSuccess.mockClear();
  mockShowWarning.mockClear();
  mockShowError.mockClear();
  mockShowConfirm.mockClear().mockResolvedValue(true);
  mockShowDestructive.mockClear().mockResolvedValue(true);
  mockHideAlert.mockClear();
});

// Expose mocks globally for tests to access
global.mockUseAlert = {
  showAlert: mockShowAlert,
  showSuccess: mockShowSuccess,
  showWarning: mockShowWarning,
  showError: mockShowError,
  showConfirm: mockShowConfirm,
  showDestructive: mockShowDestructive,
  hideAlert: mockHideAlert,
  isVisible: false,
  AlertDialog: null,
};

jest.mock('@/hooks/useAlert', () => ({
  __esModule: true,
  useAlert: () => global.mockUseAlert,
  default: () => global.mockUseAlert,
}));

// expo-notifications 58 instala um handler padrão ao carregar o módulo
// (notificação em primeiro plano passa a aparecer por padrão), e o
// setNotificationHandler do app remove a inscrição anterior. O mock genérico do
// jest-expo devolve uma Promise no addListener, sem `remove` — sem isto, todo
// teste que importa src/lib/notifications.ts quebra no carregamento.
jest.mock('expo-notifications/build/NotificationsHandlerModule', () => ({
  __esModule: true,
  default: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeListeners: jest.fn(),
    handleNotificationAsync: jest.fn(async () => {}),
  },
}));

// O react-native-worklets real exige o módulo nativo. Desde o SDK 58 o
// SwipeableRow (exportado pelo design system) usa o ReanimatedSwipeable, então
// o reanimated entra em quase toda árvore de teste. O mock oficial do worklets
// só é carregado quando algum módulo o requer.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
// No Jest o Reanimated roda o JSReanimated (a implementação web), mas a
// resolução nativa do jest-expo escolhe initializers.native.ts, que desde o
// reanimated 4.7 chama setCSSEventHandler — e o JSReanimated o recusa com erro
// já no import. Usa o inicializador da implementação JS, o par coerente.
// Vale para as duas árvores: lib/ (entrada do pacote) e src/ (que o mock
// oficial, abaixo, importa).
jest.mock('react-native-reanimated/lib/module/initializers', () =>
  jest.requireActual('react-native-reanimated/lib/module/initializers.js'),
);
jest.mock('react-native-reanimated/src/initializers', () =>
  jest.requireActual('react-native-reanimated/src/initializers.ts'),
);
// E, para quem não declara o próprio mock (o jest.mock do arquivo de teste tem
// precedência), o mock oficial do reanimated: o runtime de UI do reanimated
// real não roda sobre o mock do worklets (mappers sem função de agendamento).
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Setup oficial do Gesture Handler para Jest: troca o módulo nativo e os
// detectores por mocks. Necessário desde que o ReanimatedSwipeable entrou no
// design system (antes, só telas com mock próprio carregavam o RNGH).
require('react-native-gesture-handler/jestSetup');

// O mock de View do preset do RN tem `measureInWindow` que nunca responde. O
// MenuDeAcoes só desenha a lista quando a medida da abertura responde (sem
// pisca); aqui ela responde na hora, com tudo em zero. Quem precisa controlar
// a resposta mocka a View no próprio teste (MenuDeAcoes.ancora.test.tsx).
jest
  .requireActual('@react-native/jest-preset/jest/MockNativeMethods')
  .default.measureInWindow.mockImplementation((responder) =>
    responder?.(0, 0, 0, 0),
  );
