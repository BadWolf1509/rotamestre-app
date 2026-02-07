/**
 * Tests for ResumoInline.tsx
 * Resumo compacto inline para sidebar
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { ResumoInline } from '../ResumoInline';

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
      infoBg: '#dbeafe',
    },
    spacing: { '1': 4, '2': 8, xs: 4, sm: 8, md: 12, lg: 16 },
    typography: { fontSize: { xs: 12, sm: 14, base: 16 } },
    borderRadius: { sm: 8, md: 10, lg: 12 },
  };

  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: (t: typeof theme) => Record<string, unknown>) => fn(theme),
    },
    type: { Theme: {} },
  };
});

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, testID }: { name: string; testID?: string }) => {
    const { Text } = require('react-native');
    return <Text testID={testID || `icon-${name}`}>{name}</Text>;
  },
}));

describe('ResumoInline', () => {
  const createResumo = (overrides: Partial<ResumoParadas> = {}): ResumoParadas => ({
    total: 10,
    concluidas: 5,
    pendentes: 4,
    emAndamento: 1,
    puladas: 0,
    ...overrides,
  });

  describe('Renderização', () => {
    it('deve renderizar o total de paradas', () => {
      const resumo = createResumo({ total: 15 });
      const { getByText } = render(<ResumoInline resumoParadas={resumo} />);

      expect(getByText('15')).toBeTruthy();
      expect(getByText('total')).toBeTruthy();
    });

    it('deve renderizar as paradas concluídas', () => {
      const resumo = createResumo({ concluidas: 8 });
      const { getByText } = render(<ResumoInline resumoParadas={resumo} />);

      expect(getByText('8')).toBeTruthy();
      expect(getByText('concluído')).toBeTruthy();
    });

    it('deve renderizar as paradas pendentes', () => {
      const resumo = createResumo({ pendentes: 3 });
      const { getByText } = render(<ResumoInline resumoParadas={resumo} />);

      expect(getByText('3')).toBeTruthy();
      expect(getByText('pendente')).toBeTruthy();
    });

    it('deve renderizar paradas em andamento quando maior que zero', () => {
      const resumo = createResumo({ emAndamento: 2 });
      const { getByText } = render(<ResumoInline resumoParadas={resumo} />);

      expect(getByText('2')).toBeTruthy();
      expect(getByText('rota')).toBeTruthy();
    });

    it('não deve renderizar seção em andamento quando igual a zero', () => {
      const resumo = createResumo({ emAndamento: 0 });
      const { queryByText } = render(<ResumoInline resumoParadas={resumo} />);

      expect(queryByText('rota')).toBeNull();
    });

    it('deve renderizar ícones corretos', () => {
      const resumo = createResumo({ emAndamento: 1 });
      const { getByTestId } = render(<ResumoInline resumoParadas={resumo} />);

      expect(getByTestId('icon-flag')).toBeTruthy();
      expect(getByTestId('icon-checkmark')).toBeTruthy();
      expect(getByTestId('icon-time')).toBeTruthy();
      expect(getByTestId('icon-navigate')).toBeTruthy();
    });

    it('deve renderizar corretamente com todos os valores zerados', () => {
      const resumo = createResumo({
        total: 0,
        concluidas: 0,
        pendentes: 0,
        emAndamento: 0,
      });
      const { getAllByText, queryByText } = render(<ResumoInline resumoParadas={resumo} />);

      // Três zeros visíveis (total, concluídas, pendentes)
      const zeros = getAllByText('0');
      expect(zeros.length).toBe(3);
      expect(queryByText('rota')).toBeNull();
    });

    it('deve renderizar valores grandes corretamente', () => {
      const resumo = createResumo({
        total: 999,
        concluidas: 500,
        pendentes: 499,
        emAndamento: 0,
      });
      const { getByText } = render(<ResumoInline resumoParadas={resumo} />);

      expect(getByText('999')).toBeTruthy();
      expect(getByText('500')).toBeTruthy();
      expect(getByText('499')).toBeTruthy();
    });
  });
});
