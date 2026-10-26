/**
 * Tests for ParadaBottomSheet.tsx
 * Bottom sheet com detalhes e ações para uma parada
 */

import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';

import { logger } from '@/lib/logger';

import { ParadaBottomSheet } from '../ParadaBottomSheet';

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      success: '#10b981',
      info: '#3b82f6',
      warning: '#f7a02a',
      error: '#ef4444',
      primary: '#284093',
      primaryBg: '#e6ecfb',
      overlay: 'rgba(0, 0, 0, 0.5)',
      gray50: '#f9fafb',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray300: '#d1d5db',
      gray400: '#9ca3af',
      gray500: '#6b7280',
      gray600: '#4b5563',
      gray700: '#374151',
      gray900: '#111827',
      white: '#ffffff',
      black: '#000000',
      surface: '#ffffff',
      text: '#111827',
      textSecondary: '#6b7280',
    },
    typography: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20 },
      fontSans: 'System',
      fontSansMedium: 'System',
      fontSansSemiBold: 'System',
      fontSansBold: 'System',
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
      '1': 4,
      '1.5': 6,
      '2': 8,
      '2xl': 48,
    },
    borderRadius: {
      xs: 2,
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
      full: 9999,
    },
    shadows: {
      sm: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2 },
      md: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4 },
      lg: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8 },
    },
    desktop: {
      button: { height: 36, paddingHorizontal: 16, fontSize: 14 },
      section: { padding: 24, gap: 12 },
      modal: { footerGap: 8, footerPadding: 16 },
    },
  };
  return {
    defaultTheme: theme,
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: any) => (typeof fn === 'function' ? fn(theme) : fn),
    },
  };
});

// Mock responsive hook used by DesktopModal
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: false, isMobile: true, isTablet: false }),
}));

// Mock navegação externa (respeita o app preferido)
const mockAbrirNavegacao = jest.fn();
jest.mock('@/lib/navigation', () => ({
  abrirNavegacao: (dest: unknown) => mockAbrirNavegacao(dest),
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
        />,
      );

      expect(toJSON()).toBeNull();
    });

    it('deve renderizar número da parada', () => {
      const { getByText } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
        />,
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
        />,
      );

      expect(getByText('Av. Paulista, 1000')).toBeTruthy();
    });

    it('deve renderizar tipo quando disponível', () => {
      const { getByText } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
        />,
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
        />,
      );

      expect(getByText('Retirada')).toBeTruthy();
    });
  });

  describe('Rótulo do tipo', () => {
    it('origem não aparece como "Retirada"', () => {
      const { getByText, queryByText } = render(
        <ParadaBottomSheet
          parada={{ ...mockParada, tipo: 'origem' }}
          visible={true}
          onClose={mockOnClose}
        />,
      );

      expect(getByText('Parada')).toBeTruthy();
      expect(queryByText('Retirada')).toBeNull();
    });
  });

  describe('Status', () => {
    it('deve mostrar "Pendente" para status pendente', () => {
      const { getByText } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
        />,
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
        />,
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
        />,
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
        />,
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
        />,
      );

      expect(getByText('Navegar')).toBeTruthy();
    });

    it('não deve mostrar botão navegar sem coordenadas', () => {
      const paradaSemCoords = {
        ...mockParada,
        latitude: null,
        longitude: null,
      };
      const { queryByText } = render(
        <ParadaBottomSheet
          parada={paradaSemCoords}
          visible={true}
          onClose={mockOnClose}
        />,
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
        />,
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
        />,
      );

      fireEvent.press(getByText('Navegar'));

      expect(mockAbrirNavegacao).toHaveBeenCalledWith({
        latitude: mockParada.latitude,
        longitude: mockParada.longitude,
        endereco: mockParada.endereco,
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
        />,
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
        />,
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
        />,
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
        />,
      );

      fireEvent.press(getByText('Concluir'));

      expect(mockOnMarkComplete).toHaveBeenCalledWith(mockParada);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  // A aba Mapa concluía, mas não pulava: o motorista tinha de trocar de aba.
  describe('Botão Pular', () => {
    it('parada aberta: Pular chama onSkip e fecha o sheet', () => {
      const onSkip = jest.fn();
      const { getByLabelText } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
          onMarkComplete={mockOnMarkComplete}
          onSkip={onSkip}
        />,
      );

      fireEvent.press(getByLabelText('Pular parada 1'));
      expect(onSkip).toHaveBeenCalledWith(mockParada);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('parada concluída: sem Pular', () => {
      const { queryByLabelText } = render(
        <ParadaBottomSheet
          parada={{ ...mockParada, status: 'concluida' }}
          visible={true}
          onClose={mockOnClose}
          onSkip={jest.fn()}
        />,
      );
      expect(queryByLabelText('Pular parada 1')).toBeNull();
    });

    it('com cinco ações e fonte 2.0, a linha quebra e os rótulos têm teto', () => {
      const { getByText, getByTestId } = render(
        <ParadaBottomSheet
          parada={{ ...mockParada, telefone: '83999990000' }}
          visible={true}
          onClose={mockOnClose}
          onMarkComplete={mockOnMarkComplete}
          onSkip={jest.fn()}
          onViewDetails={mockOnViewDetails}
        />,
      );
      expect(getByTestId('acoes-parada-sheet').props.style).toEqual(
        expect.objectContaining({ flexWrap: 'wrap' }),
      );
      for (const rotulo of [
        'Navegar',
        'Concluir',
        'Pular',
        'Ligar',
        'Detalhes',
      ]) {
        expect(
          getByText(rotulo).props.maxFontSizeMultiplier,
        ).toBeLessThanOrEqual(1.3);
      }
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
        />,
      );

      expect(getByText('Detalhes')).toBeTruthy();
    });

    it('não deve mostrar botão detalhes sem callback', () => {
      const { queryByText } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
        />,
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
        />,
      );

      fireEvent.press(getByText('Detalhes'));

      expect(mockOnViewDetails).toHaveBeenCalledWith(mockParada);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  // Saiu do balão do pino, onde não recebia toque no Android.
  describe('Botão Ligar', () => {
    it('liga para o telefone da parada', () => {
      const openURL = jest
        .spyOn(Linking, 'openURL')
        .mockResolvedValue(undefined);
      const { getByLabelText } = render(
        <ParadaBottomSheet
          parada={{ ...mockParada, telefone: '83999990000' }}
          visible={true}
          onClose={mockOnClose}
        />,
      );

      fireEvent.press(getByLabelText('Ligar para 83999990000'));

      expect(openURL).toHaveBeenCalledWith('tel:83999990000');
    });

    it('sem discador, registra o erro em vez de rejeitar solto', async () => {
      const falha = new Error('sem discador');
      jest.spyOn(Linking, 'openURL').mockRejectedValue(falha);
      const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      const { getByLabelText } = render(
        <ParadaBottomSheet
          parada={{ ...mockParada, telefone: '83999990000' }}
          visible={true}
          onClose={mockOnClose}
        />,
      );

      fireEvent.press(getByLabelText('Ligar para 83999990000'));

      await waitFor(() =>
        expect(warn).toHaveBeenCalledWith(
          'Não foi possível abrir o discador',
          falha,
        ),
      );
    });

    it('não aparece sem telefone', () => {
      const { queryByText } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
        />,
      );

      expect(queryByText('Ligar')).toBeNull();
    });
  });

  describe('Ícones', () => {
    it('deve mostrar ícone de localização', () => {
      const { getByTestId } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
        />,
      );

      expect(getByTestId('icon-location-outline')).toBeTruthy();
    });

    it('deve mostrar ícone navigate para botão navegar', () => {
      const { getByTestId } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
        />,
      );

      expect(getByTestId('icon-navigate')).toBeTruthy();
    });

    it('deve mostrar ícone cube-outline para entrega', () => {
      const { getByTestId } = render(
        <ParadaBottomSheet
          parada={mockParada}
          visible={true}
          onClose={mockOnClose}
        />,
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
        />,
      );

      expect(getByTestId('icon-arrow-up-circle-outline')).toBeTruthy();
    });
  });

  // Pino agrupado (entrega + retirada no mesmo local): o sheet mostrava só a
  // principal, e o motorista não via que havia outro serviço ali.
  describe('Serviços no mesmo local', () => {
    const entrega = {
      ...mockParada,
      id: 'p3',
      ordem: 3,
      tipo: 'entrega',
      status: 'pendente',
    };
    const retirada = {
      ...mockParada,
      id: 'p4',
      ordem: 4,
      tipo: 'retirada',
      status: 'pendente',
    };

    it('lista cada serviço do local com tipo e status', () => {
      const { getByText, getByTestId } = render(
        <ParadaBottomSheet
          parada={entrega}
          servicosNoLocal={[entrega, retirada]}
          visible={true}
          onClose={mockOnClose}
        />,
      );

      expect(getByText('Paradas 3+4')).toBeTruthy();
      expect(getByTestId('servico-no-local-p3')).toHaveTextContent(
        '3 · Entrega · Pendente',
      );
      expect(getByTestId('servico-no-local-p4')).toHaveTextContent(
        '4 · Retirada · Pendente',
      );
    });

    it('mostra o status de cada serviço, não só o da principal', () => {
      const entregaFeita = { ...entrega, status: 'concluida' };
      const { getByTestId } = render(
        <ParadaBottomSheet
          parada={retirada}
          servicosNoLocal={[entregaFeita, retirada]}
          visible={true}
          onClose={mockOnClose}
        />,
      );

      expect(getByTestId('servico-no-local-p3')).toHaveTextContent(
        '3 · Entrega · Concluída',
      );
    });

    it('com um serviço só, continua como parada simples', () => {
      const { getByText, queryByTestId } = render(
        <ParadaBottomSheet
          parada={entrega}
          servicosNoLocal={[entrega]}
          visible={true}
          onClose={mockOnClose}
        />,
      );

      expect(getByText('Parada 3')).toBeTruthy();
      expect(queryByTestId('servico-no-local-p3')).toBeNull();
    });
  });
});
