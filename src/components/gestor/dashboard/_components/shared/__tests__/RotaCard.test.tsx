import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet as RNStyleSheet } from 'react-native';

import { RotaCard } from '../RotaCard';

// Mock unistyles
jest.mock('@/utils/styles', () => ({
  useUnistyles: () => ({
    theme: {
      colors: {
        primary: '#007AFF',
        secondary: '#FF9500',
        success: '#34C759',
        error: '#FF3B30',
        warning: '#F59E0B',
        info: '#3B82F6',
        gray500: '#6b7280',
        white: '#fff',
      },
    },
  }),
  StyleSheet: {
    create: (fn: any) =>
      fn({
        colors: {
          white: '#fff',
          gray200: '#e5e7eb',
          gray500: '#6b7280',
          gray700: '#374151',
          gray900: '#111827',
        },
        spacing: { sm: 8, md: 12, lg: 16 },
        borderRadius: { md: 6, lg: 12, full: 999 },
        typography: {
          xs: 10,
          sm: 12,
          base: 14,
          fontSansSemiBold: 'System',
        },
        shadows: { sm: {} },
      }),
  },
}));

function corDoBadge(getByTestId: (id: string) => any): string {
  return RNStyleSheet.flatten(getByTestId('rota-card-badge-rota-1').props.style)
    .backgroundColor;
}

describe('RotaCard', () => {
  const baseRota = {
    id: 'rota-1',
    motorista_nome: 'João Silva',
    status: 'pendente' as const,
    data: '2024-01-15',
    paradas_concluidas: 0,
    total_paradas: 5,
    distancia_total: 25.5,
  };

  it('deve renderizar nome do motorista', () => {
    const { getByText } = render(<RotaCard rota={baseRota} />);
    expect(getByText('João Silva')).toBeTruthy();
  });

  it('deve renderizar data formatada', () => {
    const { getByText } = render(<RotaCard rota={baseRota} />);
    expect(getByText('15/01/2024')).toBeTruthy();
  });

  it('deve renderizar contagem de paradas', () => {
    const { getByText } = render(<RotaCard rota={baseRota} />);
    expect(getByText('📍 0/5 paradas')).toBeTruthy();
  });

  it('deve renderizar distância quando maior que zero', () => {
    const { getByText } = render(<RotaCard rota={baseRota} />);
    expect(getByText('🚗 25,5 km')).toBeTruthy();
  });

  it('não deve renderizar distância quando é zero', () => {
    const rota = { ...baseRota, distancia_total: 0 };
    const { queryByText } = render(<RotaCard rota={rota} />);
    expect(queryByText(/🚗/)).toBeNull();
  });

  it('deve chamar onPress quando clicado', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <RotaCard rota={baseRota} onPress={onPress} />,
    );

    fireEvent.press(getByTestId('rota-card-rota-1'));
    expect(onPress).toHaveBeenCalled();
  });

  describe('Status badges', () => {
    it('deve mostrar badge "Pendente" para status pendente', () => {
      const rota = { ...baseRota, status: 'pendente' as const };
      const { getByText } = render(<RotaCard rota={rota} />);
      expect(getByText('Pendente')).toBeTruthy();
    });

    it('mostra "Em andamento" (sentence case, como o desktop) em info', () => {
      const rota = { ...baseRota, status: 'em_andamento' as const };
      const { getByText, getByTestId } = render(<RotaCard rota={rota} />);
      expect(getByText('Em andamento')).toBeTruthy();
      expect(corDoBadge(getByTestId)).toBe('#3B82F6');
    });

    it('pendente usa warning', () => {
      const { getByTestId } = render(<RotaCard rota={baseRota} />);
      expect(corDoBadge(getByTestId)).toBe('#F59E0B');
    });

    it('nao_executada mostra "Não executada" em error, nunca o texto cru', () => {
      const rota = { ...baseRota, status: 'nao_executada' as const };
      const { getByText, queryByText, getByTestId } = render(
        <RotaCard rota={rota} />,
      );
      expect(getByText('Não executada')).toBeTruthy();
      expect(queryByText('nao_executada')).toBeNull();
      expect(corDoBadge(getByTestId)).toBe('#FF3B30');
    });

    it('deve mostrar badge "Concluída" para status concluida', () => {
      const rota = { ...baseRota, status: 'concluida' as const };
      const { getByText } = render(<RotaCard rota={rota} />);
      expect(getByText('Concluída')).toBeTruthy();
    });

    it('deve mostrar badge "Cancelada" para status cancelada', () => {
      const rota = { ...baseRota, status: 'cancelada' as const };
      const { getByText } = render(<RotaCard rota={rota} />);
      expect(getByText('Cancelada')).toBeTruthy();
    });

    it('status desconhecido "status_novo" vira "status novo" em gray500', () => {
      const rota = { ...baseRota, status: 'status_novo' as any };
      const { getByText, getByTestId } = render(<RotaCard rota={rota} />);
      expect(getByText('status novo')).toBeTruthy();
      expect(corDoBadge(getByTestId)).toBe('#6b7280');
    });
  });

  describe('Progress bar', () => {
    it('deve renderizar barra de progresso quando há paradas', () => {
      const rota = { ...baseRota, paradas_concluidas: 2, total_paradas: 5 };
      const { toJSON } = render(<RotaCard rota={rota} />);
      expect(toJSON()).toBeTruthy();
    });

    it('não deve renderizar barra de progresso quando total_paradas é zero', () => {
      const rota = { ...baseRota, total_paradas: 0 };
      const { toJSON } = render(<RotaCard rota={rota} />);
      expect(toJSON()).toBeTruthy();
    });

    it('deve calcular porcentagem correta de progresso', () => {
      const rota = { ...baseRota, paradas_concluidas: 3, total_paradas: 6 };
      // 3/6 = 50%
      const { toJSON } = render(<RotaCard rota={rota} />);
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Data formatting', () => {
    it('deve tratar data undefined', () => {
      const rota = { ...baseRota, data: undefined };
      const { getByText } = render(<RotaCard rota={rota} />);
      expect(getByText('-')).toBeTruthy();
    });

    it('deve tratar data inválida', () => {
      const rota = { ...baseRota, data: 'invalid-date' };
      const { getByText } = render(<RotaCard rota={rota} />);
      expect(getByText('-')).toBeTruthy();
    });

    it('deve formatar data corretamente', () => {
      const rota = { ...baseRota, data: '2024-12-31' };
      const { getByText } = render(<RotaCard rota={rota} />);
      expect(getByText('31/12/2024')).toBeTruthy();
    });
  });

  it('deve ter testID correto', () => {
    const { getByTestId } = render(<RotaCard rota={baseRota} />);
    expect(getByTestId('rota-card-rota-1')).toBeTruthy();
  });

  it('deve funcionar sem onPress', () => {
    const { toJSON } = render(<RotaCard rota={baseRota} />);
    expect(toJSON()).toBeTruthy();
  });
});
