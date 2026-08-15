/**
 * Tests for RouteInfoHeader.tsx
 * Barra de informações da rota (motorista, status, distância)
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import {
  RouteInfoHeader,
  getStatusBadgeVariant,
  formatStatusLabel,
} from '../RouteInfoHeader';

import type { Rota, ResumoParadas } from '../types';

// Mock dependencies
const mockTheme = {
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
    errorBg: '#fee2e2',
    yellow100: '#fef9c3',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2': 8 },
  typography: { fontSize: { xs: 12, sm: 14, base: 16 } },
  borderRadius: { sm: 8, md: 10, lg: 12, xl: 16, full: 9999 },
};

jest.mock('@/utils/styles', () => ({
  useUnistyles: () => ({ theme: mockTheme }),
  StyleSheet: {
    create: (fn: (t: typeof mockTheme) => Record<string, unknown>) =>
      fn(mockTheme),
  },
  type: { Theme: {} },
}));

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
    infoHeaderBar: {},
    infoHeaderRow: {},
    driverChip: {},
    driverLabel: {},
    driverName: {},
    infoHeaderChipGroup: {},
    statusBadge: {},
    statusBadgeDesktop: {},
    statusBadgeText: {},
    statusBadgeTextDesktop: {},
    infoChipLabel: {},
    infoChipValue: {},
    cancelChip: {},
    cancelChipText: {},
  },
}));

describe('RouteInfoHeader', () => {
  const createRota = (overrides: Partial<Rota> = {}): Rota => ({
    id: 'rota-1',
    data: '2024-01-15',
    status: 'em_andamento',
    distancia_total: 25.5,
    tempo_total: 120,
    motorista: { nome: 'João Silva' },
    ...overrides,
  });

  const createResumo = (
    overrides: Partial<ResumoParadas> = {},
  ): ResumoParadas => ({
    total: 10,
    concluidas: 5,
    pendentes: 4,
    emAndamento: 1,
    puladas: 0,
    ...overrides,
  });

  describe('Renderização', () => {
    it('deve renderizar nome do motorista', () => {
      const rota = createRota({ motorista: { nome: 'Carlos Souza' } });
      const resumo = createResumo();
      const { getByText } = render(
        <RouteInfoHeader rota={rota} resumoParadas={resumo} />,
      );

      expect(getByText('Carlos Souza')).toBeTruthy();
      expect(getByText('Motorista')).toBeTruthy();
    });

    it('deve exibir "Sem motorista" quando não há motorista', () => {
      const rota = createRota({ motorista: undefined });
      const resumo = createResumo();
      const { getByText } = render(
        <RouteInfoHeader rota={rota} resumoParadas={resumo} />,
      );

      expect(getByText('Sem motorista')).toBeTruthy();
    });

    it('deve renderizar status da rota', () => {
      const rota = createRota({ status: 'em_andamento' });
      const resumo = createResumo();
      const { getByText } = render(
        <RouteInfoHeader rota={rota} resumoParadas={resumo} />,
      );

      expect(getByText('em andamento')).toBeTruthy();
      expect(getByText('Status:')).toBeTruthy();
    });

    it('deve renderizar distância total', () => {
      const rota = createRota({ distancia_total: 32.7 });
      const resumo = createResumo();
      const { getByText } = render(
        <RouteInfoHeader rota={rota} resumoParadas={resumo} />,
      );

      expect(getByText('32,7 km')).toBeTruthy();
      expect(getByText('Distância Total:')).toBeTruthy();
    });

    it('não deve renderizar distância quando não disponível', () => {
      const rota = createRota({ distancia_total: undefined });
      const resumo = createResumo();
      const { queryByText } = render(
        <RouteInfoHeader rota={rota} resumoParadas={resumo} />,
      );

      expect(queryByText('Distância Total:')).toBeNull();
    });

    it('deve renderizar tempo estimado', () => {
      const rota = createRota({ tempo_total: 90 });
      const resumo = createResumo();
      const { getByText } = render(
        <RouteInfoHeader rota={rota} resumoParadas={resumo} />,
      );

      expect(getByText('1h 30min')).toBeTruthy();
      expect(getByText('Tempo Estimado:')).toBeTruthy();
    });

    it('deve renderizar tempo apenas em minutos quando menor que 1 hora', () => {
      const rota = createRota({ tempo_total: 45 });
      const resumo = createResumo();
      const { getByText } = render(
        <RouteInfoHeader rota={rota} resumoParadas={resumo} />,
      );

      expect(getByText('45 min')).toBeTruthy();
    });

    it('deve renderizar tempo apenas em horas quando minutos são zero', () => {
      const rota = createRota({ tempo_total: 120 });
      const resumo = createResumo();
      const { getByText } = render(
        <RouteInfoHeader rota={rota} resumoParadas={resumo} />,
      );

      expect(getByText('2h 0min')).toBeTruthy();
    });

    it('não deve renderizar tempo quando não disponível', () => {
      const rota = createRota({ tempo_total: undefined });
      const resumo = createResumo();
      const { queryByText } = render(
        <RouteInfoHeader rota={rota} resumoParadas={resumo} />,
      );

      expect(queryByText('Tempo Estimado:')).toBeNull();
    });

    it('deve renderizar contagem de paradas', () => {
      const rota = createRota();
      const resumo = createResumo({ total: 10, concluidas: 5 });
      const { getByText } = render(
        <RouteInfoHeader rota={rota} resumoParadas={resumo} />,
      );

      expect(getByText('5/10 concluídas')).toBeTruthy();
      expect(getByText('Paradas:')).toBeTruthy();
    });

    it('deve exibir "Sem entregas" quando não há paradas', () => {
      const rota = createRota();
      const resumo = createResumo({ total: 0, concluidas: 0, pendentes: 0 });
      const { getByText } = render(
        <RouteInfoHeader rota={rota} resumoParadas={resumo} />,
      );

      expect(getByText('Sem entregas')).toBeTruthy();
    });
  });

  describe('Botão Cancelar', () => {
    it('deve exibir botão cancelar quando onCancelPress é fornecido e rota pode ser cancelada', () => {
      const onCancelPress = jest.fn();
      const rota = createRota({ status: 'pendente' });
      const resumo = createResumo();
      const { getByText } = render(
        <RouteInfoHeader
          rota={rota}
          resumoParadas={resumo}
          onCancelPress={onCancelPress}
        />,
      );

      expect(getByText('Cancelar rota')).toBeTruthy();
    });

    it('deve chamar onCancelPress quando botão é pressionado', () => {
      const onCancelPress = jest.fn();
      const rota = createRota({ status: 'em_andamento' });
      const resumo = createResumo();
      const { getByText } = render(
        <RouteInfoHeader
          rota={rota}
          resumoParadas={resumo}
          onCancelPress={onCancelPress}
        />,
      );

      fireEvent.press(getByText('Cancelar rota'));
      expect(onCancelPress).toHaveBeenCalled();
    });

    it('não deve exibir botão cancelar para rotas já canceladas', () => {
      const onCancelPress = jest.fn();
      const rota = createRota({ status: 'cancelada' });
      const resumo = createResumo();
      const { queryByText } = render(
        <RouteInfoHeader
          rota={rota}
          resumoParadas={resumo}
          onCancelPress={onCancelPress}
        />,
      );

      expect(queryByText('Cancelar rota')).toBeNull();
    });

    it('não deve exibir botão cancelar para rotas concluídas', () => {
      const onCancelPress = jest.fn();
      const rota = createRota({ status: 'concluida' });
      const resumo = createResumo();
      const { queryByText } = render(
        <RouteInfoHeader
          rota={rota}
          resumoParadas={resumo}
          onCancelPress={onCancelPress}
        />,
      );

      expect(queryByText('Cancelar rota')).toBeNull();
    });

    it('não deve exibir botão cancelar quando onCancelPress não é fornecido', () => {
      const rota = createRota({ status: 'pendente' });
      const resumo = createResumo();
      const { queryByText } = render(
        <RouteInfoHeader rota={rota} resumoParadas={resumo} />,
      );

      expect(queryByText('Cancelar rota')).toBeNull();
    });
  });
});

describe('getStatusBadgeVariant', () => {
  it('deve retornar variante warning para status pendente', () => {
    const result = getStatusBadgeVariant(mockTheme, 'pendente');

    expect(result.container.backgroundColor).toBe(mockTheme.colors.warningBg);
    expect(result.text.color).toBe(mockTheme.colors.warning);
  });

  it('deve retornar variante info para status em_andamento', () => {
    const result = getStatusBadgeVariant(mockTheme, 'em_andamento');

    expect(result.container.backgroundColor).toBe(mockTheme.colors.infoBg);
    expect(result.text.color).toBe(mockTheme.colors.info);
  });

  it('deve retornar variante success para status concluida', () => {
    const result = getStatusBadgeVariant(mockTheme, 'concluida');

    expect(result.container.backgroundColor).toBe(mockTheme.colors.successBg);
    expect(result.text.color).toBe(mockTheme.colors.success);
  });

  it('deve retornar variante error para status cancelada', () => {
    const result = getStatusBadgeVariant(mockTheme, 'cancelada');

    expect(result.container.backgroundColor).toBe(mockTheme.colors.errorBg);
    expect(result.text.color).toBe(mockTheme.colors.error);
  });

  it('deve retornar variante warning para status nao_executada', () => {
    const result = getStatusBadgeVariant(mockTheme, 'nao_executada');

    expect(result.container.backgroundColor).toBe(mockTheme.colors.yellow100);
    expect(result.text.color).toBe(mockTheme.colors.warning);
  });

  it('deve retornar variante padrão para status desconhecido', () => {
    const result = getStatusBadgeVariant(mockTheme, 'unknown_status');

    expect(result.container.backgroundColor).toBe(mockTheme.colors.gray100);
    expect(result.text.color).toBe(mockTheme.colors.gray700);
  });

  it('deve retornar variante padrão para status undefined', () => {
    const result = getStatusBadgeVariant(mockTheme, undefined);

    expect(result.container.backgroundColor).toBe(mockTheme.colors.gray100);
    expect(result.text.color).toBe(mockTheme.colors.gray700);
  });
});

describe('formatStatusLabel', () => {
  it('deve formatar status pendente', () => {
    expect(formatStatusLabel('pendente')).toBe('pendente');
  });

  it('deve formatar status em_andamento', () => {
    expect(formatStatusLabel('em_andamento')).toBe('em andamento');
  });

  it('deve formatar status concluída', () => {
    expect(formatStatusLabel('concluida')).toBe('concluída');
  });

  it('deve formatar status cancelada', () => {
    expect(formatStatusLabel('cancelada')).toBe('cancelada');
  });

  it('deve formatar status nao_executada', () => {
    expect(formatStatusLabel('nao_executada')).toBe('não executada');
  });

  it('deve retornar "-" para status undefined', () => {
    expect(formatStatusLabel(undefined)).toBe('-');
  });

  it('deve formatar status desconhecido substituindo underscores', () => {
    expect(formatStatusLabel('outro_status_qualquer')).toBe(
      'outro status qualquer',
    );
  });

  it('deve normalizar para minúsculas', () => {
    expect(formatStatusLabel('PENDENTE')).toBe('pendente');
    expect(formatStatusLabel('EM_ANDAMENTO')).toBe('em andamento');
  });
});
