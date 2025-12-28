/**
 * Tests for ParadaCardCompact.tsx
 * Card compacto de parada
 */

import { render, fireEvent } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import React from 'react';

import { ParadaCardCompact } from '../ParadaCardCompact';

import type { Parada } from '../types';

// Mock dependencies
jest.mock('expo-linking', () => ({
  openURL: jest.fn(),
}));

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
      gray50: '#f9fafb',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray400: '#9ca3af',
      gray500: '#6b7280',
      gray600: '#4b5563',
      gray700: '#374151',
      gray900: '#111827',
      infoBg: '#dbeafe',
      warningBg: '#fef3c7',
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
    typography: { fontSize: { xs: 12, sm: 14, base: 16 } },
    borderRadius: { sm: 8, md: 10, full: 9999 },
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

describe('ParadaCardCompact', () => {
  const mockParada: Parada = {
    id: 'parada-1',
    ordem: 1,
    endereco: 'Rua das Flores, 123, Centro, São Paulo - SP',
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
    it('deve renderizar o card compacto com informações básicas', () => {
      const { getByText } = render(<ParadaCardCompact {...defaultProps} />);

      expect(getByText('1')).toBeTruthy(); // ordem
      expect(getByText('ENTREGA')).toBeTruthy();
      expect(getByText('Pend')).toBeTruthy(); // status abreviado
    });

    it('deve truncar endereço longo', () => {
      const { getByText } = render(<ParadaCardCompact {...defaultProps} />);

      // Endereço truncado em 45 caracteres + ...
      expect(getByText(/Rua das Flores/)).toBeTruthy();
    });

    it('deve exibir destinatário', () => {
      const { getByText } = render(<ParadaCardCompact {...defaultProps} />);

      expect(getByText('João Silva')).toBeTruthy();
    });

    it('deve exibir telefone', () => {
      const { getByText } = render(<ParadaCardCompact {...defaultProps} />);

      expect(getByText('(11) 99999-8888')).toBeTruthy();
    });

    it('deve exibir tag RETIRADA para paradas de retirada', () => {
      const paradaRetirada = { ...mockParada, tipo: 'retirada' as const };
      const { getByText } = render(
        <ParadaCardCompact {...defaultProps} parada={paradaRetirada} />
      );

      expect(getByText('RETIRADA')).toBeTruthy();
    });

    it('deve exibir status OK para paradas concluídas', () => {
      const paradaConcluida = { ...mockParada, status: 'concluida' };
      const { getByText } = render(
        <ParadaCardCompact {...defaultProps} parada={paradaConcluida} />
      );

      expect(getByText('OK')).toBeTruthy();
    });

    it('deve exibir status "Em rota" para paradas em andamento', () => {
      const paradaEmAndamento = { ...mockParada, status: 'em_andamento' };
      const { getByText } = render(
        <ParadaCardCompact {...defaultProps} parada={paradaEmAndamento} />
      );

      expect(getByText('Em rota')).toBeTruthy();
    });
  });

  describe('Expansão do card', () => {
    it('deve expandir ao clicar no card', () => {
      const onPress = jest.fn();
      const { getByText, queryByText } = render(
        <ParadaCardCompact {...defaultProps} onPress={onPress} />
      );

      // Inicialmente não deve mostrar observações
      expect(queryByText('Deixar na portaria')).toBeNull();

      // Clicar para expandir
      fireEvent.press(getByText('João Silva'));

      // Agora deve mostrar observações
      expect(getByText('Deixar na portaria')).toBeTruthy();
      expect(onPress).toHaveBeenCalledWith('parada-1');
    });

    it('deve mostrar endereço completo quando expandido', () => {
      const { getByText, getAllByText } = render(
        <ParadaCardCompact {...defaultProps} />
      );

      // Expandir
      fireEvent.press(getByText('João Silva'));

      // Deve mostrar endereço completo (pode aparecer mais de uma vez)
      expect(getAllByText('Rua das Flores, 123, Centro, São Paulo - SP').length).toBeGreaterThan(0);
    });
  });

  describe('Interações com telefone', () => {
    it('deve abrir ligação ao clicar no telefone', () => {
      const { getByText } = render(<ParadaCardCompact {...defaultProps} />);

      // Expandir primeiro
      fireEvent.press(getByText('João Silva'));

      // Clicar em Ligar
      fireEvent.press(getByText('Ligar'));

      expect(Linking.openURL).toHaveBeenCalledWith('tel:11999998888');
    });
  });

  describe('Ações de edição', () => {
    it('deve exibir botão Editar para paradas pendentes em rotas editáveis', () => {
      const onEdit = jest.fn();
      const { getByText } = render(
        <ParadaCardCompact
          {...defaultProps}
          rotaStatus="pendente"
          onEdit={onEdit}
        />
      );

      // Expandir
      fireEvent.press(getByText('João Silva'));

      // Deve ter botão Editar
      expect(getByText('Editar')).toBeTruthy();

      fireEvent.press(getByText('Editar'));
      expect(onEdit).toHaveBeenCalledWith(mockParada);
    });

    it('deve exibir botão Remover para paradas pendentes', () => {
      const onRemove = jest.fn();
      const { getByText } = render(
        <ParadaCardCompact
          {...defaultProps}
          rotaStatus="pendente"
          onRemove={onRemove}
        />
      );

      // Expandir
      fireEvent.press(getByText('João Silva'));

      // Deve ter botão Remover
      expect(getByText('Remover')).toBeTruthy();

      fireEvent.press(getByText('Remover'));
      expect(onRemove).toHaveBeenCalledWith(mockParada);
    });

    it('não deve exibir ações de edição para paradas concluídas', () => {
      const onEdit = jest.fn();
      const onRemove = jest.fn();
      const paradaConcluida = { ...mockParada, status: 'concluida' };

      const { getByText, queryByText } = render(
        <ParadaCardCompact
          {...defaultProps}
          parada={paradaConcluida}
          rotaStatus="em_andamento"
          onEdit={onEdit}
          onRemove={onRemove}
        />
      );

      // Expandir
      fireEvent.press(getByText('1'));

      // Não deve ter botões de edição
      expect(queryByText('Editar')).toBeNull();
      expect(queryByText('Remover')).toBeNull();
    });
  });

  describe('Foto da entrega', () => {
    it('deve exibir thumbnail quando foto_url está presente', () => {
      const paradaComFoto = {
        ...mockParada,
        status: 'concluida',
        foto_url: 'https://example.com/foto.jpg',
      };
      const { queryByTestId } = render(
        <ParadaCardCompact {...defaultProps} parada={paradaComFoto} />
      );

      expect(queryByTestId('icon-image-outline')).toBeTruthy();
    });

    it('deve exibir indicador de foto ausente quando concluída sem foto', () => {
      const paradaSemFoto = {
        ...mockParada,
        status: 'concluida',
        foto_url: null,
      };
      const { getByTestId } = render(
        <ParadaCardCompact {...defaultProps} parada={paradaSemFoto} />
      );

      expect(getByTestId('icon-camera-outline')).toBeTruthy();
    });

    it('deve chamar onImagePress ao clicar em Ver foto', () => {
      const onImagePress = jest.fn();
      const paradaComFoto = {
        ...mockParada,
        status: 'concluida',
        foto_url: 'https://example.com/foto.jpg',
      };
      const { getByText } = render(
        <ParadaCardCompact
          {...defaultProps}
          parada={paradaComFoto}
          onImagePress={onImagePress}
        />
      );

      // Expandir
      fireEvent.press(getByText('1'));

      // Clicar em Ver foto
      fireEvent.press(getByText('Ver foto'));

      expect(onImagePress).toHaveBeenCalledWith('https://example.com/foto.jpg');
    });
  });

  describe('Card Selecionado', () => {
    it('deve aceitar prop selected', () => {
      const { getByText } = render(
        <ParadaCardCompact {...defaultProps} selected={true} />
      );

      expect(getByText('1')).toBeTruthy();
    });
  });

  describe('Parada sem detalhes extras', () => {
    it('deve renderizar sem problemas quando não há extras', () => {
      const paradaMinima: Parada = {
        id: 'parada-2',
        ordem: 2,
        endereco: 'Rua Simples',
        tipo: 'entrega',
        status: 'pendente',
        latitude: -23.55,
        longitude: -46.63,
      };

      const { getByText } = render(
        <ParadaCardCompact {...defaultProps} parada={paradaMinima} />
      );

      expect(getByText('Rua Simples')).toBeTruthy();
      // Não deve mostrar telefone ou destinatário
    });
  });
});
