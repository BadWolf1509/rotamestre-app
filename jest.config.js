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
      branches: 15, // Atual: ~19%, target inicial realista
      functions: 15, // Atual: ~16%, target inicial realista
      lines: 15, // Atual: ~17%, target inicial realista
      statements: 15, // Atual: ~17%, target inicial realista
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
