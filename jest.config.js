const path = require('path');

// Regex absoluta dos worktrees aninhados neste repo (`<raiz>/.claude/worktrees/`).
// Todo caractere que não é alfanumérico, '_' ou '-' vira '.', inclusive os
// separadores: no Windows o jest troca `<rootDir>` por um caminho com barras
// invertidas e `\.claude` vira um '.' escapado, então o padrão
// `<rootDir>/.claude/worktrees/` nunca casa (medido: a isca plantada continuava
// na lista). Sem barras no padrão não há o que o jest reescrever, e o resultado
// é igual em Windows e Linux.
const WORKTREES_ANINHADOS = `${path.join(__dirname, '.claude', 'worktrees').replace(/[^A-Za-z0-9_-]/g, '.')}.`;

module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo-router|escape-string-regexp)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|native-base|react-native-svg|react-native-unistyles|@shopify/flash-list)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    // Incluir apenas hooks e utilitários do app/, não as páginas/layouts
    'app/**/__tests__/**/*.{ts,tsx}',
    // Exclusões
    // Variantes .web: o Jest resolve a versão nativa, então estas nunca são
    // carregadas na suíte. As de mapa (NavigationMode.web, MiniMap.web) usam
    // maplibre, que só roda em navegador, e o e2e (Playwright) as exercita.
    // google.web.ts e navigation.web.ts não têm cobertura e2e própria: ficam
    // fora por não terem teste unitário, e tirá-las da exclusão exige medir a
    // cobertura global contra os thresholds abaixo (margem de cerca de 1 ponto).
    '!src/lib/google.web.ts',
    '!src/lib/navigation.web.ts',
    '!src/components/motorista/NavigationMode.web.tsx',
    '!src/components/motorista/home/MiniMap.web.tsx',
    // Cliente criado no carregamento do módulo, com variáveis de ambiente.
    '!src/lib/supabase.ts',
    '!src/lib/supabase.web.ts',
    // Mapa nativo (MapLibre React Native): sem implementação em Node.
    '!src/components/MapaMobile.tsx',
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
      branches: 65, // Atual: ~66.27%
      functions: 72, // Atual: ~73.41%
      lines: 73, // Atual: ~74.18%
      statements: 72, // Atual: ~73.1%
    },
  },
  moduleNameMapper: {
    // Mock para todos os assets de imagem (deve vir ANTES do alias @/)
    '\\.(png|PNG|jpg|jpeg|gif|svg|webp|bmp|ico)$': '<rootDir>/__mocks__/fileMock.js',
    // Mock CSS imports (maplibre-gl/dist/maplibre-gl.css etc.)
    '\\.css$': '<rootDir>/__mocks__/fileMock.js',
    // maplibre-gl v6 é ESM-only; o jest-resolve não acha o entry (o Metro sim).
    // Aponta para um stub resolvível — os testes de mapa fazem jest.mock inline.
    '^maplibre-gl$': '<rootDir>/__mocks__/maplibre-gl.js',
    // Mock @/utils/color - required because styles.base.ts calls boxShadow() at module level
    '^@/utils/color$': '<rootDir>/src/utils/__mocks__/color.ts',
    // Alias @/ para src/
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Worktrees do Claude moram DENTRO do repo (`.claude/worktrees/<nome>/`), cada um
  // com uma cópia inteira de src/ e dos testes: sem isto a suíte local conta tudo
  // N vezes e o jest-haste-map acusa mocks/package.json duplicados.
  // O padrão é relativo à raiz do repo que está rodando (ver WORKTREES_ANINHADOS),
  // e não um `worktrees` cru: este também ignoraria o próprio repo quando ele é
  // rodado de dentro de um worktree (o caminho absoluto contém `/worktrees/`) e
  // zeraria a suíte. Assim só saem os worktrees aninhados. O CI não muda.
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', WORKTREES_ANINHADOS],
  modulePathIgnorePatterns: [WORKTREES_ANINHADOS],
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
