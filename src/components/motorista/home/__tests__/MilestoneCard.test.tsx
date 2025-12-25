/**
 * Tests for MilestoneCard.tsx
 * Card de progresso para próximo milestone
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { MilestoneCard } from '../MilestoneCard';

// Mock getMilestoneMessage
jest.mock('@/utils/motivationalMessages', () => ({
  getMilestoneMessage: (milestone: number) => ({
    emoji: milestone >= 100 ? '🏆' : '🎯',
    title: `${milestone} entregas`,
    subtitle: 'Continue assim!',
  }),
}));

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
      primaryBg: '#e8edfa',
      success: '#10b981',
      successBg: '#d1fae5',
      warning: '#f7a02a',
      warningBg: '#fef3c7',
      error: '#ef4444',
      white: '#ffffff',
      black: '#000000',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray500: '#6b7280',
      gray600: '#4b5563',
      gray700: '#374151',
      gray900: '#111827',
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

describe('MilestoneCard', () => {
  const defaultData = {
    totalEntregas: 75,
    nextMilestone: 100,
    remaining: 25,
    averagePerDay: 5,
    bestDay: 12,
    isLoading: false,
  };

  describe('Estado de Carregamento', () => {
    it('deve mostrar loading quando isLoading=true', () => {
      const { getByText } = render(
        <MilestoneCard data={{ ...defaultData, isLoading: true }} />
      );

      expect(getByText('Carregando conquistas...')).toBeTruthy();
    });

    it('não deve mostrar conteúdo principal durante loading', () => {
      const { queryByText } = render(
        <MilestoneCard data={{ ...defaultData, isLoading: true }} />
      );

      expect(queryByText('Próxima Conquista')).toBeNull();
    });
  });

  describe('Estado Normal', () => {
    it('deve renderizar título "Próxima Conquista"', () => {
      const { getByText } = render(<MilestoneCard data={defaultData} />);

      expect(getByText('Próxima Conquista')).toBeTruthy();
    });

    it('deve mostrar ícone flag', () => {
      const { getByText } = render(<MilestoneCard data={defaultData} />);

      expect(getByText('flag')).toBeTruthy();
    });

    it('deve mostrar progresso atual e meta', () => {
      const { getByText } = render(<MilestoneCard data={defaultData} />);

      expect(getByText('75 de 100')).toBeTruthy();
    });

    it('deve mostrar entregas restantes', () => {
      const { getByText } = render(<MilestoneCard data={defaultData} />);

      expect(getByText('Faltam 25 entregas')).toBeTruthy();
    });

    it('deve mostrar próximo milestone com emoji', () => {
      const { getByText } = render(<MilestoneCard data={defaultData} />);

      expect(getByText(/100 entregas/)).toBeTruthy();
    });
  });

  describe('Quando Falta Apenas 1', () => {
    it('deve mostrar mensagem especial para 1 restante', () => {
      const { getByText } = render(
        <MilestoneCard data={{ ...defaultData, remaining: 1 }} />
      );

      expect(getByText('Falta apenas 1!')).toBeTruthy();
    });
  });

  describe('Modo Compacto', () => {
    it('deve mostrar versão curta da mensagem restante', () => {
      const { getByText, queryByText } = render(
        <MilestoneCard data={defaultData} compact={true} />
      );

      expect(getByText('Faltam 25')).toBeTruthy();
      expect(queryByText('Faltam 25 entregas')).toBeNull();
    });

    it('não deve mostrar stats no modo compacto', () => {
      const { queryByText } = render(
        <MilestoneCard data={defaultData} compact={true} />
      );

      expect(queryByText('~5/dia')).toBeNull();
      expect(queryByText('Melhor: 12')).toBeNull();
    });
  });

  describe('Stats Completos', () => {
    it('deve mostrar média por dia quando não é compacto', () => {
      const { getByText } = render(
        <MilestoneCard data={defaultData} compact={false} />
      );

      expect(getByText('~5/dia')).toBeTruthy();
    });

    it('deve mostrar melhor dia quando não é compacto', () => {
      const { getByText } = render(
        <MilestoneCard data={defaultData} compact={false} />
      );

      expect(getByText('Melhor: 12')).toBeTruthy();
    });

    it('não deve mostrar stats quando averagePerDay é 0', () => {
      const { queryByText } = render(
        <MilestoneCard data={{ ...defaultData, averagePerDay: 0 }} compact={false} />
      );

      expect(queryByText('~0/dia')).toBeNull();
    });
  });

  describe('Todos Milestones Atingidos', () => {
    it('deve mostrar "Mestre das Entregas" quando não há próximo milestone', () => {
      const { getByText } = render(
        <MilestoneCard
          data={{
            ...defaultData,
            nextMilestone: null as any,
            totalEntregas: 500,
          }}
        />
      );

      expect(getByText('Mestre das Entregas!')).toBeTruthy();
    });

    it('deve mostrar ícone trophy quando atingiu todos', () => {
      const { getByText } = render(
        <MilestoneCard
          data={{
            ...defaultData,
            nextMilestone: null as any,
            totalEntregas: 500,
          }}
        />
      );

      expect(getByText('trophy')).toBeTruthy();
    });

    it('deve mostrar total de entregas realizadas', () => {
      const { getByText } = render(
        <MilestoneCard
          data={{
            ...defaultData,
            nextMilestone: null as any,
            totalEntregas: 500,
          }}
        />
      );

      expect(getByText('500 entregas realizadas')).toBeTruthy();
    });
  });

  describe('Cores por Progresso', () => {
    it('deve usar cor warning para progresso < 50%', () => {
      // 30% progress: 30 of 100
      const { getByText } = render(
        <MilestoneCard
          data={{ ...defaultData, totalEntregas: 30, nextMilestone: 100 }}
        />
      );

      expect(getByText('30 de 100')).toBeTruthy();
    });

    it('deve usar cor primary para progresso 50-90%', () => {
      // 75% progress: 75 of 100
      const { getByText } = render(
        <MilestoneCard
          data={{ ...defaultData, totalEntregas: 75, nextMilestone: 100 }}
        />
      );

      expect(getByText('75 de 100')).toBeTruthy();
    });

    it('deve usar cor success para progresso >= 90%', () => {
      // 95% progress: 95 of 100
      const { getByText } = render(
        <MilestoneCard
          data={{ ...defaultData, totalEntregas: 95, nextMilestone: 100 }}
        />
      );

      expect(getByText('95 de 100')).toBeTruthy();
    });
  });

  describe('Ícones', () => {
    it('deve mostrar ícone rocket-outline na mensagem de incentivo', () => {
      const { getByText } = render(<MilestoneCard data={defaultData} />);

      expect(getByText('rocket-outline')).toBeTruthy();
    });

    it('deve mostrar ícone trending-up nos stats', () => {
      const { getByText } = render(
        <MilestoneCard data={defaultData} compact={false} />
      );

      expect(getByText('trending-up')).toBeTruthy();
    });

    it('deve mostrar ícone star para melhor dia', () => {
      const { getByText } = render(
        <MilestoneCard data={defaultData} compact={false} />
      );

      expect(getByText('star')).toBeTruthy();
    });
  });
});
