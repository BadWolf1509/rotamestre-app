/**
 * Tests for NotificationModalContext.tsx
 * Contexto para controlar o modal de notificações
 */

import { renderHook, act, render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { View, Text, Pressable, BackHandler } from 'react-native';

import {
  useNotificationModal,
  NotificationModalProvider,
} from '../NotificationModalContext';

// Mock NotificationList
jest.mock('@/components/NotificationList', () => ({
  NotificationList: ({ onClose }: { onClose: () => void }) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View testID="notification-list">
        <Text>Notificações</Text>
        <Pressable testID="close-list" onPress={onClose}>
          <Text>Fechar</Text>
        </Pressable>
      </View>
    );
  },
}));

// Mock BackHandler using spyOn
const mockRemove = jest.fn();
const _mockAddEventListener = jest.spyOn(BackHandler, 'addEventListener')
  .mockImplementation(() => ({ remove: mockRemove }));

describe('NotificationModalContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useNotificationModal', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useNotificationModal());
      }).toThrow('useNotificationModal must be used within NotificationModalProvider');

      consoleSpy.mockRestore();
    });

    it('should return context values when used within provider', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NotificationModalProvider>{children}</NotificationModalProvider>
      );

      const { result } = renderHook(() => useNotificationModal(), { wrapper });

      expect(result.current.isOpen).toBe(false);
      expect(typeof result.current.openModal).toBe('function');
      expect(typeof result.current.closeModal).toBe('function');
    });
  });

  describe('NotificationModalProvider', () => {
    it('should render children', () => {
      const { getByText } = render(
        <NotificationModalProvider>
          <Text>Child Content</Text>
        </NotificationModalProvider>
      );

      expect(getByText('Child Content')).toBeTruthy();
    });

    it('should not show modal initially', () => {
      const { queryByTestId } = render(
        <NotificationModalProvider>
          <Text>Content</Text>
        </NotificationModalProvider>
      );

      expect(queryByTestId('notification-list')).toBeNull();
    });

    it('should show modal when openModal is called', () => {
      const TestComponent = () => {
        const { openModal, isOpen } = useNotificationModal();
        return (
          <View>
            <Pressable testID="open-button" onPress={openModal}>
              <Text>Open</Text>
            </Pressable>
            <Text testID="status">{isOpen ? 'open' : 'closed'}</Text>
          </View>
        );
      };

      const { getByTestId } = render(
        <NotificationModalProvider>
          <TestComponent />
        </NotificationModalProvider>
      );

      expect(getByTestId('status').children[0]).toBe('closed');

      fireEvent.press(getByTestId('open-button'));

      expect(getByTestId('status').children[0]).toBe('open');
      expect(getByTestId('notification-list')).toBeTruthy();
    });

    it('should close modal when closeModal is called', () => {
      const TestComponent = () => {
        const { openModal, closeModal, isOpen } = useNotificationModal();
        return (
          <View>
            <Pressable testID="open-button" onPress={openModal}>
              <Text>Open</Text>
            </Pressable>
            <Pressable testID="close-button" onPress={closeModal}>
              <Text>Close</Text>
            </Pressable>
            <Text testID="status">{isOpen ? 'open' : 'closed'}</Text>
          </View>
        );
      };

      const { getByTestId, queryByTestId } = render(
        <NotificationModalProvider>
          <TestComponent />
        </NotificationModalProvider>
      );

      // Open modal
      fireEvent.press(getByTestId('open-button'));
      expect(getByTestId('status').children[0]).toBe('open');

      // Close modal
      fireEvent.press(getByTestId('close-button'));
      expect(getByTestId('status').children[0]).toBe('closed');
      expect(queryByTestId('notification-list')).toBeNull();
    });

    it('should register BackHandler when modal is open', () => {
      const TestComponent = () => {
        const { openModal } = useNotificationModal();
        return (
          <Pressable testID="open-button" onPress={openModal}>
            <Text>Open</Text>
          </Pressable>
        );
      };

      const { getByTestId } = render(
        <NotificationModalProvider>
          <TestComponent />
        </NotificationModalProvider>
      );

      fireEvent.press(getByTestId('open-button'));

      expect(BackHandler.addEventListener).toHaveBeenCalledWith(
        'hardwareBackPress',
        expect.any(Function)
      );
    });
  });

  describe('Modal state', () => {
    it('should toggle isOpen correctly', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NotificationModalProvider>{children}</NotificationModalProvider>
      );

      const { result } = renderHook(() => useNotificationModal(), { wrapper });

      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.openModal();
      });
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.closeModal();
      });
      expect(result.current.isOpen).toBe(false);
    });
  });
});
