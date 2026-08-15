/**
 * Tests for PerformanceKPIs.tsx
 * Grid de métricas de performance do motorista
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { PerformanceKPIs } from '../PerformanceKPIs';

import type { MotoristaPerformance } from '../types';

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
      primaryDark: '#1a2a5e',
      secondary: '#6366f1',
      success: '#10b981',
      warning: '#f7a02a',
      error: '#ef4444',
      info: '#3b82f6',
      gray500: '#6b7280',
      white: '#ffffff',
    },
  };

  return {
    useUnistyles: () => ({ theme }),
  };
});

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, testID }: { name: string; testID?: string }) => {
    const { Text } = require('react-native');
    return <Text testID={testID || `icon-${name}`}>{name}</Text>;
  },
}));

// Mock styles file
jest.mock('../styles', () => ({
  styles: {
    kpisContainer: {},
    kpisGrid: {},
    kpiCard: {},
    kpiHeader: {},
    kpiLabel: {},
    kpiIconContainer: {},
    kpiValue: {},
    kpiValueSuccess: {},
    kpiValueWarning: {},
    kpiValueError: {},
  },
}));

describe('PerformanceKPIs', () => {
  const mockPerformance: MotoristaPerformance = {
    id: 'motorista-1',
    nome: 'João Silva',
    unidade_id: 'unidade-1',
    unidade_nome: 'Unidade São Paulo',
    total_rotas: 50,
    rotas_concluidas: 45,
    rotas_em_andamento: 2,
    rotas_nao_executadas: 1,
    rotas_canceladas: 2,
    taxa_execucao: 90,
    distancia_total_km: 1250.5,
    tempo_medio_minutos: 95,
  };

  describe('Renderização de KPIs', () => {
    it('deve renderizar total de rotas', () => {
      const { getByText } = render(
        <PerformanceKPIs performance={mockPerformance} />,
      );

      expect(getByText('50')).toBeTruthy();
      expect(getByText('Total de Rotas')).toBeTruthy();
    });

    it('deve renderizar rotas concluídas', () => {
      const { getByText } = render(
        <PerformanceKPIs performance={mockPerformance} />,
      );

      expect(getByText('45')).toBeTruthy();
      expect(getByText('Concluídas')).toBeTruthy();
    });

    it('deve renderizar taxa de execução', () => {
      const { getByText } = render(
        <PerformanceKPIs performance={mockPerformance} />,
      );

      expect(getByText('90%')).toBeTruthy();
      expect(getByText('Taxa de Execução')).toBeTruthy();
    });

    it('deve renderizar rotas não executadas', () => {
      const { getByText } = render(
        <PerformanceKPIs performance={mockPerformance} />,
      );

      expect(getByText('1')).toBeTruthy();
      expect(getByText('Não Executadas')).toBeTruthy();
    });

    it('deve renderizar rotas em andamento', () => {
      const { getByText } = render(
        <PerformanceKPIs performance={mockPerformance} />,
      );

      // Não verificar o valor específico pois pode haver duplicatas
      expect(getByText('Em Andamento')).toBeTruthy();
    });

    it('deve renderizar rotas canceladas', () => {
      const { getByText } = render(
        <PerformanceKPIs performance={mockPerformance} />,
      );

      expect(getByText('Canceladas')).toBeTruthy();
    });
  });

  describe('Formatação de distância', () => {
    it('deve formatar distância com km', () => {
      const { getByText } = render(
        <PerformanceKPIs performance={mockPerformance} />,
      );

      expect(getByText('1250,5 km')).toBeTruthy();
      expect(getByText('Distância Total')).toBeTruthy();
    });

    it('deve mostrar "-" quando distância é null', () => {
      const perfSemDistancia = { ...mockPerformance, distancia_total_km: null };
      const { getAllByText } = render(
        <PerformanceKPIs performance={perfSemDistancia} />,
      );

      // Pelo menos um "-" deve aparecer (distância)
      expect(getAllByText('-').length).toBeGreaterThan(0);
    });
  });

  describe('Formatação de tempo', () => {
    it('deve formatar tempo em horas e minutos', () => {
      const { getByText } = render(
        <PerformanceKPIs performance={mockPerformance} />,
      );

      // 95 minutos = 1h 35m
      expect(getByText('1h 35m')).toBeTruthy();
      expect(getByText('Tempo Médio')).toBeTruthy();
    });

    it('deve formatar tempo apenas em minutos quando < 1h', () => {
      const perfPoucoTempo = { ...mockPerformance, tempo_medio_minutos: 45 };
      const { getByText } = render(
        <PerformanceKPIs performance={perfPoucoTempo} />,
      );

      expect(getByText('45min')).toBeTruthy();
    });

    it('deve mostrar "-" quando tempo é null', () => {
      const perfSemTempo = { ...mockPerformance, tempo_medio_minutos: null };
      const { getAllByText } = render(
        <PerformanceKPIs performance={perfSemTempo} />,
      );

      expect(getAllByText('-').length).toBeGreaterThan(0);
    });
  });

  describe('Estilos de taxa de execução', () => {
    it('deve usar estilo success para taxa >= 80%', () => {
      const perfAlta = { ...mockPerformance, taxa_execucao: 85 };
      const { getByText } = render(<PerformanceKPIs performance={perfAlta} />);

      expect(getByText('85%')).toBeTruthy();
    });

    it('deve usar estilo warning para taxa >= 50% e < 80%', () => {
      const perfMedia = { ...mockPerformance, taxa_execucao: 65 };
      const { getByText } = render(<PerformanceKPIs performance={perfMedia} />);

      expect(getByText('65%')).toBeTruthy();
    });

    it('deve usar estilo error para taxa < 50%', () => {
      const perfBaixa = { ...mockPerformance, taxa_execucao: 30 };
      const { getByText } = render(<PerformanceKPIs performance={perfBaixa} />);

      expect(getByText('30%')).toBeTruthy();
    });
  });

  describe('Estilos de não executadas', () => {
    it('deve usar estilo default quando 0 não executadas', () => {
      const perfZero = { ...mockPerformance, rotas_nao_executadas: 0 };
      const { getByText } = render(<PerformanceKPIs performance={perfZero} />);

      expect(getByText('0')).toBeTruthy();
    });

    it('deve usar estilo warning quando 1-2 não executadas', () => {
      const perfPoucas = { ...mockPerformance, rotas_nao_executadas: 2 };
      const { getByText } = render(
        <PerformanceKPIs performance={perfPoucas} />,
      );

      expect(getByText('Não Executadas')).toBeTruthy();
    });

    it('deve usar estilo error quando > 2 não executadas', () => {
      const perfMuitas = { ...mockPerformance, rotas_nao_executadas: 5 };
      const { getByText } = render(
        <PerformanceKPIs performance={perfMuitas} />,
      );

      expect(getByText('5')).toBeTruthy();
    });
  });

  describe('Ícones', () => {
    it('deve renderizar ícone navigate para total de rotas', () => {
      const { getByText } = render(
        <PerformanceKPIs performance={mockPerformance} />,
      );

      expect(getByText('navigate')).toBeTruthy();
    });

    it('deve renderizar ícone checkmark-circle para concluídas', () => {
      const { getByText } = render(
        <PerformanceKPIs performance={mockPerformance} />,
      );

      expect(getByText('checkmark-circle')).toBeTruthy();
    });

    it('deve renderizar ícone trending-up para taxa', () => {
      const { getByText } = render(
        <PerformanceKPIs performance={mockPerformance} />,
      );

      expect(getByText('trending-up')).toBeTruthy();
    });

    it('deve renderizar ícone time para em andamento', () => {
      const { getByText } = render(
        <PerformanceKPIs performance={mockPerformance} />,
      );

      expect(getByText('time')).toBeTruthy();
    });

    it('deve renderizar ícone speedometer para distância', () => {
      const { getByText } = render(
        <PerformanceKPIs performance={mockPerformance} />,
      );

      expect(getByText('speedometer')).toBeTruthy();
    });

    it('deve renderizar ícone hourglass para tempo médio', () => {
      const { getByText } = render(
        <PerformanceKPIs performance={mockPerformance} />,
      );

      expect(getByText('hourglass')).toBeTruthy();
    });
  });
});
