import { renderHook } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import React from 'react';

import { useDesktopHeaderMenu } from '../useDesktopHeaderMenu';

// Mock dependencies
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('../useLogoutConfirmation', () => ({
  useLogoutConfirmation: jest.fn(() => ({
    showLogoutModal: jest.fn(),
    logoutModal: <div>Logout Modal</div>,
  })),
}));

jest.mock('@/components/UserMenuTrigger', () => ({
  UserMenuTrigger: ({ name, isOpen }: { name?: string; isOpen: boolean }) => (
    <div data-name={name} data-is-open={isOpen}>
      UserMenuTrigger
    </div>
  ),
}));

describe('useDesktopHeaderMenu', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useDesktopHeaderMenu());

    expect(typeof result.current.userMenuTrigger).toBe('function');
    expect(result.current.userMenuItems).toHaveLength(2);
    expect(result.current.logoutModal).toBeTruthy();
    expect(typeof result.current.openLogoutModal).toBe('function');
  });

  it('should create userMenuTrigger with userName', () => {
    const { result } = renderHook(() =>
      useDesktopHeaderMenu({ userName: 'John Doe' })
    );

    const trigger = result.current.userMenuTrigger(true);
    expect(trigger).toBeTruthy();
    expect(trigger.type).toBeTruthy();
  });

  it('should create userMenuTrigger without userName', () => {
    const { result } = renderHook(() => useDesktopHeaderMenu());

    const trigger = result.current.userMenuTrigger(false);
    expect(trigger).toBeTruthy();
  });

  it('should memoize userMenuTrigger when userName does not change', () => {
    const { result, rerender } = renderHook(
      (props) => useDesktopHeaderMenu(props),
      {
        initialProps: { userName: 'John Doe' },
      }
    );

    const firstTrigger = result.current.userMenuTrigger;

    rerender({ userName: 'John Doe' });

    expect(result.current.userMenuTrigger).toBe(firstTrigger);
  });

  it('should update userMenuTrigger when userName changes', () => {
    const { result, rerender } = renderHook(
      (props) => useDesktopHeaderMenu(props),
      {
        initialProps: { userName: 'John Doe' },
      }
    );

    const firstTrigger = result.current.userMenuTrigger;

    rerender({ userName: 'Jane Doe' });

    expect(result.current.userMenuTrigger).not.toBe(firstTrigger);
  });

  describe('userMenuItems', () => {
    it('should return two menu items', () => {
      const { result } = renderHook(() => useDesktopHeaderMenu());

      expect(result.current.userMenuItems).toHaveLength(2);
    });

    it('should have "Meu Perfil" as first item', () => {
      const { result } = renderHook(() => useDesktopHeaderMenu());

      const profileItem = result.current.userMenuItems[0];

      expect(profileItem.label).toBe('Meu Perfil');
      expect(profileItem.icon).toBe('person-outline');
      expect(typeof profileItem.onPress).toBe('function');
    });

    it('should have "Sair" as second item', () => {
      const { result } = renderHook(() => useDesktopHeaderMenu());

      const logoutItem = result.current.userMenuItems[1];

      expect(logoutItem.label).toBe('Sair');
      expect(logoutItem.icon).toBe('log-out-outline');
      expect(logoutItem.destructive).toBe(true);
      expect(typeof logoutItem.onPress).toBe('function');
    });

    it('should navigate to default profile route when profile item pressed', () => {
      const { result } = renderHook(() => useDesktopHeaderMenu());

      const profileItem = result.current.userMenuItems[0];
      profileItem.onPress();

      expect(mockPush).toHaveBeenCalledWith('/perfil');
    });

    it('should navigate to custom profile route when provided', () => {
      const { result } = renderHook(() =>
        useDesktopHeaderMenu({ profileRoute: '/custom-profile' })
      );

      const profileItem = result.current.userMenuItems[0];
      profileItem.onPress();

      expect(mockPush).toHaveBeenCalledWith('/custom-profile');
    });

    it('should call showLogoutModal when logout item pressed', () => {
      const mockShowLogout = jest.fn();

      // Re-mock useLogoutConfirmation to capture the call
      const { useLogoutConfirmation } = require('../useLogoutConfirmation');
      (useLogoutConfirmation as jest.Mock).mockReturnValue({
        showLogoutModal: mockShowLogout,
        logoutModal: <div>Modal</div>,
      });

      const { result } = renderHook(() => useDesktopHeaderMenu());

      const logoutItem = result.current.userMenuItems[1];
      logoutItem.onPress();

      expect(mockShowLogout).toHaveBeenCalled();
    });

    it('should memoize userMenuItems when dependencies do not change', () => {
      const { result, rerender } = renderHook(
        (props) => useDesktopHeaderMenu(props),
        {
          initialProps: { userName: 'John', profileRoute: '/perfil' },
        }
      );

      const firstItems = result.current.userMenuItems;

      rerender({ userName: 'John', profileRoute: '/perfil' });

      expect(result.current.userMenuItems).toBe(firstItems);
    });

    it('should update userMenuItems when profileRoute changes', () => {
      const { result, rerender } = renderHook(
        (props) => useDesktopHeaderMenu(props),
        {
          initialProps: { profileRoute: '/perfil' },
        }
      );

      const firstItems = result.current.userMenuItems;

      rerender({ profileRoute: '/new-profile' });

      expect(result.current.userMenuItems).not.toBe(firstItems);
    });
  });

  describe('logoutModal and openLogoutModal', () => {
    it('should expose logoutModal from useLogoutConfirmation', () => {
      const { result } = renderHook(() => useDesktopHeaderMenu());

      expect(result.current.logoutModal).toBeTruthy();
    });

    it('should expose openLogoutModal as alias for showLogoutModal', () => {
      const mockShowLogout = jest.fn();

      const { useLogoutConfirmation } = require('../useLogoutConfirmation');
      (useLogoutConfirmation as jest.Mock).mockReturnValue({
        showLogoutModal: mockShowLogout,
        logoutModal: <div>Modal</div>,
      });

      const { result } = renderHook(() => useDesktopHeaderMenu());

      expect(typeof result.current.openLogoutModal).toBe('function');
      result.current.openLogoutModal();

      expect(mockShowLogout).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle null userName', () => {
      const { result } = renderHook(() =>
        useDesktopHeaderMenu({ userName: null })
      );

      const trigger = result.current.userMenuTrigger(true);
      expect(trigger).toBeTruthy();
    });

    it('should handle undefined options', () => {
      const { result } = renderHook(() => useDesktopHeaderMenu(undefined));

      expect(result.current.userMenuItems).toHaveLength(2);
      expect(typeof result.current.userMenuTrigger).toBe('function');
    });

    it('should handle empty options object', () => {
      const { result } = renderHook(() => useDesktopHeaderMenu({}));

      expect(result.current.userMenuItems).toHaveLength(2);
    });
  });
});
