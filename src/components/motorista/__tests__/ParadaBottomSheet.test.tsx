/**
 * Tests for ParadaBottomSheet.tsx
 * Bottom sheet com detalhes e ações para uma parada
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { ParadaBottomSheet } from '../ParadaBottomSheet';

// Mock styles
jest.mock('@/utils/styles', () => ({
  StyleSheet: {
    create: (fn: Function) => fn({
      colors: {
        success: '#10b981',
        info: '#3b82f6',
        warning: '#f7a02a',
        gray500: '#6b7280',
        white: '#ffffff',
        surface: '#ffffff',
        gray300: '#d1d5db',
        gray50: '#f9fafb',
        text: '#111827',
        textSecondary: '#6b7280',
        primary: '#284093',
      },
    }),
  },
  defaultTheme: {
    colors: {
      success: '#10b981',
      info: '#3b82f6',
      warning: '#f7a02a',
      gray500: '#6b7280',
      white: '#ffffff',
      surface: '#ffffff',
      gray300: '#d1d5db',
      gray50: '#f9fafb',
      text: '#111827',
      textSecondary: '#6b7280',
      primary: '#284093',
    },
  },
}));

// Mock navigation utils
const mockShowNavigationOptions = jest.fn();
jest.mock('@/utils/navigation', () => ({
  showNavigationOptions: (dest: unknown) => mockShowNavigationOptions(dest),
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text testID={`icon-${name}`}>{name}</Text>;
  },
}));

describe('ParadaBottomSheet', () => {
  const mockParada = {
    id: 'parada-1',
    ordem: 1,
    endereco: 'Av. Paulista, 1000',
    latitude: -23.5505,
    longitude: -46.6333,
    status: 'pendente',
    tipo: 'entrega',
  };

  const mockOnClose = jest.fn();
  const mockOnNavigate = jest.fn();
  const mockOnMarkComplete = jest.fn();
  const mockOnViewDetails = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização', () => {
    it('deve retornar null quando parada é null', () => {
      const { toJSON } = render(
        <ParadaBottomSheet
          parada={null}
          visible={true}
          onClose={mockOnClose}
        />
      );

      expect(toJSON()).toBeNull();
    });

    it('deve renderizar número da parada', () => {
      const { getByText } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
        />
      );

      expect(getByText('Parada 1')).toBeTruthy();
      expect(getByText('1')).toBeTruthy();
    });

    it('deve renderizar endereço', () => {
      const { getByText } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
        />
      );

      expect(getByText('Av. Paulista, 1000')).toBeTruthy();
    });

    it('deve renderizar tipo quando disponível', () => {
      const { getByText } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
        />
      );

      expect(getByText('Entrega')).toBeTruthy();
    });

    it('deve renderizar "Retirada" para tipo retirada', () => {
      const paradaRetirada = { ...mockParada, tipo: 'retirada' };
      const { getByText } = render(
        <ParadaBottomSheet
          parada={paradaRetirada}
          visible={true}
          onClose={mockOnClose}
        />
      );

      expect(getByText('Retirada')).toBeTruthy();
    });
  });

  describe('Status', () => {
    it('deve mostrar "Pendente" para status pendente', () => {
      const { getByText } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
        />
      );

      expect(getByText('Pendente')).toBeTruthy();
    });

    it('deve mostrar "Concluída" para status concluida', () => {
      const paradaConcluida = { ...mockParada, status: 'concluida' };
      const { getByText } = render(
        <ParadaBottomSheet
          parada={paradaConcluida}
          visible={true}
          onClose={mockOnClose}
        />
      );

      expect(getByText('Concluída')).toBeTruthy();
    });

    it('deve mostrar "Em andamento" para status em_andamento', () => {
      const paradaEmAndamento = { ...mockParada, status: 'em_andamento' };
      const { getByText } = render(
        <ParadaBottomSheet
          parada={paradaEmAndamento}
          visible={true}
          onClose={mockOnClose}
        />
      );

      expect(getByText('Em andamento')).toBeTruthy();
    });
  });

  describe('Botão Fechar', () => {
    it('deve chamar onClose ao clicar no overlay', () => {
      const { getByTestId } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
        />
      );

      // O overlay é o primeiro TouchableOpacity
      const closeIcon = getByTestId('icon-close');
      expect(closeIcon).toBeTruthy();
    });
  });

  describe('Botão Navegar', () => {
    it('deve mostrar botão navegar quando tem coordenadas', () => {
      const { getByText } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
        />
      );

      expect(getByText('Navegar')).toBeTruthy();
    });

    it('não deve mostrar botão navegar sem coordenadas', () => {
      const paradaSemCoords = { ...mockParada, latitude: null, longitude: null };
      const { queryByText } = render(
        <ParadaBottomSheet
          parada={paradaSemCoords}
          visible={true}
          onClose={mockOnClose}
        />
      );

      expect(queryByText('Navegar')).toBeNull();
    });

    it('deve chamar onNavigate ao clicar em navegar', () => {
      const { getByText } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
          onNavigate={mockOnNavigate}
        />
      );

      fireEvent.press(getByText('Navegar'));

      expect(mockOnNavigate).toHaveBeenCalledWith(mockParada);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('deve usar showNavigationOptions quando onNavigate não fornecido', () => {
      const { getByText } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
        />
      );

      fireEvent.press(getByText('Navegar'));

      expect(mockShowNavigationOptions).toHaveBeenCalledWith({
        latitude: mockParada.latitude,
        longitude: mockParada.longitude,
        label: expect.any(String),
      });
    });
  });

  describe('Botão Concluir', () => {
    it('deve mostrar botão concluir para parada pendente', () => {
      const { getByText } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
          onMarkComplete={mockOnMarkComplete}
        />
      );

      expect(getByText('Concluir')).toBeTruthy();
    });

    it('deve mostrar botão concluir para parada em andamento', () => {
      const paradaEmAndamento = { ...mockParada, status: 'em_andamento' };
      const { getByText } = render(
        <ParadaBottomSheet
          parada={paradaEmAndamento}
          visible={true}
          onClose={mockOnClose}
          onMarkComplete={mockOnMarkComplete}
        />
      );

      expect(getByText('Concluir')).toBeTruthy();
    });

    it('não deve mostrar botão concluir para parada concluída', () => {
      const paradaConcluida = { ...mockParada, status: 'concluida' };
      const { queryByText } = render(
        <ParadaBottomSheet
          parada={paradaConcluida}
          visible={true}
          onClose={mockOnClose}
          onMarkComplete={mockOnMarkComplete}
        />
      );

      expect(queryByText('Concluir')).toBeNull();
    });

    it('deve chamar onMarkComplete ao clicar', () => {
      const { getByText } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
          onMarkComplete={mockOnMarkComplete}
        />
      );

      fireEvent.press(getByText('Concluir'));

      expect(mockOnMarkComplete).toHaveBeenCalledWith(mockParada);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Botão Detalhes', () => {
    it('deve mostrar botão detalhes quando callback fornecido', () => {
      const { getByText } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
          onViewDetails={mockOnViewDetails}
        />
      );

      expect(getByText('Detalhes')).toBeTruthy();
    });

    it('não deve mostrar botão detalhes sem callback', () => {
      const { queryByText } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
        />
      );

      expect(queryByText('Detalhes')).toBeNull();
    });

    it('deve chamar onViewDetails ao clicar', () => {
      const { getByText } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
          onViewDetails={mockOnViewDetails}
        />
      );

      fireEvent.press(getByText('Detalhes'));

      expect(mockOnViewDetails).toHaveBeenCalledWith(mockParada);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Ícones', () => {
    it('deve mostrar ícone de localização', () => {
      const { getByTestId } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
        />
      );

      expect(getByTestId('icon-location-outline')).toBeTruthy();
    });

    it('deve mostrar ícone navigate para botão navegar', () => {
      const { getByTestId } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
        />
      );

      expect(getByTestId('icon-navigate')).toBeTruthy();
    });

    it('deve mostrar ícone cube-outline para entrega', () => {
      const { getByTestId } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
        />
      );

      expect(getByTestId('icon-cube-outline')).toBeTruthy();
    });

    it('deve mostrar ícone arrow-up-circle-outline para retirada', () => {
      const paradaRetirada = { ...mockParada, tipo: 'retirada' };
      const { getByTestId } = render(
        <ParadaBottomSheet
          parada={paradaRetirada}
          visible={true}
          onClose={mockOnClose}
        />
      );

      expect(getByTestId('icon-arrow-up-circle-outline')).toBeTruthy();
    });
  });
});
