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

module.exports = config;
