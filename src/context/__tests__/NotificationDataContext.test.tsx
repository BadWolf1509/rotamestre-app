import { renderHook } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

// Heavy mocks to prevent real Supabase/realtime from loading
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    })),
    removeChannel: jest.fn(),
    realtime: { setAuth: jest.fn() },
  },
}));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ session: null }) }));
jest.mock('@/hooks/useUser', () => ({ useUser: () => ({ userData: null }) }));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/utils/browserNotification', () => ({ notifyGenericWeb: jest.fn() }));
jest.mock('@/utils/haptics', () => ({ warningHaptic: jest.fn() }));
jest.mock('@/utils/notificationSound', () => ({ playNotificationSound: jest.fn() }));
jest.mock('@/utils/toast', () => ({ toast: { info: jest.fn(), error: jest.fn() } }));

import { useNotificationData, NotificationDataProvider } from '../NotificationDataContext';

describe('NotificationDataContext', () => {
  it('throws when useNotificationData is used outside provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useNotificationData())).toThrow(
      'useNotificationData must be used within NotificationDataProvider'
    );

    spy.mockRestore();
  });

  it('returns context value when used inside provider', () => {
    const { result } = renderHook(() => useNotificationData(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <NotificationDataProvider>{children}</NotificationDataProvider>
      ),
    });

    expect(result.current).toBeDefined();
    expect(result.current.notificacoes).toEqual([]);
    expect(result.current.naoLidas).toBe(0);
    expect(typeof result.current.loading).toBe('boolean');
    expect(typeof result.current.hasMore).toBe('boolean');
    expect(typeof result.current.marcarComoLida).toBe('function');
    expect(typeof result.current.marcarTodasComoLidas).toBe('function');
    expect(typeof result.current.refresh).toBe('function');
    expect(typeof result.current.loadMore).toBe('function');
  });

  it('renders children inside provider', () => {
    const { render } = require('@testing-library/react-native');
    const { getByText } = render(
      <NotificationDataProvider>
        <Text>Child Content</Text>
      </NotificationDataProvider>
    );

    expect(getByText('Child Content')).toBeTruthy();
  });
});
