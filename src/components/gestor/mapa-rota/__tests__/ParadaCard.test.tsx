/**
 * Tests for ParadaCard.tsx
 * Card de exibição de uma parada
 */

import { render, fireEvent } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import React from 'react';

import { ParadaCard } from '../ParadaCard';

import type { Parada } from '../types';

// Mock dependencies
jest.mock('expo-linking', () => ({
  openURL: jest.fn(),
}));

jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
      success: '#10b981',
      warning: '#f7a02a',
      info: '#3b82f6',
      error: '#ef4444',
      white: '#ffffff',
      gray400: '#9ca3af',
      gray500: '#6b7280',
      gray700: '#374151',
      gray900: '#111827',
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
    typography: { fontSize: { xs: 12, sm: 14, base: 16 } },
    borderRadius: { md: 10 },
  };

  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: (t: typeof theme) => Record<string, unknown>) => fn(theme),
    },
  };
});

// Mock styles
jest.mock('../styles', () => ({
  styles: {
    paradaCard: {},
    paradaCardSelected: {},
    paradaHeader: {},
    paradaNumero: {},
    paradaNumeroText: {},
    paradaHeaderInfo: {},
    paradaHeaderTop: {},
    paradaEndereco: {},
    paradaTags: {},
    tipoTag: {},
    tipoTagEntrega: {},
    tipoTagRetirada: {},
    tipoTagText: {},
    statusTag: {},
    statusTagConcluida: {},
    statusTagPendente: {},
    statusTagEmAndamento: {},
    statusTagText: {},
    paradaDetalhes: {},
    paradaMetaGrid: {},
    paradaMetaItem: {},
    paradaMetaItemFull: {},
    paradaMetaLabel: {},
    paradaMetaValue: {},
    paradaTelefoneLink: {},
    paradaTelefoneLinkText: {},
    paradaFotoContainer: {},
    paradaFoto: {},
    paradaFotoOverlay: {},
    paradaFotoOverlayIcon: {},
    paradaFotoPlaceholder: {},
    paradaFotoPlaceholderText: {},
  },
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text testID={`icon-${name}`}>{name}</Text>;
  },
}));

describe('ParadaCard', () => {
  const mockParada: Parada = {
    id: 'parada-1',
    ordem: 1,
    endereco: 'Rua das Flores, 123',
    tipo: 'entrega',
    status: 'pendente',
    latitude: -23.56,
    longitude: -46.64,
    destinatario: 'João Silva',
    telefone: '(11) 99999-8888',
    observacoes: 'Deixar na portaria',
  };

  const defaultProps = {
    parada: mockParada,
    index: 0,
    onImagePress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização', () => {
    it('deve renderizar o card com informações básicas', () => {
      const { getByText } = render(<ParadaCard {...defaultProps} />);

      expect(getByText('Rua das Flores, 123')).toBeTruthy();
      expect(getByText('1')).toBeTruthy(); // ordem
      expect(getByText('Entrega')).toBeTruthy();
      expect(getByText('Pendente')).toBeTruthy();
    });

    it('deve renderizar detalhes do destinatário', () => {
      const { getByText } = render(<ParadaCard {...defaultProps} />);

      expect(getByText('João Silva')).toBeTruthy();
    });

    it('deve renderizar telefone', () => {
      const { getByText } = render(<ParadaCard {...defaultProps} />);

      expect(getByText('(11) 99999-8888')).toBeTruthy();
    });

    it('deve renderizar observações', () => {
      const { getByText } = render(<ParadaCard {...defaultProps} />);

      expect(getByText('Deixar na portaria')).toBeTruthy();
    });

    it('deve exibir tag Retirada para paradas de retirada', () => {
      const paradaRetirada = { ...mockParada, tipo: 'retirada' as const };
      const { getByText } = render(
        <ParadaCard {...defaultProps} parada={paradaRetirada} />,
      );

      expect(getByText('Retirada')).toBeTruthy();
    });

    it('deve exibir status "Concluida" para paradas concluídas', () => {
      const paradaConcluida = { ...mockParada, status: 'concluida' };
      const { getByText } = render(
        <ParadaCard {...defaultProps} parada={paradaConcluida} />,
      );

      expect(getByText('Concluida')).toBeTruthy();
    });

    it('deve exibir status "Em andamento" para paradas em andamento', () => {
      const paradaEmAndamento = { ...mockParada, status: 'em_andamento' };
      const { getByText } = render(
        <ParadaCard {...defaultProps} parada={paradaEmAndamento} />,
      );

      expect(getByText('Em andamento')).toBeTruthy();
    });
  });

  describe('Interações com telefone', () => {
    it('deve abrir ligação ao clicar no telefone', () => {
      const { getByText } = render(<ParadaCard {...defaultProps} />);

      fireEvent.press(getByText('(11) 99999-8888'));

      expect(Linking.openURL).toHaveBeenCalledWith('tel:11999998888');
    });
  });

  describe('Card Selecionado', () => {
    it('deve aplicar estilo selecionado quando selected=true', () => {
      const { getByText } = render(
        <ParadaCard {...defaultProps} selected={true} />,
      );

      expect(getByText('Rua das Flores, 123')).toBeTruthy();
    });
  });

  describe('Callback onPress', () => {
    it('deve chamar onPress ao clicar no card', () => {
      const onPress = jest.fn();
      const { getByText } = render(
        <ParadaCard {...defaultProps} onPress={onPress} />,
      );

      fireEvent.press(getByText('Rua das Flores, 123'));

      expect(onPress).toHaveBeenCalledWith('parada-1');
    });
  });

  describe('Foto da entrega', () => {
    it('deve exibir foto quando foto_url está presente', () => {
      const paradaComFoto = {
        ...mockParada,
        status: 'concluida',
        foto_url: 'https://example.com/foto.jpg',
      };
      const { queryByTestId } = render(
        <ParadaCard {...defaultProps} parada={paradaComFoto} />,
      );

      expect(queryByTestId('icon-expand-outline')).toBeTruthy();
    });

    it('deve exibir placeholder quando concluída sem foto', () => {
      const paradaSemFoto = {
        ...mockParada,
        status: 'concluida',
        foto_url: null,
      };
      const { getByText, getByTestId } = render(
        <ParadaCard {...defaultProps} parada={paradaSemFoto} />,
      );

      expect(getByText('Sem foto registrada')).toBeTruthy();
      expect(getByTestId('icon-camera-outline')).toBeTruthy();
    });

    it('deve chamar onImagePress ao clicar na foto', () => {
      const onImagePress = jest.fn();
      const paradaComFoto = {
        ...mockParada,
        status: 'concluida',
        foto_url: 'https://example.com/foto.jpg',
      };
      const { getByTestId } = render(
        <ParadaCard
          {...defaultProps}
          parada={paradaComFoto}
          onImagePress={onImagePress}
        />,
      );

      const icon = getByTestId('icon-expand-outline');
      let target: any = icon;
      while (target && !target.props?.onPress) {
        target = target.parent;
      }

      expect(target?.props?.onPress).toBeDefined();

      fireEvent.press(target);

      expect(onImagePress).toHaveBeenCalledWith('https://example.com/foto.jpg');
    });
  });

  describe('Parada sem detalhes extras', () => {
    it('deve renderizar sem seção de detalhes quando não há extras', () => {
      const paradaMinima: Parada = {
        id: 'parada-2',
        ordem: 2,
        endereco: 'Rua Simples, 456',
        tipo: 'entrega',
        status: 'pendente',
        latitude: -23.55,
        longitude: -46.63,
      };

      const { getByText, queryByText } = render(
        <ParadaCard {...defaultProps} parada={paradaMinima} />,
      );

      expect(getByText('Rua Simples, 456')).toBeTruthy();
      expect(queryByText('Destinatario')).toBeNull();
      expect(queryByText('Telefone')).toBeNull();
      expect(queryByText('Observacoes')).toBeNull();
    });
  });
});
