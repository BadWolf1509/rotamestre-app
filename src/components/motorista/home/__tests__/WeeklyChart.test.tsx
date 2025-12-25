/**
 * Tests for WeeklyChart.tsx
 * Mini gráfico de performance semanal
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { WeeklyChart } from '../WeeklyChart';

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
      primaryLight: '#e8edfa',
      success: '#10b981',
      warning: '#f7a02a',
      white: '#ffffff',
      black: '#000000',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray400: '#9ca3af',
      gray500: '#6b7280',
      gray600: '#4b5563',
      gray700: '#374151',
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

describe('WeeklyChart', () => {
  const defaultData = [
    { date: '2025-12-19', day: 'Seg', entregas: 5 },
    { date: '2025-12-20', day: 'Ter', entregas: 8 },
    { date: '2025-12-21', day: 'Qua', entregas: 3 },
    { date: '2025-12-22', day: 'Qui', entregas: 10 },
    { date: '2025-12-23', day: 'Sex', entregas: 7 },
    { date: '2025-12-24', day: 'Sáb', entregas: 0 },
    { date: '2025-12-25', day: 'Dom', entregas: 0 },
  ];

  describe('Estado de Carregamento', () => {
    it('deve mostrar loading quando isLoading=true', () => {
      const { getByText } = render(
        <WeeklyChart data={defaultData} averagePerDay={5} isLoading={true} />
      );

      expect(getByText('Carregando dados...')).toBeTruthy();
    });

    it('não deve mostrar gráfico durante loading', () => {
      const { queryByText } = render(
        <WeeklyChart data={defaultData} averagePerDay={5} isLoading={true} />
      );

      expect(queryByText('Semana')).toBeNull();
      expect(queryByText('Última semana')).toBeNull();
    });
  });

  describe('Estado Vazio', () => {
    const emptyData = [
      { date: '2025-12-19', day: 'Seg', entregas: 0 },
      { date: '2025-12-20', day: 'Ter', entregas: 0 },
      { date: '2025-12-21', day: 'Qua', entregas: 0 },
      { date: '2025-12-22', day: 'Qui', entregas: 0 },
      { date: '2025-12-23', day: 'Sex', entregas: 0 },
      { date: '2025-12-24', day: 'Sáb', entregas: 0 },
      { date: '2025-12-25', day: 'Dom', entregas: 0 },
    ];

    it('deve mostrar mensagem de vazio quando não há entregas', () => {
      const { getByText } = render(
        <WeeklyChart data={emptyData} averagePerDay={0} />
      );

      expect(getByText('Sem entregas esta semana')).toBeTruthy();
    });

    it('deve mostrar texto de incentivo quando vazio', () => {
      const { getByText } = render(
        <WeeklyChart data={emptyData} averagePerDay={0} />
      );

      expect(getByText('Complete rotas para ver seu progresso')).toBeTruthy();
    });

    it('deve mostrar ícone de calendário quando vazio', () => {
      const { getByText } = render(
        <WeeklyChart data={emptyData} averagePerDay={0} />
      );

      expect(getByText('calendar-outline')).toBeTruthy();
    });
  });

  describe('Estado Normal', () => {
    it('deve renderizar título "Última semana"', () => {
      const { getByText } = render(
        <WeeklyChart data={defaultData} averagePerDay={5} />
      );

      expect(getByText('Última semana')).toBeTruthy();
    });

    it('deve mostrar ícone bar-chart-outline', () => {
      const { getByText } = render(
        <WeeklyChart data={defaultData} averagePerDay={5} />
      );

      expect(getByText('bar-chart-outline')).toBeTruthy();
    });

    it('deve mostrar total de entregas da semana', () => {
      const { getByText } = render(
        <WeeklyChart data={defaultData} averagePerDay={5} />
      );

      // Total: 5+8+3+10+7+0+0 = 33
      expect(getByText('33')).toBeTruthy();
      expect(getByText('entregas')).toBeTruthy();
    });

    it('deve mostrar labels dos dias', () => {
      const { getByText } = render(
        <WeeklyChart data={defaultData} averagePerDay={5} />
      );

      expect(getByText('Seg')).toBeTruthy();
      expect(getByText('Ter')).toBeTruthy();
      expect(getByText('Qua')).toBeTruthy();
      expect(getByText('Qui')).toBeTruthy();
      expect(getByText('Sex')).toBeTruthy();
    });
  });

  describe('Legenda', () => {
    it('deve mostrar legenda "Hoje" quando não compacto', () => {
      const { getByText } = render(
        <WeeklyChart data={defaultData} averagePerDay={5} compact={false} />
      );

      expect(getByText('Hoje')).toBeTruthy();
    });

    it('deve mostrar média na legenda quando não compacto', () => {
      const { getByText } = render(
        <WeeklyChart data={defaultData} averagePerDay={5} compact={false} />
      );

      expect(getByText('Média: 5/dia')).toBeTruthy();
    });

    it('não deve mostrar média quando averagePerDay é 0', () => {
      const { queryByText } = render(
        <WeeklyChart data={defaultData} averagePerDay={0} compact={false} />
      );

      expect(queryByText('Média: 0/dia')).toBeNull();
    });
  });

  describe('Modo Compacto', () => {
    it('deve mostrar título "Semana" em modo compacto', () => {
      const { getByText } = render(
        <WeeklyChart data={defaultData} averagePerDay={5} compact={true} />
      );

      expect(getByText('Semana')).toBeTruthy();
    });

    it('não deve mostrar legenda em modo compacto', () => {
      const { queryByText } = render(
        <WeeklyChart data={defaultData} averagePerDay={5} compact={true} />
      );

      expect(queryByText('Hoje')).toBeNull();
      expect(queryByText('Média: 5/dia')).toBeNull();
    });
  });
});
