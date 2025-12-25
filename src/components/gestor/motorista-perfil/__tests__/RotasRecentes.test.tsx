/**
 * Tests for RotasRecentes.tsx
 * Lista das últimas rotas do motorista
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { RotasRecentes } from '../RotasRecentes';

import type { RotaRecente } from '../types';

// Mock expo-router
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
      success: '#10b981',
      warning: '#f7a02a',
      error: '#ef4444',
      info: '#3b82f6',
      gray300: '#d1d5db',
      gray500: '#6b7280',
      gray600: '#4b5563',
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
    rotasContainer: {},
    rotasHeader: {},
    rotasTitle: {},
    rotasVerTodas: {},
    rotaCard: {},
    rotaCardLeft: {},
    rotaIconContainer: {},
    rotaInfo: {},
    rotaData: {},
    rotaDistancia: {},
    rotaStatusBadge: {},
    rotaStatusText: {},
    rotaStatusConcluida: {},
    rotaStatusTextConcluida: {},
    rotaStatusEmAndamento: {},
    rotaStatusTextEmAndamento: {},
    rotaStatusPendente: {},
    rotaStatusTextPendente: {},
    rotaStatusNaoExecutada: {},
    rotaStatusTextNaoExecutada: {},
    rotaStatusCancelada: {},
    rotaStatusTextCancelada: {},
    emptyRotas: {},
    emptyRotasText: {},
  },
}));

describe('RotasRecentes', () => {
  const mockRotas: RotaRecente[] = [
    {
      id: 'rota-1',
      data: '2025-12-20T10:00:00Z',
      status: 'concluida',
      distancia_total: 45.5,
      paradas_count: 8,
    },
    {
      id: 'rota-2',
      data: '2025-12-19T10:00:00Z',
      status: 'em_andamento',
      distancia_total: 32.3,
      paradas_count: 5,
    },
    {
      id: 'rota-3',
      data: '2025-12-18T10:00:00Z',
      status: 'pendente',
      distancia_total: null,
      paradas_count: 10,
    },
    {
      id: 'rota-4',
      data: '2025-12-17T10:00:00Z',
      status: 'nao_executada',
      distancia_total: 28.0,
      paradas_count: 6,
    },
    {
      id: 'rota-5',
      data: '2025-12-16T10:00:00Z',
      status: 'cancelada',
      distancia_total: 15.0,
      paradas_count: 3,
    },
  ];

  const mockOnVerTodas = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Estado vazio', () => {
    it('deve mostrar mensagem quando não há rotas', () => {
      const { getByText } = render(
        <RotasRecentes rotas={[]} />
      );

      expect(getByText('Nenhuma rota encontrada para este motorista')).toBeTruthy();
    });

    it('deve mostrar ícone navigate-outline quando vazio', () => {
      const { getByText } = render(
        <RotasRecentes rotas={[]} />
      );

      expect(getByText('navigate-outline')).toBeTruthy();
    });

    it('deve mostrar título "Rotas Recentes" mesmo quando vazio', () => {
      const { getByText } = render(
        <RotasRecentes rotas={[]} />
      );

      expect(getByText('Rotas Recentes')).toBeTruthy();
    });
  });

  describe('Lista de rotas', () => {
    it('deve renderizar título "Rotas Recentes"', () => {
      const { getByText } = render(
        <RotasRecentes rotas={mockRotas} />
      );

      expect(getByText('Rotas Recentes')).toBeTruthy();
    });

    it('deve renderizar todas as rotas', () => {
      const { getByText } = render(
        <RotasRecentes rotas={mockRotas} />
      );

      // Verificar que cada status é renderizado
      expect(getByText('Concluída')).toBeTruthy();
      expect(getByText('Em andamento')).toBeTruthy();
      expect(getByText('Pendente')).toBeTruthy();
      expect(getByText('Não executada')).toBeTruthy();
      expect(getByText('Cancelada')).toBeTruthy();
    });

    it('deve formatar data corretamente', () => {
      const { getByText } = render(
        <RotasRecentes rotas={mockRotas} />
      );

      // Verifica se pelo menos uma data formatada está presente
      expect(getByText('20/12/2025')).toBeTruthy();
    });

    it('deve mostrar distância quando disponível', () => {
      const { getByText } = render(
        <RotasRecentes rotas={mockRotas} />
      );

      expect(getByText('45.5 km')).toBeTruthy();
      expect(getByText('32.3 km')).toBeTruthy();
    });
  });

  describe('Botão Ver todas', () => {
    it('deve mostrar "Ver todas" quando onVerTodas fornecido', () => {
      const { getByText } = render(
        <RotasRecentes rotas={mockRotas} onVerTodas={mockOnVerTodas} />
      );

      expect(getByText('Ver todas')).toBeTruthy();
    });

    it('não deve mostrar "Ver todas" sem callback', () => {
      const { queryByText } = render(
        <RotasRecentes rotas={mockRotas} />
      );

      expect(queryByText('Ver todas')).toBeNull();
    });

    it('deve chamar onVerTodas ao clicar', () => {
      const { getByText } = render(
        <RotasRecentes rotas={mockRotas} onVerTodas={mockOnVerTodas} />
      );

      fireEvent.press(getByText('Ver todas'));

      expect(mockOnVerTodas).toHaveBeenCalledTimes(1);
    });
  });

  describe('Navegação para detalhes', () => {
    it('deve navegar para mapa-rota ao clicar em uma rota', () => {
      const { getByText } = render(
        <RotasRecentes rotas={mockRotas} />
      );

      // Clicar na primeira rota (Concluída)
      fireEvent.press(getByText('Concluída'));

      expect(mockPush).toHaveBeenCalledWith('/gestor/mapa-rota?id=rota-1');
    });
  });

  describe('Ícones de status', () => {
    it('deve mostrar checkmark-circle para concluída', () => {
      const { getByText } = render(
        <RotasRecentes rotas={[mockRotas[0]]} />
      );

      expect(getByText('checkmark-circle')).toBeTruthy();
    });

    it('deve mostrar time para em andamento', () => {
      const { getByText } = render(
        <RotasRecentes rotas={[mockRotas[1]]} />
      );

      expect(getByText('time')).toBeTruthy();
    });

    it('deve mostrar hourglass para pendente', () => {
      const { getByText } = render(
        <RotasRecentes rotas={[mockRotas[2]]} />
      );

      expect(getByText('hourglass')).toBeTruthy();
    });

    it('deve mostrar alert-circle para não executada', () => {
      const { getByText } = render(
        <RotasRecentes rotas={[mockRotas[3]]} />
      );

      expect(getByText('alert-circle')).toBeTruthy();
    });

    it('deve mostrar close-circle para cancelada', () => {
      const { getByText } = render(
        <RotasRecentes rotas={[mockRotas[4]]} />
      );

      expect(getByText('close-circle')).toBeTruthy();
    });
  });

  describe('Status desconhecido', () => {
    it('deve usar fallback para status desconhecido', () => {
      const rotaDesconhecida: RotaRecente = {
        id: 'rota-x',
        data: '2025-12-15T10:00:00Z',
        status: 'status_invalido',
        distancia_total: 10.0,
        paradas_count: 2,
      };

      const { getByText } = render(
        <RotasRecentes rotas={[rotaDesconhecida]} />
      );

      // Deve usar config de pendente como fallback
      expect(getByText('Pendente')).toBeTruthy();
    });
  });
});
