import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Importa versão diretamente do package.json (funciona em todas as plataformas)
 
const packageJson = require('../../package.json');

/**
 * Utilitário centralizado para informações de versão do app
 * Fonte única de verdade: package.json
 */

/**
 * Retorna a versão do app (lê diretamente do package.json)
 */
export function getAppVersion(): string {
  // Prioriza package.json (funciona em web), fallback para expo-constants
  return packageJson.version || Constants.expoConfig?.version || '1.0.0';
}

/**
 * Retorna o código de build do Android (ex: 3005)
 */
export function getBuildNumber(): string {
  if (Platform.OS === 'android') {
    return String(Constants.expoConfig?.android?.versionCode || 'N/A');
  }
  if (Platform.OS === 'ios') {
    return Constants.expoConfig?.ios?.buildNumber || 'N/A';
  }
  // Web não tem build number
  return '0.0.0';
}

/**
 * Retorna o nome da plataforma formatado
 */
export function getPlatformName(): string {
  switch (Platform.OS) {
    case 'ios':
      return 'iOS';
    case 'android':
      return 'Android';
    case 'web':
      return 'Web';
    default:
      return Platform.OS;
  }
}

/**
 * Retorna informações completas de versão
 */
export function getVersionInfo() {
  return {
    version: getAppVersion(),
    buildNumber: getBuildNumber(),
    platform: getPlatformName(),
    runtimeVersion: Constants.expoConfig?.runtimeVersion,
  };
}

/**
 * Retorna string formatada para exibição (ex: "Versão 1.4.0")
 */
export function getVersionString(): string {
  return `Versão ${getAppVersion()}`;
}

/**
 * Retorna string completa para debug (ex: "1.4.0 (3005) - Android")
 */
export function getFullVersionString(): string {
  const info = getVersionInfo();
  return `${info.version} (${info.buildNumber}) - ${info.platform}`;
}
