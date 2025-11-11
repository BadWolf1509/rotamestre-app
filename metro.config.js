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

// Better error handling and CORS for development
if (process.env.NODE_ENV === 'development') {
  config.server = {
    ...config.server,
    enhanceMiddleware: (middleware) => {
      return (req, res, next) => {
        // Add CORS headers for development
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        // Better error messages
        if (req.url?.includes('symbolicate')) {
          res.setHeader('Cache-Control', 'no-cache');
        }

        return middleware(req, res, next);
      };
    },
  };
}

module.exports = config;
