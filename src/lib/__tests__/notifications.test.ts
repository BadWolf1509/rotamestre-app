/**
 * Tests for notifications.ts
 * Serviço de notificações locais e push
 */

// Mock expo-notifications with inline jest.fn() - must be before any imports
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  AndroidImportance: {
    DEFAULT: 3,
    MAX: 5,
  },
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      eas: {
        projectId: 'test-project-id',
      },
    },
  },
}));

jest.mock('expo-device', () => ({
  isDevice: true,
}));

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null })),
      })),
    })),
  },
}));

// Import after mocks
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  requestNotificationPermissions,
  getNotificationSettings,
  saveNotificationSettings,
  sendLocalNotification,
  notifyRoutePending,
  notifyRouteComplete,
  notifyOfflineMode,
  notifySyncComplete,
  scheduleRouteReminder,
  cancelRouteReminder,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  getExpoPushToken,
  registerPushToken,
  unregisterPushToken,
  initializeNotifications,
  initializePushNotifications,
  notificationService,
} from '../notifications';

// Type the mocked functions
const mockScheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
const mockCancelScheduledNotificationAsync = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const mockGetAllScheduledNotificationsAsync = Notifications.getAllScheduledNotificationsAsync as jest.Mock;
const mockGetPermissionsAsync = Notifications.getPermissionsAsync as jest.Mock;
const mockRequestPermissionsAsync = Notifications.requestPermissionsAsync as jest.Mock;
const mockSetNotificationChannelAsync = Notifications.setNotificationChannelAsync as jest.Mock;
const mockGetExpoPushTokenAsync = Notifications.getExpoPushTokenAsync as jest.Mock;
const mockAddNotificationReceivedListener = Notifications.addNotificationReceivedListener as jest.Mock;
const mockAddNotificationResponseReceivedListener = Notifications.addNotificationResponseReceivedListener as jest.Mock;

describe('notifications', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockScheduleNotificationAsync.mockResolvedValue('notification-id');
    mockGetAllScheduledNotificationsAsync.mockResolvedValue([]);
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[xxx]' });

    // Reset Platform.OS
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      writable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', {
      value: originalPlatform,
      writable: true,
    });
  });

  describe('requestNotificationPermissions', () => {
    it('should return false on web', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

      const result = await requestNotificationPermissions();

      expect(result).toBe(false);
    });

    it('should return true when permission already granted', async () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });

      const result = await requestNotificationPermissions();

      expect(result).toBe(true);
    });

    it('should request permission when not granted', async () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' });
      mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });

      const result = await requestNotificationPermissions();

      expect(mockRequestPermissionsAsync).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when permission denied', async () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' });
      mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });

      const result = await requestNotificationPermissions();

      expect(result).toBe(false);
    });
  });

  describe('getNotificationSettings', () => {
    it('should return default settings when no stored settings', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const settings = await getNotificationSettings();

      expect(settings).toEqual({
        routeReminder: true,
        offlineAlert: true,
        routeComplete: true,
        reminderTime: '08:00',
      });
    });

    it('should return stored settings merged with defaults', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ routeReminder: false })
      );

      const settings = await getNotificationSettings();

      expect(settings.routeReminder).toBe(false);
      expect(settings.offlineAlert).toBe(true);
    });

    it('should return defaults on error', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const settings = await getNotificationSettings();

      expect(settings.routeReminder).toBe(true);
    });
  });

  describe('saveNotificationSettings', () => {
    it('should save settings to AsyncStorage', async () => {
      await saveNotificationSettings({ routeReminder: false });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@rotamestre:notification_settings',
        expect.any(String)
      );
    });

    it('should merge with existing settings', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ routeReminder: true, reminderTime: '09:00' })
      );

      await saveNotificationSettings({ routeReminder: false });

      const savedValue = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      const parsed = JSON.parse(savedValue);
      expect(parsed.routeReminder).toBe(false);
      expect(parsed.reminderTime).toBe('09:00');
    });

    it('should handle errors gracefully', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Save error'));

      // Should not throw
      await expect(saveNotificationSettings({ routeReminder: false })).resolves.toBeUndefined();
    });
  });

  describe('sendLocalNotification', () => {
    it('should return null on web', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

      const result = await sendLocalNotification('Title', 'Body');

      expect(result).toBe(null);
    });

    it('should schedule notification and return id', async () => {
      mockScheduleNotificationAsync.mockResolvedValue('notif-123');

      const result = await sendLocalNotification('Title', 'Body', { type: 'test' });

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'Title',
          body: 'Body',
          data: { type: 'test' },
          sound: true,
        },
        trigger: null,
      });
      expect(result).toBe('notif-123');
    });

    it('should return null on error', async () => {
      mockScheduleNotificationAsync.mockRejectedValue(new Error('Schedule error'));

      const result = await sendLocalNotification('Title', 'Body');

      expect(result).toBe(null);
    });
  });

  describe('notifyRoutePending', () => {
    it('should send notification when routeReminder enabled', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ routeReminder: true })
      );

      await notifyRoutePending('Unidade X');

      expect(mockScheduleNotificationAsync).toHaveBeenCalled();
    });

    it('should not send notification when routeReminder disabled', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ routeReminder: false })
      );

      await notifyRoutePending('Unidade X');

      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('notifyRouteComplete', () => {
    it('should send notification when routeComplete enabled', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ routeComplete: true })
      );

      await notifyRouteComplete(5, '2h 30min');

      expect(mockScheduleNotificationAsync).toHaveBeenCalled();
    });

    it('should not send notification when routeComplete disabled', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ routeComplete: false })
      );

      await notifyRouteComplete(5, '2h 30min');

      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('notifyOfflineMode', () => {
    it('should send notification when offlineAlert enabled', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ offlineAlert: true })
      );

      await notifyOfflineMode();

      expect(mockScheduleNotificationAsync).toHaveBeenCalled();
    });

    it('should not send notification when offlineAlert disabled', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ offlineAlert: false })
      );

      await notifyOfflineMode();

      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('notifySyncComplete', () => {
    it('should not send notification when both counts are 0', async () => {
      await notifySyncComplete(0, 0);

      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should send notification with actions count', async () => {
      await notifySyncComplete(3, 0);

      expect(mockScheduleNotificationAsync).toHaveBeenCalled();
    });

    it('should send notification with photos count', async () => {
      await notifySyncComplete(0, 2);

      expect(mockScheduleNotificationAsync).toHaveBeenCalled();
    });

    it('should send notification with both counts', async () => {
      await notifySyncComplete(3, 2);

      expect(mockScheduleNotificationAsync).toHaveBeenCalled();
    });
  });

  describe('scheduleRouteReminder', () => {
    it('should return null on web', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

      const result = await scheduleRouteReminder();

      expect(result).toBe(null);
    });

    it('should return null when routeReminder disabled', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ routeReminder: false })
      );

      const result = await scheduleRouteReminder();

      expect(result).toBe(null);
    });

    it('should schedule reminder and return id', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ routeReminder: true, reminderTime: '08:00' })
      );
      mockScheduleNotificationAsync.mockResolvedValue('reminder-123');

      const result = await scheduleRouteReminder();

      expect(mockScheduleNotificationAsync).toHaveBeenCalled();
      expect(result).toBe('reminder-123');
    });

    it('should cancel previous reminders before scheduling', async () => {
      mockGetAllScheduledNotificationsAsync.mockResolvedValue([
        { identifier: 'old-1', content: { data: { type: 'daily_reminder' } } },
      ]);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ routeReminder: true, reminderTime: '08:00' })
      );

      await scheduleRouteReminder();

      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('old-1');
    });

    it('should return null on error', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ routeReminder: true, reminderTime: '08:00' })
      );
      mockScheduleNotificationAsync.mockRejectedValue(new Error('Schedule error'));

      const result = await scheduleRouteReminder();

      expect(result).toBe(null);
    });
  });

  describe('cancelRouteReminder', () => {
    it('should do nothing on web', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

      await cancelRouteReminder();

      expect(mockGetAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    });

    it('should cancel daily reminder notifications', async () => {
      mockGetAllScheduledNotificationsAsync.mockResolvedValue([
        { identifier: 'reminder-1', content: { data: { type: 'daily_reminder' } } },
        { identifier: 'other-2', content: { data: { type: 'other' } } },
      ]);

      await cancelRouteReminder();

      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-1');
      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully', async () => {
      mockGetAllScheduledNotificationsAsync.mockRejectedValue(new Error('Error'));

      // Should not throw
      await expect(cancelRouteReminder()).resolves.toBeUndefined();
    });
  });

  describe('addNotificationReceivedListener', () => {
    it('should add listener', () => {
      const callback = jest.fn();

      addNotificationReceivedListener(callback);

      expect(mockAddNotificationReceivedListener).toHaveBeenCalledWith(callback);
    });
  });

  describe('addNotificationResponseListener', () => {
    it('should add listener', () => {
      const callback = jest.fn();

      addNotificationResponseListener(callback);

      expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalledWith(callback);
    });
  });

  describe('getExpoPushToken', () => {
    it('should return null on web', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

      const result = await getExpoPushToken();

      expect(result).toBe(null);
    });

    it('should return token when permissions granted', async () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
      mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[xxx]' });

      const result = await getExpoPushToken();

      expect(result).toBe('ExponentPushToken[xxx]');
    });

    it('should return null when permissions denied', async () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' });
      mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });

      const result = await getExpoPushToken();

      expect(result).toBe(null);
    });

    it('should return null on error', async () => {
      mockGetPermissionsAsync.mockRejectedValue(new Error('Error'));

      const result = await getExpoPushToken();

      expect(result).toBe(null);
    });
  });

  describe('registerPushToken', () => {
    it('should return false on web', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

      const result = await registerPushToken('user-123');

      expect(result).toBe(false);
    });

    it('should return true when token already stored', async () => {
      mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[xxx]' });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('ExponentPushToken[xxx]');

      const result = await registerPushToken('user-123');

      expect(result).toBe(true);
    });

    it('should return false when no token available', async () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' });
      mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });

      const result = await registerPushToken('user-123');

      expect(result).toBe(false);
    });
  });

  describe('unregisterPushToken', () => {
    it('should do nothing on web', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

      await unregisterPushToken('user-123');

      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should remove token from storage', async () => {
      await unregisterPushToken('user-123');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@rotamestre:push_token');
    });
  });

  describe('initializeNotifications', () => {
    it('should do nothing on web', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

      await initializeNotifications();

      expect(mockSetNotificationChannelAsync).not.toHaveBeenCalled();
    });

    it('should setup notification channels on Android', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });

      await initializeNotifications();

      expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith('default', expect.any(Object));
      expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith('emergencia', expect.any(Object));
    });

    it('should schedule route reminder when permissions granted', async () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ routeReminder: true, reminderTime: '08:00' })
      );

      await initializeNotifications();

      expect(mockScheduleNotificationAsync).toHaveBeenCalled();
    });
  });

  describe('initializePushNotifications', () => {
    it('should do nothing on web', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

      await initializePushNotifications('user-123');

      expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
    });

    it('should register push token', async () => {
      mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[xxx]' });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await initializePushNotifications('user-123');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@rotamestre:push_token',
        'ExponentPushToken[xxx]'
      );
    });
  });

  describe('notificationService', () => {
    it('should export all functions', () => {
      expect(notificationService.requestPermissions).toBe(requestNotificationPermissions);
      expect(notificationService.getSettings).toBe(getNotificationSettings);
      expect(notificationService.saveSettings).toBe(saveNotificationSettings);
      expect(notificationService.send).toBe(sendLocalNotification);
      expect(notificationService.notifyRoutePending).toBe(notifyRoutePending);
      expect(notificationService.notifyRouteComplete).toBe(notifyRouteComplete);
      expect(notificationService.notifyOfflineMode).toBe(notifyOfflineMode);
      expect(notificationService.notifySyncComplete).toBe(notifySyncComplete);
      expect(notificationService.scheduleRouteReminder).toBe(scheduleRouteReminder);
      expect(notificationService.cancelRouteReminder).toBe(cancelRouteReminder);
      expect(notificationService.addReceivedListener).toBe(addNotificationReceivedListener);
      expect(notificationService.addResponseListener).toBe(addNotificationResponseListener);
      expect(notificationService.initialize).toBe(initializeNotifications);
      expect(notificationService.getExpoPushToken).toBe(getExpoPushToken);
      expect(notificationService.registerPushToken).toBe(registerPushToken);
      expect(notificationService.unregisterPushToken).toBe(unregisterPushToken);
      expect(notificationService.initializePush).toBe(initializePushNotifications);
    });
  });
});
