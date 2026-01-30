/**
 * Serviço de Notificações Locais e Push
 * Usa expo-notifications para notificações no dispositivo
 * Integra com Expo Push Notification Service para push remoto
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { defaultTheme } from '@/utils/styles';

import { logger } from './logger';
import { supabase } from './supabase';

const NOTIFICATION_SETTINGS_KEY = '@rotamestre:notification_settings';
const PUSH_TOKEN_KEY = '@rotamestre:push_token';

interface NotificationSettings {
  routeReminder: boolean;
  offlineAlert: boolean;
  routeComplete: boolean;
  reminderTime: string; // HH:mm format
}

const defaultSettings: NotificationSettings = {
  routeReminder: true,
  offlineAlert: true,
  routeComplete: true,
  reminderTime: '08:00',
};

// Configurar comportamento das notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Solicita permissão para notificações
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  return true;
}

/**
 * Obtém configurações de notificação
 */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const settingsStr = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (settingsStr) {
      return { ...defaultSettings, ...JSON.parse(settingsStr) };
    }
    return defaultSettings;
  } catch (error) {
    logger.error('[Notifications] Erro ao obter configurações', error);
    return defaultSettings;
  }
}

/**
 * Salva configurações de notificação
 */
export async function saveNotificationSettings(settings: Partial<NotificationSettings>): Promise<void> {
  try {
    const current = await getNotificationSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(updated));
  } catch (error) {
    logger.error('[Notifications] Erro ao salvar configurações', error);
  }
}

/**
 * Envia notificação local imediata
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: null, // Imediato
    });

    return id;
  } catch (error) {
    logger.error('[Notifications] Erro ao enviar notificação', error);
    return null;
  }
}

/**
 * Notificação de rota pendente
 */
export async function notifyRoutePending(unidadeNome: string): Promise<void> {
  const settings = await getNotificationSettings();
  if (!settings.routeReminder) return;

  await sendLocalNotification(
    'Rota Pendente',
    `Voce tem uma rota pendente para ${unidadeNome}. Toque para iniciar.`,
    { type: 'route_pending' }
  );
}

/**
 * Notificação de rota concluída
 */
export async function notifyRouteComplete(
  totalParadas: number,
  tempoTotal: string
): Promise<void> {
  const settings = await getNotificationSettings();
  if (!settings.routeComplete) return;

  await sendLocalNotification(
    'Rota Concluida!',
    `Parabens! Voce completou ${totalParadas} entregas em ${tempoTotal}.`,
    { type: 'route_complete' }
  );
}

/**
 * Notificação de modo offline
 */
export async function notifyOfflineMode(): Promise<void> {
  const settings = await getNotificationSettings();
  if (!settings.offlineAlert) return;

  await sendLocalNotification(
    'Modo Offline',
    'Voce esta sem conexao. As acoes serao sincronizadas quando a conexao for restaurada.',
    { type: 'offline_mode' }
  );
}

/**
 * Notificação de sincronização concluída
 */
export async function notifySyncComplete(
  actionsCount: number,
  photosCount: number
): Promise<void> {
  if (actionsCount === 0 && photosCount === 0) return;

  let message = 'Sincronização concluída: ';
  const parts: string[] = [];

  if (actionsCount > 0) {
    parts.push(`${actionsCount} ${actionsCount === 1 ? 'ação' : 'ações'}`);
  }
  if (photosCount > 0) {
    parts.push(`${photosCount} ${photosCount === 1 ? 'foto' : 'fotos'}`);
  }

  message += parts.join(' e ') + ' sincronizadas.';

  await sendLocalNotification('Sincronização', message, { type: 'sync_complete' });
}

/**
 * Agendar lembrete diário de rota
 */
export async function scheduleRouteReminder(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const settings = await getNotificationSettings();
  if (!settings.routeReminder) return null;

  // Cancelar lembretes anteriores
  await cancelRouteReminder();

  try {
    const [hours, minutes] = settings.reminderTime.split(':').map(Number);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Bom dia!',
        body: 'Verifique se voce tem rotas pendentes para hoje.',
        data: { type: 'daily_reminder' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hours,
        minute: minutes,
      },
    });

    return id;
  } catch (error) {
    logger.error('[Notifications] Erro ao agendar lembrete', error);
    return null;
  }
}

/**
 * Cancelar lembrete diário
 */
export async function cancelRouteReminder(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      if (notification.content.data?.type === 'daily_reminder') {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  } catch (error) {
    logger.error('[Notifications] Erro ao cancelar lembrete', error);
  }
}

/**
 * Listener para notificações recebidas (app em foreground)
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Listener para cliques em notificações
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

// ============================================================
// PUSH TOKEN REGISTRATION (Expo Push Notification Service)
// ============================================================

/**
 * Obtém o Expo Push Token do dispositivo
 * Requer que o app esteja rodando em um dispositivo físico
 */
export async function getExpoPushToken(): Promise<string | null> {
  // Push tokens não funcionam na web
  if (Platform.OS === 'web') {
    return null;
  }

  // Push tokens não funcionam no emulador (apenas dispositivo físico)
  if (!Device.isDevice) {
    return null;
  }

  try {
    // Verificar permissões primeiro
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    // Obter o token usando projectId do app.json/app.config.js
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      // Tentar alternativa
      const tokenData = await Notifications.getExpoPushTokenAsync();
      return tokenData.data;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (error) {
    logger.error('[Push] Erro ao obter push token', error);
    return null;
  }
}

/**
 * Registra o push token no banco de dados (tabela usuarios)
 * Deve ser chamado após o login do usuário
 */
export async function registerPushToken(userId: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const token = await getExpoPushToken();
    if (!token) {
      return false;
    }

    // Verificar se o token mudou
    const storedToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (storedToken === token) {
      return true;
    }

    // Atualizar token no banco
    const { error } = await supabase
      .from('usuarios')
      .update({ push_token: token })
      .eq('id', userId);

    if (error) {
      logger.error('[Push] Erro ao salvar token', error);
      return false;
    }

    // Salvar token localmente para comparação futura
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    return true;
  } catch (error) {
    logger.error('[Push] Erro ao registrar token', error);
    return false;
  }
}

/**
 * Remove o push token do banco de dados (logout)
 */
export async function unregisterPushToken(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    // Remover token do banco
    await supabase
      .from('usuarios')
      .update({ push_token: null })
      .eq('id', userId);

    // Limpar token local
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  } catch (error) {
    logger.error('[Push] Erro ao remover token', error);
  }
}

/**
 * Configura canais de notificação para Android
 * Diferentes canais para diferentes prioridades
 */
async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const { colors } = defaultTheme;

  // Canal padrão
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Notificações Gerais',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: colors.warning,
  });

  // Canal de emergência (SOS, incidentes)
  await Notifications.setNotificationChannelAsync('emergencia', {
    name: 'Emergências',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500],
    lightColor: colors.error,
    sound: 'default',
    bypassDnd: true, // Ignora "Não Perturbe"
  });
}

/**
 * Inicializar sistema de notificações
 * Inclui setup de canais Android e registro de push token
 */
export async function initializeNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  // Configurar canais Android
  await setupNotificationChannels();

  const hasPermission = await requestNotificationPermissions();
  if (hasPermission) {
    await scheduleRouteReminder();
  }
}

/**
 * Inicializar push notifications para usuário logado
 * Chame esta função após o login
 */
export async function initializePushNotifications(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  await registerPushToken(userId);
}

// Export service object
export const notificationService = {
  // Permissões e configurações
  requestPermissions: requestNotificationPermissions,
  getSettings: getNotificationSettings,
  saveSettings: saveNotificationSettings,

  // Notificações locais
  send: sendLocalNotification,
  notifyRoutePending,
  notifyRouteComplete,
  notifyOfflineMode,
  notifySyncComplete,

  // Lembretes
  scheduleRouteReminder,
  cancelRouteReminder,

  // Listeners
  addReceivedListener: addNotificationReceivedListener,
  addResponseListener: addNotificationResponseListener,

  // Inicialização
  initialize: initializeNotifications,

  // Push notifications
  getExpoPushToken,
  registerPushToken,
  unregisterPushToken,
  initializePush: initializePushNotifications,
};
