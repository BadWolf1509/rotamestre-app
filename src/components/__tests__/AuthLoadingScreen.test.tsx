/**
 * Tests for AuthLoadingScreen.tsx
 * Tela de loading durante verificação de autenticação
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { AuthLoadingScreen } from '../AuthLoadingScreen';

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
      white: '#ffffff',
      gray500: '#6b7280',
    },
    spacing: {
      lg: 24,
    },
    typography: {
      base: 16,
      fontSansMedium: 'NunitoSans-Medium',
    },
  };

  return {
    StyleSheet: {
      create: (fn: (t: typeof theme) => Record<string, unknown>) => fn(theme),
    },
    useUnistyles: () => ({ theme }),
  };
});

describe('AuthLoadingScreen', () => {
  describe('Renderização', () => {
    it('deve renderizar texto de verificação', () => {
      const { getByText } = render(<AuthLoadingScreen />);

      expect(getByText('Verificando autenticação...')).toBeTruthy();
    });

    it('deve renderizar ActivityIndicator', () => {
      const { UNSAFE_getByType } = render(<AuthLoadingScreen />);

      const { ActivityIndicator } = require('react-native');
      const indicator = UNSAFE_getByType(ActivityIndicator);

      expect(indicator).toBeTruthy();
      expect(indicator.props.size).toBe('large');
    });

    it('deve usar cor primary no indicador', () => {
      const { UNSAFE_getByType } = render(<AuthLoadingScreen />);

      const { ActivityIndicator } = require('react-native');
      const indicator = UNSAFE_getByType(ActivityIndicator);

      expect(indicator.props.color).toBe('#284093');
    });
  });

  describe('Layout', () => {
    it('deve renderizar container View', () => {
      const { toJSON } = render(<AuthLoadingScreen />);

      expect(toJSON()).toBeTruthy();
    });
  });
});
