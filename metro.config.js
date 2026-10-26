const _path = require('path');

const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable source maps for better debugging in Edge DevTools
if (process.env.NODE_ENV === 'development') {
  config.transformer = {
    ...config.transformer,
    minifierConfig: {
      keep_fnames: true, // Preserve function names for debugging
      mangle: {
        keep_fnames: true,
      },
    },
  };
}

// Enable inlineRequires to fix barrel file re-export undefined issues
// This is enabled by default in React Native CLI but not in Expo
// See: https://github.com/expo/expo/issues/27279
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

// Adicionar suporte para copiar arquivos públicos
config.resolver.assetExts.push(
  // Assets que devem ser copiados
  'png',
  'jpg',
  'jpeg',
  'svg',
  'json',
  'txt',
  'xml'
);

// Sem resolver próprio para `async-require`: é o módulo que faz o `import()`
// dinâmico funcionar no web (exportação de PDF/XLSX). Trocá-lo por módulo vazio
// mantém o build verde e quebra todo `import()` em produção — guarda em
// src/lib/__tests__/metro-config-import-dinamico.test.ts.

// Add web-specific optimizations for Edge DevTools
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;
