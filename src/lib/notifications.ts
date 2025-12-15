/**
 * Serviço de Notificações Locais
 * Usa expo-notifications para notificações no dispositivo
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const NOTIFICATION_SETTINGS_KEY = '@rotamestre:notification_settings';

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
    console.log('🔔 Permissão de notificações não concedida');
    return false;
  }

  console.log('🔔 Permissão de notificações concedida');
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
    console.error('Erro ao obter configurações de notificação:', error);
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
    console.error('Erro ao salvar configurações de notificação:', error);
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
    console.log(`🔔 [Web] ${title}: ${body}`);
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

    console.log(`🔔 Notificação enviada: ${id}`);
    return id;
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
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

  let message = 'Sincronizacao concluida: ';
  const parts: string[] = [];

  if (actionsCount > 0) {
    parts.push(`${actionsCount} ${actionsCount === 1 ? 'acao' : 'acoes'}`);
  }
  if (photosCount > 0) {
    parts.push(`${photosCount} ${photosCount === 1 ? 'foto' : 'fotos'}`);
  }

  message += parts.join(' e ') + ' sincronizadas.';

  await sendLocalNotification('Sincronizacao', message, { type: 'sync_complete' });
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

    console.log(`🔔 Lembrete diário agendado para ${settings.reminderTime}: ${id}`);
    return id;
  } catch (error) {
    console.error('Erro ao agendar lembrete:', error);
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
    console.error('Erro ao cancelar lembrete:', error);
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

/**
 * Inicializar sistema de notificações
 */
export async function initializeNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  const hasPermission = await requestNotificationPermissions();
  if (hasPermission) {
    await scheduleRouteReminder();
  }
}

// Export service object
export const notificationService = {
  requestPermissions: requestNotificationPermissions,
  getSettings: getNotificationSettings,
  saveSettings: saveNotificationSettings,
  send: sendLocalNotification,
  notifyRoutePending,
  notifyRouteComplete,
  notifyOfflineMode,
  notifySyncComplete,
  scheduleRouteReminder,
  cancelRouteReminder,
  addReceivedListener: addNotificationReceivedListener,
  addResponseListener: addNotificationResponseListener,
  initialize: initializeNotifications,
};
