/**
 * Serviço Unificado de Rastreamento de Localização
 *
 * Gerencia o rastreamento de localização do motorista em todos os cenários:
 * - App aberto (foreground): Alta precisão, updates frequentes
 * - App em background: Foreground Service (Android) / Background Modes (iOS)
 * - App fechado: Mantém tracking via Foreground Service (Android)
 *
 * @see https://docs.expo.dev/versions/latest/sdk/location/
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Alert } from 'react-native';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { defaultTheme } from '@/utils/styles';

// ========================================
// CONSTANTES
// ========================================
const BACKGROUND_LOCATION_TASK = 'rotamestre-background-location';
const TRACKING_CONTEXT_KEY = '@rotamestre:tracking_context';

// Configurações de tracking
const CONFIG = {
  // Foreground (app aberto)
  foreground: {
    accuracy: Location.Accuracy.High,
    timeInterval: 10000, // 10 segundos
    distanceInterval: 20, // 20 metros
  },
  // Background (app minimizado/fechado)
  background: {
    accuracy: Location.Accuracy.Balanced, // Economia de bateria
    distanceInterval: 50, // 50 metros mínimo
    deferredUpdatesInterval: 30000, // 30 segundos
    deferredUpdatesDistance: 100, // 100 metros
  },
};

// ========================================
// TIPOS
// ========================================
export interface TrackingContext {
  rotaId: string;
  motoristaId: string;
  motoristaNome: string;
  startedAt: string;
}

export interface LocationPermissions {
  foreground: boolean;
  background: boolean;
}

// ========================================
// TASK DE BACKGROUND (escopo global)
// ========================================
// IMPORTANTE: Esta definição deve estar no escopo global do módulo
// e será executada quando o módulo for importado
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    logger.error('[BackgroundLocation] Task error', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];

    if (location) {
      await saveLocationToDatabase(location, 'background');
    }
  }
});

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

/**
 * Salva localização no banco de dados
 */
async function saveLocationToDatabase(
  location: Location.LocationObject,
  fonte: 'foreground' | 'background',
): Promise<void> {
  try {
    const contextStr = await AsyncStorage.getItem(TRACKING_CONTEXT_KEY);
    if (!contextStr) {
      return;
    }

    const context: TrackingContext = JSON.parse(contextStr);

    const { error } = await supabase.from('motorista_locations').insert({
      motorista_id: context.motoristaId,
      rota_id: context.rotaId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      velocidade: location.coords.speed ? location.coords.speed * 3.6 : null, // m/s -> km/h
      precisao: location.coords.accuracy,
      heading: location.coords.heading,
      fonte, // Identificar origem do update
    });

    if (error) {
      logger.error('[LocationTracking] Erro ao salvar', error);
    }
  } catch (err) {
    logger.error('[LocationTracking] Erro', err);
  }
}

// ========================================
// API PÚBLICA
// ========================================

/**
 * Solicita permissões de localização
 * Retorna objeto com status de cada tipo de permissão
 */
export async function requestLocationPermissions(): Promise<LocationPermissions> {
  const currentForeground = await Location.getForegroundPermissionsAsync();
  const foregroundStatus =
    currentForeground.status === 'granted'
      ? currentForeground.status
      : (await Location.requestForegroundPermissionsAsync()).status;
  const foregroundGranted = foregroundStatus === 'granted';

  if (!foregroundGranted) {
    return { foreground: false, background: false };
  }

  const currentBackground = await Location.getBackgroundPermissionsAsync();
  if (currentBackground.status === 'granted') {
    return { foreground: true, background: true };
  }

  // Exigência de divulgação destacada do Google Play: explicar, dentro do app
  // e antes do diálogo do Android, o uso quando o app não está em uso.
  const acceptedDisclosure = await showBackgroundLocationDisclosure();
  if (!acceptedDisclosure) {
    return { foreground: true, background: false };
  }

  const { status: backgroundStatus } =
    await Location.requestBackgroundPermissionsAsync();
  const backgroundGranted = backgroundStatus === 'granted';

  return { foreground: foregroundGranted, background: backgroundGranted };
}

export function showBackgroundLocationDisclosure(): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value: boolean) => {
      if (!resolved) {
        resolved = true;
        resolve(value);
      }
    };

    Alert.alert(
      'Localização durante a rota',
      'Durante uma rota ativa, o Rota Mestre coleta e envia sua localização mesmo quando o app está fechado ou não está em uso. Isso mantém a navegação funcionando e permite que o gestor da sua empresa acompanhe a entrega em tempo real. A coleta para quando a rota é pausada ou encerrada.',
      [
        {
          text: 'Agora não',
          style: 'cancel',
          onPress: () => finish(false),
        },
        {
          text: 'Continuar',
          onPress: () => finish(true),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => finish(false),
      },
    );
  });
}

/**
 * Verifica status atual das permissões
 */
export async function checkLocationPermissions(): Promise<LocationPermissions> {
  const { status: foregroundStatus } =
    await Location.getForegroundPermissionsAsync();
  const { status: backgroundStatus } =
    await Location.getBackgroundPermissionsAsync();

  return {
    foreground: foregroundStatus === 'granted',
    background: backgroundStatus === 'granted',
  };
}

/**
 * Inicia o rastreamento em background
 * Chamado quando o motorista inicia uma rota
 */
export async function startBackgroundTracking(
  context: TrackingContext,
): Promise<boolean> {
  try {
    // Verificar permissões
    const permissions = await checkLocationPermissions();
    if (!permissions.foreground) {
      logger.warn('[LocationTracking] Sem permissão de foreground');
      return false;
    }

    // Salvar contexto para uso na task de background
    await AsyncStorage.setItem(TRACKING_CONTEXT_KEY, JSON.stringify(context));

    // Verificar se já está rastreando
    const isTracking = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (isTracking) {
      return true;
    }

    // Se não tem permissão de background, apenas salvar contexto
    // O hook useDriverLocationBroadcast cuidará do foreground
    if (!permissions.background) {
      return true;
    }

    // Configuração do tracking
    const options: Location.LocationTaskOptions = {
      accuracy: CONFIG.background.accuracy,
      distanceInterval: CONFIG.background.distanceInterval,
      deferredUpdatesInterval: CONFIG.background.deferredUpdatesInterval,
      deferredUpdatesDistance: CONFIG.background.deferredUpdatesDistance,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,

      // iOS: Tipo de atividade para otimização
      activityType: Location.ActivityType.AutomotiveNavigation,

      // Android: Foreground Service com notificação persistente
      foregroundService: {
        notificationTitle: '🚗 RotaMestre - Em rota',
        notificationBody: `Rastreando entrega`,
        notificationColor: defaultTheme.colors.primary,
      },
    };

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, options);

    return true;
  } catch (err) {
    logger.error('[LocationTracking] Erro ao iniciar', err);
    return false;
  }
}

/**
 * Para o rastreamento em background
 * Chamado quando o motorista finaliza ou pausa a rota
 */
export async function stopBackgroundTracking(): Promise<void> {
  try {
    const isTracking = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (isTracking) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
    await AsyncStorage.removeItem(TRACKING_CONTEXT_KEY);
  } catch (err) {
    logger.error('[LocationTracking] Erro ao parar', err);
  }
}

/**
 * Verifica se o rastreamento em background está ativo
 */
export async function isBackgroundTrackingActive(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
  } catch (error) {
    logger.warn(
      '[LocationTracking] Falha ao verificar task de localização',
      error,
    );
    return false;
  }
}

/**
 * Obtém o contexto de rastreamento atual
 */
export async function getTrackingContext(): Promise<TrackingContext | null> {
  try {
    const contextStr = await AsyncStorage.getItem(TRACKING_CONTEXT_KEY);
    return contextStr ? JSON.parse(contextStr) : null;
  } catch (error) {
    logger.warn(
      '[LocationTracking] Falha ao ler contexto de localização',
      error,
    );
    return null;
  }
}

/**
 * Atualiza o contexto de rastreamento
 * Útil para atualizar informações sem reiniciar o tracking
 */
export async function updateTrackingContext(
  updates: Partial<TrackingContext>,
): Promise<void> {
  try {
    const current = await getTrackingContext();
    if (current) {
      await AsyncStorage.setItem(
        TRACKING_CONTEXT_KEY,
        JSON.stringify({ ...current, ...updates }),
      );
    }
  } catch (err) {
    logger.error('[LocationTracking] Erro ao atualizar contexto', err);
  }
}

/**
 * Solicita permissões e inicia tracking com UI amigável
 * Mostra alertas explicativos para o usuário
 */
export async function requestAndStartTracking(
  context: TrackingContext,
): Promise<{ started: boolean; hasBackgroundPermission: boolean }> {
  // Solicitar permissões
  const permissions = await requestLocationPermissions();

  if (!permissions.foreground) {
    Alert.alert(
      'Permissão Necessária',
      'O RotaMestre precisa acessar sua localização para rastrear as entregas. Por favor, ative a localização nas configurações.',
      [{ text: 'OK' }],
    );
    return { started: false, hasBackgroundPermission: false };
  }

  // Iniciar tracking
  const started = await startBackgroundTracking(context);

  if (started && !permissions.background) {
    // Informar limitação
    Alert.alert(
      'Rastreamento Limitado',
      'Sem permissão de localização em segundo plano, o gestor só poderá acompanhar sua rota enquanto o app estiver aberto.\n\nPara rastreamento contínuo, ative "Sempre" nas configurações de localização.',
      [{ text: 'Entendi' }],
    );
  }

  return { started, hasBackgroundPermission: permissions.background };
}

// Tipos já exportados no início do arquivo:
// - TrackingContext (linha 45)
// - LocationPermissions (linha 52)
