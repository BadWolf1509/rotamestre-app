/**
 * Tests for RouteInfoHeaderCompact.tsx
 * Header compacto com informações da rota
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { RouteInfoHeaderCompact } from '../RouteInfoHeaderCompact';
import type { Rota, ResumoParadas } from '../types';

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
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray500: '#6b7280',
      gray900: '#111827',
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
    typography: { fontSize: { xs: 12, sm: 14, base: 16 } },
    borderRadius: { md: 10, lg: 16, full: 9999 },
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
  Ionicons: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text testID={`icon-${name}`}>{name}</Text>;
  },
}));

describe('RouteInfoHeaderCompact', () => {
  const mockRota: Rota = {
    id: 'rota-1',
    data: '2025-12-25',
    status: 'pendente',
    distancia_total: 15.5,
    motorista: {
      nome: 'Carlos Silva',
    },
  };

  const mockResumoParadas: ResumoParadas = {
    total: 5,
    concluidas: 2,
    pendentes: 3,
    emAndamento: 0,
  };

  const defaultProps = {
    rota: mockRota,
    resumoParadas: mockResumoParadas,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização', () => {
    it('deve renderizar nome do motorista', () => {
      const { getByText } = render(<RouteInfoHeaderCompact {...defaultProps} />);

      expect(getByText('Carlos Silva')).toBeTruthy();
    });

    it('deve exibir "Sem motorista" quando não há motorista', () => {
      const rotaSemMotorista = { ...mockRota, motorista: undefined };
      const { getByText } = render(
        <RouteInfoHeaderCompact {...defaultProps} rota={rotaSemMotorista} />
      );

      expect(getByText('Sem motorista')).toBeTruthy();
    });

    it('deve exibir status Pendente', () => {
      const { getByText } = render(<RouteInfoHeaderCompact {...defaultProps} />);

      expect(getByText('Pendente')).toBeTruthy();
    });

    it('deve exibir distância total', () => {
      const { getByText } = render(<RouteInfoHeaderCompact {...defaultProps} />);

      expect(getByText('15.5 km')).toBeTruthy();
    });

    it('deve exibir contagem de paradas', () => {
      const { getByText } = render(<RouteInfoHeaderCompact {...defaultProps} />);

      expect(getByText('2/5')).toBeTruthy();
      expect(getByText('paradas')).toBeTruthy();
    });
  });

  describe('Status da rota', () => {
    it('deve exibir status "Em rota" para em_andamento', () => {
      const rotaEmAndamento = { ...mockRota, status: 'em_andamento' };
      const { getByText, getByTestId } = render(
        <RouteInfoHeaderCompact {...defaultProps} rota={rotaEmAndamento} />
      );

      expect(getByText('Em rota')).toBeTruthy();
      expect(getByTestId('icon-navigate')).toBeTruthy();
    });

    it('deve exibir status "Concluída" para concluida', () => {
      const rotaConcluida = { ...mockRota, status: 'concluida' };
      const { getByText, getByTestId } = render(
        <RouteInfoHeaderCompact {...defaultProps} rota={rotaConcluida} />
      );

      expect(getByText('Concluída')).toBeTruthy();
      expect(getByTestId('icon-checkmark-circle')).toBeTruthy();
    });

    it('deve exibir status "Cancelada" para cancelada', () => {
      const rotaCancelada = { ...mockRota, status: 'cancelada' };
      const { getByText, getByTestId } = render(
        <RouteInfoHeaderCompact {...defaultProps} rota={rotaCancelada} />
      );

      expect(getByText('Cancelada')).toBeTruthy();
      expect(getByTestId('icon-close-circle')).toBeTruthy();
    });

    it('deve exibir status "Não Executada" para nao_executada', () => {
      const rotaNaoExecutada = { ...mockRota, status: 'nao_executada' };
      const { getByText, getByTestId } = render(
        <RouteInfoHeaderCompact {...defaultProps} rota={rotaNaoExecutada} />
      );

      expect(getByText('Não Executada')).toBeTruthy();
      expect(getByTestId('icon-alert-circle')).toBeTruthy();
    });
  });

  describe('Botão Trocar Motorista', () => {
    it('deve exibir botão Trocar para rotas pendentes', () => {
      const onChangeDriverPress = jest.fn();
      const { getByText } = render(
        <RouteInfoHeaderCompact
          {...defaultProps}
          onChangeDriverPress={onChangeDriverPress}
        />
      );

      expect(getByText('Trocar')).toBeTruthy();

      fireEvent.press(getByText('Trocar'));
      expect(onChangeDriverPress).toHaveBeenCalled();
    });

    it('não deve exibir botão Trocar para rotas em andamento', () => {
      const onChangeDriverPress = jest.fn();
      const rotaEmAndamento = { ...mockRota, status: 'em_andamento' };
      const { queryByText } = render(
        <RouteInfoHeaderCompact
          {...defaultProps}
          rota={rotaEmAndamento}
          onChangeDriverPress={onChangeDriverPress}
        />
      );

      expect(queryByText('Trocar')).toBeNull();
    });
  });

  describe('Botão Cancelar', () => {
    it('deve exibir botão Cancelar para rotas pendentes', () => {
      const onCancelPress = jest.fn();
      const { getByText } = render(
        <RouteInfoHeaderCompact
          {...defaultProps}
          onCancelPress={onCancelPress}
        />
      );

      expect(getByText('Cancelar')).toBeTruthy();

      fireEvent.press(getByText('Cancelar'));
      expect(onCancelPress).toHaveBeenCalled();
    });

    it('deve exibir botão Cancelar para rotas em andamento', () => {
      const onCancelPress = jest.fn();
      const rotaEmAndamento = { ...mockRota, status: 'em_andamento' };
      const { getByText } = render(
        <RouteInfoHeaderCompact
          {...defaultProps}
          rota={rotaEmAndamento}
          onCancelPress={onCancelPress}
        />
      );

      expect(getByText('Cancelar')).toBeTruthy();
    });

    it('não deve exibir botão Cancelar para rotas concluídas', () => {
      const onCancelPress = jest.fn();
      const rotaConcluida = { ...mockRota, status: 'concluida' };
      const { queryByText } = render(
        <RouteInfoHeaderCompact
          {...defaultProps}
          rota={rotaConcluida}
          onCancelPress={onCancelPress}
        />
      );

      expect(queryByText('Cancelar')).toBeNull();
    });

    it('não deve exibir botão Cancelar para rotas já canceladas', () => {
      const onCancelPress = jest.fn();
      const rotaCancelada = { ...mockRota, status: 'cancelada' };
      const { queryByText } = render(
        <RouteInfoHeaderCompact
          {...defaultProps}
          rota={rotaCancelada}
          onCancelPress={onCancelPress}
        />
      );

      expect(queryByText('Cancelar')).toBeNull();
    });
  });

  describe('Botão Reativar', () => {
    it('deve exibir botão Reativar para rotas não executadas', () => {
      const onReactivatePress = jest.fn();
      const rotaNaoExecutada = { ...mockRota, status: 'nao_executada' };
      const { getByText } = render(
        <RouteInfoHeaderCompact
          {...defaultProps}
          rota={rotaNaoExecutada}
          onReactivatePress={onReactivatePress}
        />
      );

      expect(getByText('Reativar')).toBeTruthy();

      fireEvent.press(getByText('Reativar'));
      expect(onReactivatePress).toHaveBeenCalled();
    });

    it('não deve exibir botão Reativar para rotas pendentes', () => {
      const onReactivatePress = jest.fn();
      const { queryByText } = render(
        <RouteInfoHeaderCompact
          {...defaultProps}
          onReactivatePress={onReactivatePress}
        />
      );

      expect(queryByText('Reativar')).toBeNull();
    });
  });

  describe('Botão Adicionar Parada', () => {
    it('deve exibir botão "+ Parada" para rotas pendentes', () => {
      const onAddStopPress = jest.fn();
      const { getByText } = render(
        <RouteInfoHeaderCompact
          {...defaultProps}
          onAddStopPress={onAddStopPress}
        />
      );

      expect(getByText('+ Parada')).toBeTruthy();

      fireEvent.press(getByText('+ Parada'));
      expect(onAddStopPress).toHaveBeenCalled();
    });

    it('deve exibir botão "+ Parada" para rotas em andamento', () => {
      const onAddStopPress = jest.fn();
      const rotaEmAndamento = { ...mockRota, status: 'em_andamento' };
      const { getByText } = render(
        <RouteInfoHeaderCompact
          {...defaultProps}
          rota={rotaEmAndamento}
          onAddStopPress={onAddStopPress}
        />
      );

      expect(getByText('+ Parada')).toBeTruthy();
    });

    it('não deve exibir botão "+ Parada" para rotas concluídas', () => {
      const onAddStopPress = jest.fn();
      const rotaConcluida = { ...mockRota, status: 'concluida' };
      const { queryByText } = render(
        <RouteInfoHeaderCompact
          {...defaultProps}
          rota={rotaConcluida}
          onAddStopPress={onAddStopPress}
        />
      );

      expect(queryByText('+ Parada')).toBeNull();
    });
  });

  describe('Botão Reordenar', () => {
    it('deve exibir botão Reordenar para rotas pendentes', () => {
      const onReorderPress = jest.fn();
      const { getByText } = render(
        <RouteInfoHeaderCompact
          {...defaultProps}
          onReorderPress={onReorderPress}
        />
      );

      expect(getByText('Reordenar')).toBeTruthy();

      fireEvent.press(getByText('Reordenar'));
      expect(onReorderPress).toHaveBeenCalled();
    });

    it('deve exibir botão Reordenar para rotas em andamento', () => {
      const onReorderPress = jest.fn();
      const rotaEmAndamento = { ...mockRota, status: 'em_andamento' };
      const { getByText } = render(
        <RouteInfoHeaderCompact
          {...defaultProps}
          rota={rotaEmAndamento}
          onReorderPress={onReorderPress}
        />
      );

      expect(getByText('Reordenar')).toBeTruthy();
    });

    it('não deve exibir botão Reordenar para rotas concluídas', () => {
      const onReorderPress = jest.fn();
      const rotaConcluida = { ...mockRota, status: 'concluida' };
      const { queryByText } = render(
        <RouteInfoHeaderCompact
          {...defaultProps}
          rota={rotaConcluida}
          onReorderPress={onReorderPress}
        />
      );

      expect(queryByText('Reordenar')).toBeNull();
    });
  });

  describe('Distância sem valor', () => {
    it('não deve exibir distância quando não está definida', () => {
      const rotaSemDistancia = { ...mockRota, distancia_total: undefined };
      const { queryByText } = render(
        <RouteInfoHeaderCompact {...defaultProps} rota={rotaSemDistancia} />
      );

      expect(queryByText('km')).toBeNull();
    });
  });

  describe('Ícones', () => {
    it('deve renderizar ícone de pessoa para motorista', () => {
      const { getByTestId } = render(<RouteInfoHeaderCompact {...defaultProps} />);

      expect(getByTestId('icon-person-circle')).toBeTruthy();
    });

    it('deve renderizar ícone de velocímetro para distância', () => {
      const { getByTestId } = render(<RouteInfoHeaderCompact {...defaultProps} />);

      expect(getByTestId('icon-speedometer-outline')).toBeTruthy();
    });

    it('deve renderizar ícone de bandeira para paradas', () => {
      const { getByTestId } = render(<RouteInfoHeaderCompact {...defaultProps} />);

      expect(getByTestId('icon-flag-outline')).toBeTruthy();
    });

    it('deve renderizar ícone de tempo para status pendente', () => {
      const { getByTestId } = render(<RouteInfoHeaderCompact {...defaultProps} />);

      expect(getByTestId('icon-time')).toBeTruthy();
    });
  });
});
