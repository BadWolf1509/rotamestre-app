module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo-router|escape-string-regexp)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-unistyles|@sentry/.*)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    // Incluir apenas hooks e utilitários do app/, não as páginas/layouts
    'app/**/__tests__/**/*.{ts,tsx}',
    // Exclusões
    '!src/lib/google.web.ts',
    '!src/lib/navigation.web.ts',
    '!src/lib/supabase.ts',
    '!src/lib/supabase.web.ts',
    '!src/modules/AndroidWidget.ts',
    '!src/services/locationTracking.ts',
    '!src/services/performanceOptimizer.ts',
    '!src/hooks/useLocationTracking.ts',
    '!src/components/motorista/NavigationMode.web.tsx',
    '!src/components/motorista/home/MiniMap.web.tsx',
    '!src/components/motorista/PictureInPictureMap.web.tsx',
    '!src/components/MapaMobile.tsx',
    '!src/components/MapaRN.tsx',
    '!src/components/MapaWeb.tsx',
    '!src/components/gestor/dashboard/_hooks/useDashboardData.ts',
    '!src/types/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/__mocks__/**',
    // Excluir páginas do Expo Router (são integration points, não lógica)
    '!app/**/*.tsx',
    '!app/**/_layout.tsx',
    '!app/**/+html.tsx',
    '!app/**/(tabs)/**',
    '!app/**/(gestor)/**',
    '!app/**/(motorista)/**',
    '!app/**/auth/**',
  ],
  coverageReporters: ['text', 'lcov', 'json-summary', 'html'],
  coverageThreshold: {
    global: {
      branches: 65, // Atual: 68.14% - threshold com margem de 3%
      functions: 68, // Atual: 71.33% - threshold com margem de 3%
      lines: 69, // Atual: 72.32% - threshold com margem de 3%
      statements: 69, // Atual: 71.69% - threshold com margem de 3%
    },
  },
  moduleNameMapper: {
    // Mock para todos os assets de imagem (deve vir ANTES do alias @/)
    '\\.(png|jpg|jpeg|gif|svg|webp|bmp|ico)$': '<rootDir>/__mocks__/fileMock.js',
    // Alias @/ para src/
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}', '**/?(*.)+(spec|test).{ts,tsx}'],
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './coverage',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
      },
    ],
  ],
};
