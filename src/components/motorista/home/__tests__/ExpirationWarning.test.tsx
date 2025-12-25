/**
 * Tests for ExpirationWarning.tsx
 * Aviso de expiração de rota com countdown
 *
 * Note: Tests with time-dependent logic use jest.setSystemTime
 * Some edge cases are tested without time mocking for simplicity
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { ExpirationWarning } from '../ExpirationWarning';

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
      success: '#10b981',
      warning: '#f7a02a',
      error: '#ef4444',
      white: '#ffffff',
    },
  };

  return {
    defaultTheme: theme,
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
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

describe('ExpirationWarning', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Set time to 20:00 on 2025-12-25 by default
    jest.setSystemTime(new Date('2025-12-25T20:00:00'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar componente quando no período de aviso', () => {
      const { getByText } = render(<ExpirationWarning rotaData="2025-12-25" />);

      expect(getByText(/Rota expira/)).toBeTruthy();
    });

    it('deve mostrar ícone de tempo', () => {
      const { getByText } = render(<ExpirationWarning rotaData="2025-12-25" />);

      expect(getByText('time-outline')).toBeTruthy();
    });
  });

  describe('Não Renderiza Fora do Período', () => {
    it('não deve renderizar antes das 20h', () => {
      jest.setSystemTime(new Date('2025-12-25T15:00:00'));

      const { queryByText } = render(<ExpirationWarning rotaData="2025-12-25" />);

      expect(queryByText(/Rota expira/)).toBeNull();
    });

    it('não deve renderizar para rota de outro dia', () => {
      jest.setSystemTime(new Date('2025-12-25T20:00:00'));

      const { queryByText } = render(<ExpirationWarning rotaData="2025-12-24" />);

      expect(queryByText(/Rota expira/)).toBeNull();
    });
  });

  describe('Props', () => {
    it('deve aceitar prop rotaData', () => {
      const { getByText } = render(<ExpirationWarning rotaData="2025-12-25" />);

      expect(getByText(/Rota expira/)).toBeTruthy();
    });

    it('deve aceitar prop onExpire opcional', () => {
      const onExpire = jest.fn();
      const { getByText } = render(
        <ExpirationWarning rotaData="2025-12-25" onExpire={onExpire} />
      );

      expect(getByText(/Rota expira/)).toBeTruthy();
    });
  });
});
