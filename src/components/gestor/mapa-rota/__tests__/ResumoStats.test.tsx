/**
 * Tests for ResumoStats.tsx
 * Estatísticas resumidas da rota
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { ResumoStats } from '../ResumoStats';

import type { ResumoParadas } from '../types';

// Mock dependencies
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
      secondary: '#f7a02a',
      success: '#10b981',
      warning: '#f7a02a',
      info: '#3b82f6',
      error: '#ef4444',
      white: '#ffffff',
      gray50: '#f9fafb',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray400: '#9ca3af',
      gray500: '#6b7280',
      gray600: '#4b5563',
      gray700: '#374151',
      gray900: '#111827',
      primaryBg: '#e8ebf5',
      successBg: '#d1fae5',
      warningBg: '#fef3c7',
      primaryDark: '#1a2b63',
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32 },
    typography: {
      fontSize: { xs: 12, sm: 14, base: 16, '2xl': 24 },
      fontDisplay: 'Viga',
    },
    borderRadius: { sm: 8, md: 10, lg: 12 },
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

// Mock styles
jest.mock('../styles', () => ({
  styles: {
    resumoStats: {},
    resumoStat: {},
    resumoStatValue: {},
    resumoStatValueSuccess: {},
    resumoStatValueWarning: {},
    resumoStatLabel: {},
    resumoDesktopGrid: {},
    resumoDesktopItem: {},
    resumoIconWrapper: {},
    resumoDesktopValue: {},
    resumoDesktopLabel: {},
  },
}));

describe('ResumoStats', () => {
  const createResumo = (overrides: Partial<ResumoParadas> = {}): ResumoParadas => ({
    total: 12,
    concluidas: 7,
    pendentes: 4,
    emAndamento: 1,
    puladas: 0,
    ...overrides,
  });

  describe('Variante Mobile (padrão)', () => {
    it('deve renderizar total de paradas', () => {
      const resumo = createResumo({ total: 15 });
      const { getByText } = render(<ResumoStats resumoParadas={resumo} />);

      expect(getByText('15')).toBeTruthy();
      expect(getByText('Paradas Totais')).toBeTruthy();
    });

    it('deve renderizar paradas concluídas', () => {
      const resumo = createResumo({ concluidas: 8 });
      const { getByText } = render(<ResumoStats resumoParadas={resumo} />);

      expect(getByText('8')).toBeTruthy();
      expect(getByText('Concluidas')).toBeTruthy();
    });

    it('deve renderizar paradas pendentes', () => {
      const resumo = createResumo({ pendentes: 3 });
      const { getByText } = render(<ResumoStats resumoParadas={resumo} />);

      expect(getByText('3')).toBeTruthy();
      expect(getByText('Pendentes')).toBeTruthy();
    });

    it('deve renderizar com variante mobile por padrão', () => {
      const resumo = createResumo();
      const { getByText } = render(<ResumoStats resumoParadas={resumo} />);

      expect(getByText('Paradas Totais')).toBeTruthy();
    });

    it('deve renderizar todos os três itens de resumo', () => {
      const resumo = createResumo({
        total: 12,
        concluidas: 7,
        pendentes: 5,
      });
      const { getByText } = render(<ResumoStats resumoParadas={resumo} />);

      expect(getByText('12')).toBeTruthy();
      expect(getByText('7')).toBeTruthy();
      expect(getByText('5')).toBeTruthy();
      expect(getByText('Paradas Totais')).toBeTruthy();
      expect(getByText('Concluidas')).toBeTruthy();
      expect(getByText('Pendentes')).toBeTruthy();
    });
  });

  describe('Variante Desktop', () => {
    it('deve renderizar com variante desktop', () => {
      const resumo = createResumo();
      const { getByText } = render(
        <ResumoStats resumoParadas={resumo} variant="desktop" />
      );

      expect(getByText('Paradas Totais')).toBeTruthy();
      expect(getByText('Concluidas')).toBeTruthy();
      expect(getByText('Pendentes')).toBeTruthy();
    });

    it('deve exibir ícones na variante desktop', () => {
      const resumo = createResumo();
      const { getByTestId } = render(
        <ResumoStats resumoParadas={resumo} variant="desktop" />
      );

      expect(getByTestId('icon-flag-outline')).toBeTruthy();
      expect(getByTestId('icon-checkmark-done-outline')).toBeTruthy();
      expect(getByTestId('icon-time-outline')).toBeTruthy();
    });

    it('deve exibir valores corretos na variante desktop', () => {
      const resumo = createResumo({
        total: 20,
        concluidas: 15,
        pendentes: 5,
      });
      const { getByText } = render(
        <ResumoStats resumoParadas={resumo} variant="desktop" />
      );

      expect(getByText('20')).toBeTruthy();
      expect(getByText('15')).toBeTruthy();
      expect(getByText('5')).toBeTruthy();
    });
  });

  describe('Valores Edge Cases', () => {
    it('deve renderizar com todos os valores zerados', () => {
      const resumo = createResumo({
        total: 0,
        concluidas: 0,
        pendentes: 0,
        emAndamento: 0,
      });
      const { getAllByText } = render(<ResumoStats resumoParadas={resumo} />);

      const zeros = getAllByText('0');
      expect(zeros.length).toBe(3);
    });

    it('deve renderizar valores grandes', () => {
      const resumo = createResumo({
        total: 1000,
        concluidas: 750,
        pendentes: 250,
      });
      const { getByText } = render(<ResumoStats resumoParadas={resumo} />);

      expect(getByText('1000')).toBeTruthy();
      expect(getByText('750')).toBeTruthy();
      expect(getByText('250')).toBeTruthy();
    });

    it('deve renderizar quando todas as paradas estão concluídas', () => {
      const resumo = createResumo({
        total: 12,
        concluidas: 10,
        pendentes: 0,
        emAndamento: 0,
      });
      const { getByText } = render(<ResumoStats resumoParadas={resumo} />);

      expect(getByText('10')).toBeTruthy();
      expect(getByText('Concluidas')).toBeTruthy();
    });
  });
});
