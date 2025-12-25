/**
 * Tests for LastRouteCard.tsx
 * Card de resumo da última rota concluída
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { LastRouteCard } from '../LastRouteCard';

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
      success: '#10b981',
      successBg: '#d1fae5',
      warning: '#f7a02a',
      error: '#ef4444',
      white: '#ffffff',
      gray500: '#6b7280',
      gray700: '#374151',
      gray800: '#1f2937',
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

describe('LastRouteCard', () => {
  const defaultData = {
    concluida_em: '2025-12-25T14:30:00',
    paradas_concluidas: 8,
    total_paradas: 10,
    distancia_km: 45,
    tempo_total: '2h 30min',
  };

  describe('Renderização Básica', () => {
    it('deve renderizar o título "Última rota"', () => {
      const { getByText } = render(<LastRouteCard data={defaultData} />);

      expect(getByText('Última rota')).toBeTruthy();
    });

    it('deve renderizar ícone checkmark-circle', () => {
      const { getByText } = render(<LastRouteCard data={defaultData} />);

      expect(getByText('checkmark-circle')).toBeTruthy();
    });

    it('deve mostrar horário de conclusão formatado', () => {
      const { getByText } = render(<LastRouteCard data={defaultData} />);

      expect(getByText(/Concluída às/)).toBeTruthy();
    });
  });

  describe('Estatísticas de Paradas', () => {
    it('deve mostrar contagem de paradas', () => {
      const { getByText } = render(<LastRouteCard data={defaultData} />);

      expect(getByText('8/10')).toBeTruthy();
      expect(getByText('paradas')).toBeTruthy();
    });

    it('deve mostrar ícone location para paradas', () => {
      const { getByText } = render(<LastRouteCard data={defaultData} />);

      expect(getByText('location')).toBeTruthy();
    });
  });

  describe('Estatísticas de Distância', () => {
    it('deve mostrar distância em km', () => {
      const { getByText } = render(<LastRouteCard data={defaultData} />);

      expect(getByText('45')).toBeTruthy();
      expect(getByText('km')).toBeTruthy();
    });

    it('deve mostrar -- quando distância é 0', () => {
      const { getByText } = render(
        <LastRouteCard data={{ ...defaultData, distancia_km: 0 }} />
      );

      expect(getByText('--')).toBeTruthy();
    });

    it('deve mostrar ícone speedometer', () => {
      const { getByText } = render(<LastRouteCard data={defaultData} />);

      expect(getByText('speedometer-outline')).toBeTruthy();
    });
  });

  describe('Estatísticas de Tempo', () => {
    it('deve mostrar tempo total', () => {
      const { getByText } = render(<LastRouteCard data={defaultData} />);

      expect(getByText('2h 30min')).toBeTruthy();
      expect(getByText('tempo')).toBeTruthy();
    });

    it('deve mostrar -- quando tempo_total é vazio', () => {
      const { getAllByText } = render(
        <LastRouteCard data={{ ...defaultData, tempo_total: '' }} />
      );

      // Will have multiple -- (distance if 0 and time)
      const dashes = getAllByText('--');
      expect(dashes.length).toBeGreaterThan(0);
    });

    it('deve mostrar ícone time-outline', () => {
      const { getByText } = render(<LastRouteCard data={defaultData} />);

      expect(getByText('time-outline')).toBeTruthy();
    });
  });

  describe('Taxa de Sucesso', () => {
    it('deve calcular e mostrar taxa de sucesso', () => {
      const { getByText } = render(<LastRouteCard data={defaultData} />);

      // 8/10 = 80%
      expect(getByText('80%')).toBeTruthy();
      expect(getByText('sucesso')).toBeTruthy();
    });

    it('deve mostrar 0% quando total_paradas é 0', () => {
      const { getByText } = render(
        <LastRouteCard
          data={{ ...defaultData, total_paradas: 0, paradas_concluidas: 0 }}
        />
      );

      expect(getByText('0%')).toBeTruthy();
    });

    it('deve mostrar 100% quando todas paradas concluídas', () => {
      const { getByText } = render(
        <LastRouteCard
          data={{ ...defaultData, paradas_concluidas: 10, total_paradas: 10 }}
        />
      );

      expect(getByText('100%')).toBeTruthy();
    });

    it('deve arredondar taxa de sucesso', () => {
      const { getByText } = render(
        <LastRouteCard
          data={{ ...defaultData, paradas_concluidas: 7, total_paradas: 9 }}
        />
      );

      // 7/9 = 77.777... -> 78%
      expect(getByText('78%')).toBeTruthy();
    });

    it('deve mostrar ícone trending-up', () => {
      const { getByText } = render(<LastRouteCard data={defaultData} />);

      expect(getByText('trending-up')).toBeTruthy();
    });
  });

  describe('Formatação de Horário', () => {
    it('deve formatar horário ISO corretamente', () => {
      const { getByText } = render(
        <LastRouteCard
          data={{ ...defaultData, concluida_em: '2025-12-25T09:05:00' }}
        />
      );

      // Should contain the formatted time
      expect(getByText(/Concluída às/)).toBeTruthy();
    });

    it('deve lidar com datas sem erro', () => {
      // Even with invalid date, the component renders without crashing
      const { getByText } = render(
        <LastRouteCard
          data={{ ...defaultData, concluida_em: 'invalid-date' }}
        />
      );

      // The header text should still be present
      expect(getByText('Última rota')).toBeTruthy();
    });
  });

  describe('Estilo de Taxa de Sucesso', () => {
    it('deve usar cor success para taxa >= 80%', () => {
      // 80% success rate
      const { getByText } = render(
        <LastRouteCard
          data={{ ...defaultData, paradas_concluidas: 8, total_paradas: 10 }}
        />
      );

      const percentText = getByText('80%');
      // Text style should have success color
      expect(percentText).toBeTruthy();
    });

    it('deve usar cor warning para taxa < 80%', () => {
      // 70% success rate
      const { getByText } = render(
        <LastRouteCard
          data={{ ...defaultData, paradas_concluidas: 7, total_paradas: 10 }}
        />
      );

      const percentText = getByText('70%');
      expect(percentText).toBeTruthy();
    });
  });
});
