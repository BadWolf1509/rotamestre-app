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
      '.expo/**',
      'android',
      'ios',
      'supabase/.temp',
      'tools/scripts/node_modules/**',
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
