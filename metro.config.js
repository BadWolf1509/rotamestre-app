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

// Fix for Supabase Realtime dynamic imports on web
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === 'web' &&
    moduleName.includes('async-require')
  ) {
    // Return a mock module for async-require on web
    return {
      type: 'empty',
    };
  }

  // Let Metro handle all other imports normally
  return context.resolveRequest(context, moduleName, platform);
};

// Add web-specific optimizations for Edge DevTools
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;
