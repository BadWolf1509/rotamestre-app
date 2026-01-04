/**
 * Tests for ConnectivityBanner.tsx
 * Banner de conectividade com 2 componentes: ConnectivityBanner, ConnectivityIndicator
 */

import { render } from '@testing-library/react-native';
import React from 'react';
import { Animated } from 'react-native';

import {
  ConnectivityBanner,
  ConnectivityIndicator,
} from '../ConnectivityBanner';

// Mock hooks
const mockUseIsOnline = jest.fn();
const mockUseNetworkStatus = jest.fn();

jest.mock('@/hooks/useNetworkStatus', () => ({
  useIsOnline: () => mockUseIsOnline(),
  useNetworkStatus: () => mockUseNetworkStatus(),
}));

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
      success: '#10b981',
      successBg: '#d1fae5',
      warning: '#f7a02a',
      error: '#ef4444',
      errorBg: '#fee2e2',
      white: '#ffffff',
      gray500: '#6b7280',
      gray600: '#4b5563',
    },
    spacing: { xs: 4, sm: 8, md: 12 },
    borderRadius: { md: 10 },
    zIndex: { banner: 90 },
    typography: { fontSansSemiBold: 'NunitoSans-SemiBold' },
    components: {
      connectivityBanner: {
        paddingV: 8,
        messageFontSize: 13,
        badgePaddingH: 8,
        badgePaddingV: 4,
        badgeFontSize: 11,
        badgeBorderRadius: 12,
        dotSize: 8,
      },
    },
  };

  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: (t: typeof theme) => Record<string, unknown>) => fn(theme),
    },
  };
});

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, testID }: { name: string; testID?: string }) => {
    const { Text } = require('react-native');
    return <Text testID={testID || `icon-${name}`}>{name}</Text>;
  },
}));

// Mock Animated
jest.spyOn(Animated, 'spring').mockReturnValue({
  start: jest.fn(),
  stop: jest.fn(),
  reset: jest.fn(),
} as any);

jest.spyOn(Animated, 'timing').mockReturnValue({
  start: jest.fn(),
  stop: jest.fn(),
  reset: jest.fn(),
} as any);

jest.spyOn(Animated, 'loop').mockReturnValue({
  start: jest.fn(),
  stop: jest.fn(),
  reset: jest.fn(),
} as any);

jest.spyOn(Animated, 'sequence').mockReturnValue({
  start: jest.fn(),
  stop: jest.fn(),
  reset: jest.fn(),
} as any);

describe('ConnectivityBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsOnline.mockReturnValue(true);
    mockUseNetworkStatus.mockReturnValue({
      connectionType: 'wifi',
      isWifi: true,
      isCellular: false,
    });
  });

  describe('ConnectivityBanner component', () => {
    it('should not render when online and not showing reconnect', () => {
      mockUseIsOnline.mockReturnValue(true);

      const { queryByText } = render(<ConnectivityBanner />);

      expect(queryByText('Sem conexão com a internet')).toBeNull();
    });

    it('should render offline message when offline', () => {
      mockUseIsOnline.mockReturnValue(false);

      const { getByText } = render(<ConnectivityBanner />);

      expect(getByText('Sem conexão com a internet')).toBeTruthy();
    });

    it('should show cloud-offline icon when offline', () => {
      mockUseIsOnline.mockReturnValue(false);

      const { getByTestId } = render(<ConnectivityBanner />);

      expect(getByTestId('icon-cloud-offline')).toBeTruthy();
    });

    it('should apply top position by default', () => {
      mockUseIsOnline.mockReturnValue(false);

      const { getByText } = render(<ConnectivityBanner />);

      expect(getByText('Sem conexão com a internet')).toBeTruthy();
    });

    it('should accept bottom position prop', () => {
      mockUseIsOnline.mockReturnValue(false);

      const { getByText } = render(<ConnectivityBanner position="bottom" />);

      expect(getByText('Sem conexão com a internet')).toBeTruthy();
    });

    it('should accept showOnReconnect prop', () => {
      mockUseIsOnline.mockReturnValue(false);

      const { getByText } = render(<ConnectivityBanner showOnReconnect={false} />);

      expect(getByText('Sem conexão com a internet')).toBeTruthy();
    });

    it('should accept reconnectDuration prop', () => {
      mockUseIsOnline.mockReturnValue(false);

      const { getByText } = render(<ConnectivityBanner reconnectDuration={5000} />);

      expect(getByText('Sem conexão com a internet')).toBeTruthy();
    });
  });

  describe('ConnectivityIndicator component', () => {
    it('should render wifi icon when connected via wifi', () => {
      mockUseIsOnline.mockReturnValue(true);
      mockUseNetworkStatus.mockReturnValue({
        connectionType: 'wifi',
        isWifi: true,
        isCellular: false,
      });

      const { getByText } = render(<ConnectivityIndicator />);

      expect(getByText('wifi')).toBeTruthy();
    });

    it('should render cellular icon when connected via cellular', () => {
      mockUseIsOnline.mockReturnValue(true);
      mockUseNetworkStatus.mockReturnValue({
        connectionType: 'cellular',
        isWifi: false,
        isCellular: true,
      });

      const { getByText } = render(<ConnectivityIndicator />);

      expect(getByText('cellular')).toBeTruthy();
    });

    it('should render globe icon when connected but not wifi or cellular', () => {
      mockUseIsOnline.mockReturnValue(true);
      mockUseNetworkStatus.mockReturnValue({
        connectionType: 'ethernet',
        isWifi: false,
        isCellular: false,
      });

      const { getByText } = render(<ConnectivityIndicator />);

      expect(getByText('globe')).toBeTruthy();
    });

    it('should render cloud-offline icon when offline', () => {
      mockUseIsOnline.mockReturnValue(false);
      mockUseNetworkStatus.mockReturnValue({
        connectionType: null,
        isWifi: false,
        isCellular: false,
      });

      const { getByText } = render(<ConnectivityIndicator />);

      expect(getByText('cloud-offline')).toBeTruthy();
    });
  });
});
