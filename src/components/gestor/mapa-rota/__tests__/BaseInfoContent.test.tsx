/**
 * Tests for BaseInfoContent.tsx
 * Informações de partida/chegada da unidade
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { BaseInfoContent, useHasBaseInfo } from '../BaseInfoContent';

import type { Parada } from '../types';

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
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
    typography: { fontSize: { xs: 12, sm: 14, base: 16 } },
    borderRadius: { sm: 8, md: 10, lg: 12, full: 9999 },
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
    baseInfoList: {},
    baseInfoItemRow: {},
    baseInfoIcon: {},
    baseInfoTexts: {},
    baseInfoLabel: {},
    baseInfoValue: {},
    baseInfoEmpty: {},
  },
}));

describe('BaseInfoContent', () => {
  const createMockParada = (overrides: Partial<Parada> = {}): Parada => ({
    id: 'parada-1',
    ordem: 0,
    endereco: 'Rua da Partida, 100',
    tipo: 'entrega',
    status: 'pendente',
    latitude: -23.55,
    longitude: -46.63,
    ...overrides,
  });

  describe('Renderização', () => {
    it('deve renderizar mensagem quando não há pontos base', () => {
      const { getByText } = render(<BaseInfoContent pontosBase={[]} />);

      expect(getByText('Nenhum endereco da unidade foi cadastrado.')).toBeTruthy();
    });

    it('deve renderizar ponto de partida quando há um único ponto', () => {
      const pontosBase = [createMockParada({ ordem: 0 })];
      const { getByText } = render(<BaseInfoContent pontosBase={pontosBase} />);

      expect(getByText('Partida')).toBeTruthy();
      expect(getByText('Rua da Partida, 100')).toBeTruthy();
    });

    it('deve renderizar partida e chegada quando há dois pontos diferentes', () => {
      const pontosBase = [
        createMockParada({ id: 'base-1', ordem: 0, endereco: 'Rua da Partida, 100' }),
        createMockParada({ id: 'base-2', ordem: 999, endereco: 'Rua de Chegada, 200' }),
      ];
      const { getByText } = render(<BaseInfoContent pontosBase={pontosBase} />);

      expect(getByText('Partida')).toBeTruthy();
      expect(getByText('Rua da Partida, 100')).toBeTruthy();
      expect(getByText('Chegada')).toBeTruthy();
      expect(getByText('Rua de Chegada, 200')).toBeTruthy();
    });

    it('deve exibir apenas partida quando pontos de partida e chegada são iguais', () => {
      const pontosBase = [createMockParada({ id: 'base-1', ordem: 0 })];
      const { getByText, queryByText } = render(<BaseInfoContent pontosBase={pontosBase} />);

      expect(getByText('Partida')).toBeTruthy();
      expect(queryByText('Chegada')).toBeNull();
    });

    it('deve determinar corretamente o ponto com menor ordem como partida', () => {
      const pontosBase = [
        createMockParada({ id: 'base-3', ordem: 5, endereco: 'Rua Meio, 50' }),
        createMockParada({ id: 'base-1', ordem: 0, endereco: 'Rua Início, 1' }),
        createMockParada({ id: 'base-2', ordem: 10, endereco: 'Rua Fim, 100' }),
      ];
      const { getByText } = render(<BaseInfoContent pontosBase={pontosBase} />);

      expect(getByText('Partida')).toBeTruthy();
      expect(getByText('Rua Início, 1')).toBeTruthy();
    });

    it('deve determinar corretamente o ponto com maior ordem como chegada', () => {
      const pontosBase = [
        createMockParada({ id: 'base-3', ordem: 5, endereco: 'Rua Meio, 50' }),
        createMockParada({ id: 'base-1', ordem: 0, endereco: 'Rua Início, 1' }),
        createMockParada({ id: 'base-2', ordem: 10, endereco: 'Rua Fim, 100' }),
      ];
      const { getByText } = render(<BaseInfoContent pontosBase={pontosBase} />);

      expect(getByText('Chegada')).toBeTruthy();
      expect(getByText('Rua Fim, 100')).toBeTruthy();
    });

    it('deve renderizar ícones de partida e chegada', () => {
      const pontosBase = [
        createMockParada({ id: 'base-1', ordem: 0 }),
        createMockParada({ id: 'base-2', ordem: 10, endereco: 'Rua de Chegada' }),
      ];
      const { getByTestId } = render(<BaseInfoContent pontosBase={pontosBase} />);

      expect(getByTestId('icon-log-out-outline')).toBeTruthy();
      expect(getByTestId('icon-log-in-outline')).toBeTruthy();
    });
  });
});

describe('useHasBaseInfo', () => {
  const { renderHook } = require('@testing-library/react-native');

  const createMockParada = (overrides: Partial<Parada> = {}): Parada => ({
    id: 'parada-1',
    ordem: 0,
    endereco: 'Rua da Partida, 100',
    tipo: 'entrega',
    status: 'pendente',
    latitude: -23.55,
    longitude: -46.63,
    ...overrides,
  });

  it('deve retornar false quando não há pontos base', () => {
    const { result } = renderHook(() => useHasBaseInfo([]));

    expect(result.current).toBe(false);
  });

  it('deve retornar true quando há pelo menos um ponto base', () => {
    const pontosBase = [createMockParada()];
    const { result } = renderHook(() => useHasBaseInfo(pontosBase));

    expect(result.current).toBe(true);
  });

  it('deve retornar true quando há múltiplos pontos base', () => {
    const pontosBase = [
      createMockParada({ id: 'base-1', ordem: 0 }),
      createMockParada({ id: 'base-2', ordem: 10 }),
    ];
    const { result } = renderHook(() => useHasBaseInfo(pontosBase));

    expect(result.current).toBe(true);
  });
});
