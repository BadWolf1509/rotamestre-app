const path = require('path');

const js = require('@eslint/js');
const typescriptPlugin = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const importPlugin = require('eslint-plugin-import');
const jestPlugin = require('eslint-plugin-jest');
const jsxA11yPlugin = require('eslint-plugin-jsx-a11y');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const reactNativePlugin = require('eslint-plugin-react-native');
const unusedImportsPlugin = require('eslint-plugin-unused-imports');
const globals = require('globals');

const hexColorAllowlist = [
  'src/utils/styles.base.ts',
];

const rgbaColorAllowlist = [
  'src/utils/color.ts',
];

const shadowLiteralAllowlist = [
  'src/utils/color.ts',
];

// Files allowed to import from @/lib/design-tokens directly
const designTokensAllowlist = [
  'src/design-system/tokens/index.ts',
  'app/design-system.tsx',
];

const sharedPlugins = {
  '@typescript-eslint': typescriptPlugin,
  react: reactPlugin,
  'react-hooks': reactHooksPlugin,
  import: importPlugin,
  'jsx-a11y': jsxA11yPlugin,
  'unused-imports': unusedImportsPlugin,
  'react-native': reactNativePlugin,
  jest: jestPlugin,
};

module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      'coverage/**',
      '.expo/**',
      'android',
      'ios',
      'supabase/.temp',
      'tools/scripts/node_modules/**',
      'e2e-report/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: null,
        tsconfigRootDir: __dirname,
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
        __DEV__: 'readonly',
        NodeJS: 'readonly',
      },
    },
    plugins: sharedPlugins,
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        typescript: {
          project: path.join(__dirname, 'tsconfig.json'),
        },
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'unused-imports/no-unused-imports': 'error',
      'import/order': [
        'warn',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
            'object',
            'type',
          ],
          pathGroups: [
            {
              pattern: '@/**',
              group: 'internal',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
          'newlines-between': 'always',
        },
      ],
      'react-native/no-inline-styles': 'off',
      'react-native/no-raw-text': 'off',
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: [
      '**/__tests__/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      'src/components/**',
      'src/design-system/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@/components/AlertDialog', message: "Importe via '@/design-system'." },
            { name: '@/components/Avatar', message: "Importe via '@/design-system'." },
            { name: '@/components/Badge', message: "Importe via '@/design-system'." },
            { name: '@/components/Button', message: "Importe via '@/design-system'." },
            { name: '@/components/Card', message: "Importe via '@/design-system'." },
            { name: '@/components/ConfirmDialog', message: "Importe via '@/design-system'." },
            { name: '@/components/ConfirmModal', message: "Importe via '@/design-system'." },
            { name: '@/components/DataTable', message: "Importe via '@/design-system'." },
            { name: '@/components/EmptyState', message: "Importe via '@/design-system'." },
            { name: '@/components/Icon', message: "Importe via '@/design-system'." },
            { name: '@/components/Input', message: "Importe via '@/design-system'." },
            { name: '@/components/Modal', message: "Importe via '@/design-system'." },
            { name: '@/components/Progress', message: "Importe via '@/design-system'." },
            { name: '@/components/SkeletonLoader', message: "Importe via '@/design-system'." },
            { name: '@/components/StepIndicator', message: "Importe via '@/design-system'." },
            { name: '@/components/SupportModal', message: "Importe via '@/design-system'." },
            { name: '@/components/Text', message: "Importe via '@/design-system'." },
            { name: '@/components/Toast', message: "Importe via '@/design-system'." },
            { name: '@/components/desktop', message: "Importe via '@/design-system'." },
            { name: '@/components/desktop/DesktopLayout', message: "Importe via '@/design-system'." },
            { name: '@/components/desktop/DesktopPageLayout', message: "Importe via '@/design-system'." },
            { name: '@/components/desktop/DesktopModal', message: "Importe via '@/design-system'." },
            { name: '@/components/desktop/DesktopCard', message: "Importe via '@/design-system'." },
            { name: '@/components/desktop/SplitView', message: "Importe via '@/design-system'." },
            { name: '@/components/mobile', message: "Importe via '@/design-system'." },
            { name: '@/components/mobile/MobileHeader', message: "Importe via '@/design-system'." },
            { name: '@/components/mobile/MobileCard', message: "Importe via '@/design-system'." },
            { name: '@/components/mobile/MobileButton', message: "Importe via '@/design-system'." },
            { name: '@/components/mobile/MobileEmptyState', message: "Importe via '@/design-system'." },
            { name: '@/components/mobile/MobileLoading', message: "Importe via '@/design-system'." },
            { name: '@/components/gestor/ResponsiveGrid', message: "Importe via '@/design-system'." },
            { name: '@/components/AddressAutocomplete', message: "Importe via '@/design-system'." },
            { name: '@/components/AuthLoadingScreen', message: "Importe via '@/design-system'." },
            { name: '@/components/CameraUpload', message: "Importe via '@/design-system'." },
            { name: '@/components/ErrorBoundary', message: "Importe via '@/design-system'." },
            { name: '@/components/SwipeableRow', message: "Importe via '@/design-system'." },
            { name: '@/components/FilterChip', message: "Importe via '@/design-system'." },
            { name: '@/components/StatusBadge', message: "Importe via '@/design-system'." },
          ],
        },
      ],
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: [
      '**/__tests__/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      ...designTokensAllowlist,
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/design-tokens',
              message: "Use 'useUnistyles()' hook and access theme.* instead. Import tokens only via '@/design-system/tokens'.",
            },
          ],
          patterns: [
            {
              group: ['@/lib/design-tokens'],
              message: "Use 'useUnistyles()' hook and access theme.* instead. Import tokens only via '@/design-system/tokens'.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: [
      '**/__tests__/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      ...hexColorAllowlist,
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/^#(?:[0-9a-fA-F]{3,8})$/]",
          message: 'Use theme tokens instead of hex colors.',
        },
        {
          selector: "TemplateElement[value.raw=/^#(?:[0-9a-fA-F]{3,8})$/]",
          message: 'Use theme tokens instead of hex colors.',
        },
      ],
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: [
      '**/__tests__/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      ...rgbaColorAllowlist,
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/rgba\\(/]",
          message: 'Use theme tokens or withOpacity() instead of rgba literals.',
        },
        {
          selector: "TemplateElement[value.raw=/rgba\\(/]",
          message: 'Use theme tokens or withOpacity() instead of rgba literals.',
        },
      ],
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: [
      '**/__tests__/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      ...shadowLiteralAllowlist,
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Property[key.name='boxShadow'] > Literal",
          message: 'Use boxShadow() helper instead of boxShadow string literals.',
        },
        {
          selector: "Property[key.name='boxShadow'] > TemplateLiteral",
          message: 'Use boxShadow() helper instead of boxShadow template literals.',
        },
        {
          selector: "Literal[value=/drop-shadow\\(/]",
          message: 'Use dropShadow() helper instead of drop-shadow literals.',
        },
        {
          selector: "TemplateElement[value.raw=/drop-shadow\\(/]",
          message: 'Use dropShadow() helper instead of drop-shadow literals.',
        },
      ],
    },
  },
  {
    files: [
      'babel.config.js',
      'metro.config.js',
      'jest.config.js',
      'app.config.js',
      'eas.json',
      'jest.setup.js',
    ],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: null,
        ecmaVersion: 2021,
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: sharedPlugins,
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      'unused-imports/no-unused-imports': 'off',
    },
  },
  {
    files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
    plugins: sharedPlugins,
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: null,
        ecmaVersion: 2021,
        sourceType: 'module',
      },
      globals: {
        ...globals.jest,
        ...globals.browser,
      },
    },
    rules: {
      'jest/expect-expect': 'warn',
    },
  },
  {
    files: ['__mocks__/**/*.{ts,tsx,js,jsx}', 'jest.mocks/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
  },
  {
    files: ['tools/scripts/**/*.cjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
