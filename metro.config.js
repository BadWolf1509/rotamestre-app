const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

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

module.exports = config;
