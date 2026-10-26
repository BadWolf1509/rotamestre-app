/**
 * Tests: push notification wiring in useAuth
 *
 * Verifies that registerPushToken is called on SIGNED_IN.
 *
 * O SIGNED_OUT NÃO remove o token: o supabase-js dispara esse evento DEPOIS de
 * apagar a sessão, o UPDATE ia anônimo e a RLS filtrava 0 linhas sem erro. A
 * remoção mora em `authService.signOut`, antes do `auth.signOut` (ver
 * src/lib/__tests__/signout-limpa-push-e-estado.test.ts).
 *
 * Actual exported names (from src/lib/notifications.ts):
 *   - registerPushToken(userId: string): Promise<boolean>
 *   - unregisterPushToken(userId: string): Promise<void>
 */
import { renderHook, act } from '@testing-library/react-native';

import * as notifications from '../../lib/notifications';
import { useAuth } from '../useAuth';

// ------------------------------------------------------------------
// Mocks
// ------------------------------------------------------------------
jest.mock('../../lib/notifications', () => ({
  registerPushToken: jest.fn().mockResolvedValue(true),
  unregisterPushToken: jest.fn().mockResolvedValue(undefined),
  requestNotificationPermissions: jest.fn().mockResolvedValue(false),
  getNotificationSettings: jest.fn().mockResolvedValue({}),
  saveNotificationSettings: jest.fn().mockResolvedValue(undefined),
  sendLocalNotification: jest.fn().mockResolvedValue(null),
  notifyRouteComplete: jest.fn().mockResolvedValue(undefined),
  notifyOfflineMode: jest.fn().mockResolvedValue(undefined),
  notifySyncComplete: jest.fn().mockResolvedValue(undefined),
  scheduleRouteReminder: jest.fn().mockResolvedValue(null),
  cancelRouteReminder: jest.fn().mockResolvedValue(undefined),
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseListener: jest.fn(),
  initializeNotifications: jest.fn().mockResolvedValue(undefined),
  initializePushNotifications: jest.fn().mockResolvedValue(undefined),
  getExpoPushToken: jest.fn().mockResolvedValue(null),
  notificationService: {},
}));

jest.mock('../../lib/cache', () => ({
  clearAllCache: jest.fn().mockResolvedValue(undefined),
  cleanExpiredCache: jest.fn(),
}));

// NOTE: the variable must be prefixed with "mock" for Jest hoisting to allow
// it to be referenced inside the jest.mock() factory below.
const mockAuthCallbacks: Array<(event: string, session: unknown) => void> = [];

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn(
        (cb: (event: string, session: unknown) => void) => {
          mockAuthCallbacks.push(cb);
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        },
      ),
      signOut: jest.fn().mockResolvedValue({}),
    },
    realtime: {
      setAuth: jest.fn(),
    },
  },
  isSupabaseConfigured: true,
}));

// ------------------------------------------------------------------
const mockSession = {
  access_token: 'tok',
  refresh_token: 'ref',
  user: { id: 'user-42', email: 'driver@rotamestre.com' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthCallbacks.length = 0;
});

// ------------------------------------------------------------------
// Helper: mount the hook and flush the initial getSession promise
// ------------------------------------------------------------------
async function mountAndFlush() {
  const hook = renderHook(() => useAuth());
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 0));
  });
  return hook;
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------
describe('useAuth – push notification wiring', () => {
  it('calls registerPushToken with userId when SIGNED_IN event fires', async () => {
    await mountAndFlush();

    await act(async () => {
      mockAuthCallbacks[0]?.('SIGNED_IN', mockSession);
      await Promise.resolve();
    });

    expect(notifications.registerPushToken).toHaveBeenCalledTimes(1);
    expect(notifications.registerPushToken).toHaveBeenCalledWith('user-42');
  });

  it('NÃO chama unregisterPushToken no SIGNED_OUT (a sessão já saiu)', async () => {
    await mountAndFlush();

    // Sign in first so lastUserId.current is populated
    await act(async () => {
      mockAuthCallbacks[0]?.('SIGNED_IN', mockSession);
      await Promise.resolve();
    });

    await act(async () => {
      mockAuthCallbacks[0]?.('SIGNED_OUT', null);
      await Promise.resolve();
    });

    expect(notifications.unregisterPushToken).not.toHaveBeenCalled();
  });

  it('registra de novo depois de SIGNED_OUT + SIGNED_IN (troca de conta)', async () => {
    await mountAndFlush();

    await act(async () => {
      mockAuthCallbacks[0]?.('SIGNED_IN', mockSession);
      await Promise.resolve();
    });
    await act(async () => {
      mockAuthCallbacks[0]?.('SIGNED_OUT', null);
      await Promise.resolve();
    });
    await act(async () => {
      mockAuthCallbacks[0]?.('SIGNED_IN', mockSession);
      await Promise.resolve();
    });

    expect(notifications.registerPushToken).toHaveBeenCalledTimes(2);
  });

  it('does NOT crash when registerPushToken rejects', async () => {
    (notifications.registerPushToken as jest.Mock).mockRejectedValueOnce(
      new Error('push fail'),
    );

    await mountAndFlush();

    await expect(
      act(async () => {
        mockAuthCallbacks[0]?.('SIGNED_IN', mockSession);
        await Promise.resolve();
      }),
    ).resolves.not.toThrow();
  });

  it('does NOT call registerPushToken when session.user is null', async () => {
    await mountAndFlush();

    await act(async () => {
      mockAuthCallbacks[0]?.('SIGNED_IN', { user: null });
      await Promise.resolve();
    });

    expect(notifications.registerPushToken).not.toHaveBeenCalled();
  });

  it('does not re-register on duplicate SIGNED_IN events with same userId (token refresh)', async () => {
    await mountAndFlush();

    await act(async () => {
      mockAuthCallbacks[0]?.('SIGNED_IN', { user: { id: 'user-1' } });
      await Promise.resolve();
    });
    expect(notifications.registerPushToken).toHaveBeenCalledTimes(1);

    // Simulate token refresh firing another SIGNED_IN for the same user
    await act(async () => {
      mockAuthCallbacks[0]?.('SIGNED_IN', { user: { id: 'user-1' } });
      await Promise.resolve();
    });
    expect(notifications.registerPushToken).toHaveBeenCalledTimes(1);
  });

  it('useAuth não expõe signOut: o logout é authService.signOut', async () => {
    const { result } = await mountAndFlush();
    expect(result.current).not.toHaveProperty('signOut');
  });
});
