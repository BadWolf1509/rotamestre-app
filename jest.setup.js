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
const mockTheme = {
  colors: {
    white: '#ffffff',
    gray900: '#111827',
    gray800: '#1f2937',
    gray700: '#374151',
    gray600: '#4b5563',
    gray500: '#6b7280',
    gray400: '#9ca3af',
    gray300: '#d1d5db',
    gray200: '#e5e7eb',
    gray100: '#f3f4f6',
    gray50: '#f9fafb',
    primary: '#1e5aa8',
    background: '#f9fafb',
    text: '#1f2937',
    textSecondary: '#4b5563',
    primaryDark: '#164178',
    primaryBg: '#e6ecfb',
    secondary: '#f7a02a',
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
    overlay: 'rgba(0, 0, 0, 0.5)',
    whatsapp: '#25D366',
    // Incident categories (semantic colors)
    incident: {
      accident: '#ef4444',
      absent: '#f59e0b',
      wrongAddress: '#3b82f6',
      blocked: '#8b5cf6',
      vehicle: '#ec4899',
      weather: '#06b6d4',
      other: '#6b7280',
    },
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
    fontDisplay: 'Viga',
  },
  spacing: {
    // Escala numerica (grade de 4px) — o codigo de producao usa
    // theme.spacing['4'], ['14'] etc. Sem estas chaves o mock devolvia
    // undefined e qualquer teste sobre tamanho virava vacuo.
    '0': 0,
    '0.5': 2,
    '1': 4,
    '1.5': 6,
    '2': 8,
    '2.5': 10,
    '3': 12,
    '3.5': 14,
    '4': 16,
    '5': 20,
    '6': 24,
    '7': 28,
    '8': 32,
    '10': 40,
    '12': 48,
    '14': 56,
    '16': 64,
    '20': 80,
    '24': 96,
    // Apelidos semanticos
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    xs: 2,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  motion: {
    duration: {
      fast: 150,
      normal: 250,
      slow: 350,
    },
    easing: {
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
  layout: {
    sidebarWidth: 264,
    containerMaxWidth: 1280,
  },
  desktop: {
    input: {
      height: 36,
      paddingHorizontal: 10,
      fontSize: 14,
    },
    button: {
      height: 32,
      paddingHorizontal: 12,
      fontSize: 13,
    },
    field: {
      marginBottom: 12,
    },
    section: {
      padding: 12,
      gap: 8,
    },
    modal: {
      headerPadding: 12,
      bodyPadding: 12,
      footerPadding: 12,
      footerGap: 8,
      titleFontSize: 15,
      closeButtonSize: 20,
    },
    dialog: {
      maxWidth: 320,
      containerPadding: 16,
      iconCircleSize: 44,
      iconSize: 22,
      titleFontSize: 16,
      messageFontSize: 13,
      buttonHeight: 36,
      buttonPaddingV: 8,
      buttonPaddingH: 14,
      buttonGap: 10,
    },
  },
  shadows: {
    sm: {},
    md: {},
    lg: {},
    card: {},
  },
  components: {
    button: {
      size: {
        small: {
          height: 36,
          paddingVertical: 8,
          paddingHorizontal: 12,
          fontSize: 14,
        },
        medium: {
          height: 44,
          paddingVertical: 12,
          paddingHorizontal: 16,
          fontSize: 16,
        },
        large: {
          height: 52,
          paddingVertical: 16,
          paddingHorizontal: 20,
          fontSize: 18,
        },
      },
      radius: 10,
    },
    input: {
      size: {
        small: {
          height: 36,
          paddingHorizontal: 10,
          fontSize: 14,
        },
        medium: {
          height: 44,
          paddingHorizontal: 12,
          fontSize: 16,
        },
        large: {
          height: 52,
          paddingHorizontal: 14,
          fontSize: 18,
        },
      },
      radius: 8,
    },
    modal: {
      headerPadding: 16,
      bodyPadding: 16,
      footerPadding: 16,
    },
    dialog: {
      maxWidth: 320,
      containerPadding: 16,
      iconCircleSize: 44,
      iconSize: 22,
      titleFontSize: 16,
      messageFontSize: 13,
      buttonHeight: 36,
      buttonPaddingV: 8,
      buttonPaddingH: 14,
      buttonGap: 10,
    },
    badge: {
      size: {
        small: {
          paddingHorizontal: 8,
          paddingVertical: 4,
          fontSize: 12,
        },
        medium: {
          paddingHorizontal: 12,
          paddingVertical: 6,
          fontSize: 14,
        },
        large: {
          paddingHorizontal: 16,
          paddingVertical: 8,
          fontSize: 16,
        },
      },
    },
    avatar: {
      size: {
        sm: 32,
        md: 48,
        lg: 64,
        xl: 80,
      },
    },
    connectivityBanner: {
      paddingV: 8,
      messageFontSize: 13,
      badgePaddingH: 8,
      badgePaddingV: 4,
      badgeFontSize: 11,
      badgeBorderRadius: 12,
      dotSize: 8,
    },
    minTouchTarget: 44,
    statsCard: {
      padding: 20,
      radius: 12,
      valueFontSize: 28,
      labelFontSize: 13,
      labelLetterSpacing: 0.5,
      iconSize: 20,
      iconContainerSize: 32,
      iconContainerRadius: 8,
      changeFontSize: 13,
    },
    table: {
      headerFontSize: 12,
      rowFontSize: 14,
      cellPaddingX: 8,
      cellPaddingY: 8,
      badgePaddingX: 12,
      badgePaddingY: 4,
      actionButtonPaddingX: 12,
      actionButtonPaddingY: 6,
      actionButtonFontSize: 13,
      paginationFontSize: 14,
    },
    card: {
      padding: {
        none: 0,
        small: 12,
        medium: 16,
        large: 20,
      },
    },
    sidebar: {
      logoHeight: 180,
      itemHeight: 40,
      itemFontSize: 14,
      itemIconSize: 20,
      sectionTitleFontSize: 12,
      footerFontSize: 13,
    },
    pageLayout: {
      contentPadding: 32,
      headerTitleFontSize: 24,
      headerSubtitleFontSize: 14,
      breadcrumbFontSize: 13,
    },
    map: {
      markerSize: 40,
      clusterSize: 48,
      controlButtonSize: 44,
      infoBoxPadding: 16,
    },
    drawer: {
      avatarSize: 64,
      menuIconSize: 20,
      menuIconWidth: 24,
      headerPadding: 20,
      itemPaddingV: 12,
      footerPadding: 20,
    },
    errorBoundary: {
      containerPadding: 24,
      cardPadding: 32,
      cardBorderRadius: 16,
      iconSize: 64,
      titleFontSize: 20,
      messageFontSize: 14,
      errorDetailFontSize: 12,
      buttonPaddingV: 12,
      buttonPaddingH: 24,
      buttonBorderRadius: 8,
      buttonFontSize: 16,
      buttonIconSize: 20,
    },
    desktopCard: {
      borderRadius: 12,
      headerPadding: 20,
      contentPadding: 20,
      iconContainerSize: 40,
      iconContainerRadius: 10,
      iconSize: 20,
      titleFontSize: 16,
      subtitleFontSize: 13,
      headerGap: 12,
      actionsGap: 8,
    },
    sectionHeader: {
      fontSize: 12,
      fontWeight: 'semiBold',
      letterSpacing: 0.5,
      marginBottom: 8,
      paddingHorizontal: 0,
      textTransform: 'uppercase',
    },
    hint: {
      fontSize: 12,
      lineHeight: 16,
      marginTop: 4,
    },
    confirmModal: {
      iconCircleSize: 44,
      iconSize: 24,
      titleFontSize: 20,
      messageFontSize: 15,
      messageLineHeight: 24,
      destructiveLabelFontSize: 14,
      destructiveInputFontSize: 15,
      destructiveInputPaddingV: 10,
    },
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
// Note: We use mockTheme directly instead of requiring from styles.base
// to avoid module-level side effects with color functions
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
