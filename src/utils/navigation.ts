/**
 * Utilitários para navegação externa (Waze, Google Maps, Apple Maps)
 */

import { Alert, Linking, Platform } from 'react-native';

import { logger } from '@/lib/logger';

export interface NavigationDestination {
  latitude: number;
  longitude: number;
  label?: string;
}

type NavigationApp = 'waze' | 'google-maps' | 'apple-maps';

/**
 * Gera URL para abrir app de navegação
 */
function getNavigationUrl(
  app: NavigationApp,
  destination: NavigationDestination,
): string {
  const { latitude, longitude, label } = destination;

  switch (app) {
    case 'waze':
      // Universal link, não o esquema custom: `waze://?ll=…` (e `waze://ul?…`)
      // abrem o app na tela inicial sem destino. Ver `gerarUrlWaze` em
      // `src/lib/navigation.ts` para a medição.
      return `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;
    case 'google-maps':
      // Android: use google.navigation para iniciar navegação diretamente
      // iOS: use comgooglemaps://
      if (Platform.OS === 'android') {
        return `google.navigation:q=${latitude},${longitude}`;
      }
      return `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=driving`;
    case 'apple-maps': {
      const encodedLabel = label ? encodeURIComponent(label) : '';
      return `maps://?daddr=${latitude},${longitude}&q=${encodedLabel}`;
    }
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  }
}

/**
 * Fallback URL (abre no navegador)
 */
function getWebFallbackUrl(destination: NavigationDestination): string {
  const { latitude, longitude } = destination;
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
}

/**
 * Tenta abrir um app de navegação específico
 */
async function tryOpenApp(
  app: NavigationApp,
  destination: NavigationDestination,
): Promise<boolean> {
  try {
    const url = getNavigationUrl(app, destination);
    // A URL do Waze é https, e https sempre passa no `canOpenURL` — sondar por
    // ela faria `openNavigation` dar Waze como aberto sem o app instalado e
    // nunca chegar no Google Maps. A detecção continua pelo esquema custom.
    const probeUrl = app === 'waze' ? 'waze://' : url;
    const canOpen = await Linking.canOpenURL(probeUrl);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
    return false;
  } catch (error) {
    logger.warn(`[Navigation] Erro ao abrir ${app}:`, error);
    return false;
  }
}

/**
 * Abre navegação para um destino, tentando Waze primeiro, depois Google Maps
 */
export async function openNavigation(
  destination: NavigationDestination,
): Promise<void> {
  // Tentar Waze primeiro
  const openedWaze = await tryOpenApp('waze', destination);
  if (openedWaze) return;

  // Tentar Google Maps
  const openedGoogleMaps = await tryOpenApp('google-maps', destination);
  if (openedGoogleMaps) return;

  // iOS: tentar Apple Maps
  if (Platform.OS === 'ios') {
    const openedAppleMaps = await tryOpenApp('apple-maps', destination);
    if (openedAppleMaps) return;
  }

  // Fallback: abrir no navegador
  try {
    await Linking.openURL(getWebFallbackUrl(destination));
  } catch (error) {
    Alert.alert(
      'Erro',
      'Não foi possível abrir nenhum app de navegação. Verifique se você tem o Waze ou Google Maps instalado.',
      [{ text: 'OK' }],
    );
    logger.warn('[Navigation] Erro ao abrir fallback:', error);
  }
}

/**
 * Mostra seletor de app de navegação
 */
export function showNavigationOptions(
  destination: NavigationDestination,
): void {
  const options: {
    text: string;
    onPress?: () => void;
    style?: 'cancel' | 'default' | 'destructive';
  }[] = [];

  // Adicionar opções de navegação
  options.push({
    text: 'Waze',
    onPress: () =>
      tryOpenApp('waze', destination).then((success) => {
        if (!success) {
          Alert.alert(
            'Waze não instalado',
            'Instale o Waze para usar esta opção.',
          );
        }
      }),
  });

  options.push({
    text: 'Google Maps',
    onPress: () =>
      tryOpenApp('google-maps', destination).then((success) => {
        if (!success) {
          Linking.openURL(getWebFallbackUrl(destination));
        }
      }),
  });

  if (Platform.OS === 'ios') {
    options.push({
      text: 'Apple Maps',
      onPress: () => tryOpenApp('apple-maps', destination),
    });
  }

  options.push({
    text: 'Cancelar',
    style: 'cancel',
  });

  Alert.alert('Navegar com', 'Escolha o app de navegação', options);
}

/**
 * Gera URL para compartilhar localização
 */
export function getShareLocationUrl(
  destination: NavigationDestination,
): string {
  const { latitude, longitude, label } = destination;
  const encodedLabel = label ? encodeURIComponent(label) : '';
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}&query_place_id=${encodedLabel}`;
}
