import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { NavigationSettings } from '../NavigationSettings';

declare global {
  var mockUseAlert: {
    showConfirm: jest.Mock;
  };
}

// Padrões ALTERADOS: só a leitura da tabela única pode fazer o teste passar.
jest.mock('@/lib/motorista/preferenciasNavegacaoPadrao', () => {
  const real = jest.requireActual(
    '@/lib/motorista/preferenciasNavegacaoPadrao',
  );
  return {
    ...real,
    PREFERENCIAS_PADRAO: {
      ...real.PREFERENCIAS_PADRAO,
      navegarCom: 'externo',
      proximityRadius: 80,
    },
  };
});

jest.mock('@/services/locationTracking', () => ({
  __esModule: true,
  default: {
    getNavigationPreferences: jest.fn().mockResolvedValue({}),
    updateNavigationPreferences: jest.fn().mockResolvedValue(undefined),
    restaurarPreferenciasPadrao: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      text: '#000',
      primary: '#007AFF',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray300: '#d1d5db',
      gray400: '#9ca3af',
      gray500: '#6b7280',
      gray900: '#111827',
      white: '#fff',
      warning: '#FF9500',
      warningBg: '#fef3c7',
      secondaryDark: '#92400e',
      error: '#FF3B30',
      errorBg: '#fee2e2',
    },
    typography: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      fontSans: 'System',
      fontSansMedium: 'System',
      fontSansSemiBold: 'System',
      fontSansBold: 'System',
    },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    borderRadius: { sm: 4, md: 8, lg: 12, full: 9999 },
  };
  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: any) => (typeof fn === 'function' ? fn(theme) : fn),
    },
  };
});

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@react-native-community/slider', () => {
  const { View } = require('react-native');
  return (props: any) => <View testID="slider" {...props} />;
});

describe('NavigationSettings: padrões', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Restaurar Padrões volta à tabela única de padrões', async () => {
    const onSettingsChange = jest.fn();
    global.mockUseAlert.showConfirm.mockResolvedValueOnce(true);
    const { getByText } = render(
      <NavigationSettings visible={true} onSettingsChange={onSettingsChange} />,
    );

    fireEvent.press(getByText('Restaurar Padrões'));

    await waitFor(() => {
      expect(onSettingsChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          navegarCom: 'externo',
          proximityRadius: 80,
        }),
      );
    });
  });
});
