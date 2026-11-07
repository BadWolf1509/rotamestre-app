/**
 * Tests for ConnectivityIndicator.tsx (o ícone de conexão da Início do
 * motorista). O ConnectivityBanner, que dividia o arquivo, saiu em 07/11/2026:
 * não era montado em nenhuma tela.
 */

import { render } from '@testing-library/react-native';
import React from 'react';
import { Animated } from 'react-native';

import { ConnectivityIndicator } from '../ConnectivityIndicator';

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

describe('ConnectivityIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsOnline.mockReturnValue(true);
    mockUseNetworkStatus.mockReturnValue({
      connectionType: 'wifi',
      isWifi: true,
      isCellular: false,
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
