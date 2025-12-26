/**
 * Tests for DraggableStopList.tsx
 * Lista de paradas com reordenação (drag-and-drop no mobile, botões na web)
 *
 * Nota: O componente agora é usado dentro de um DesktopModal que gerencia
 * header (título) e footer (botões de ação). O DraggableStopList expõe
 * controles via ref e callbacks.
 */

import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';

import { DraggableStopList } from '../DraggableStopList';
import type { DraggableStopListControl } from '../DraggableStopList';
import type { Parada } from '../types';

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
      gray50: '#f9fafb',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray300: '#d1d5db',
      gray400: '#9ca3af',
      gray500: '#6b7280',
      gray600: '#4b5563',
      gray700: '#374151',
      gray900: '#111827',
      primaryBg: '#f0f4ff',
      infoBg: '#eff6ff',
      warningBg: '#fffbeb',
      successBg: '#d1fae5',
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
    typography: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      fontSize: { xs: 12, sm: 14, lg: 18 },
      fontSans: 'NunitoSans-Regular',
      fontSansMedium: 'NunitoSans-Medium',
      fontSansSemiBold: 'NunitoSans-SemiBold',
      fontSansBold: 'NunitoSans-Bold',
    },
    borderRadius: { sm: 6, md: 10, lg: 16, full: 9999 },
    desktop: {
      input: { fontSize: 14, height: 36, paddingHorizontal: 12 },
      section: { gap: 12 },
      field: { marginBottom: 12 },
    },
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
  Ionicons: ({ name, testID }: { name: string; testID?: string }) => {
    const { Text } = require('react-native');
    return <Text testID={testID || `icon-${name}`}>{name}</Text>;
  },
}));

// Mock react-native-draggable-flatlist
jest.mock('react-native-draggable-flatlist', () => {
  const React = require('react');
  const { View, FlatList } = require('react-native');

  return {
    __esModule: true,
    default: ({ data, renderItem, keyExtractor, onDragEnd }: any) => (
      <FlatList
        data={data}
        renderItem={(info: any) =>
          renderItem({ item: info.item, drag: jest.fn(), isActive: false })
        }
        keyExtractor={keyExtractor}
        testID="draggable-flatlist"
      />
    ),
    ScaleDecorator: ({ children }: { children: React.ReactNode }) => (
      <View testID="scale-decorator">{children}</View>
    ),
  };
});

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children, style }: any) => {
    const { View } = require('react-native');
    return (
      <View style={style} testID="gesture-handler-root">
        {children}
      </View>
    );
  },
}));

describe('DraggableStopList', () => {
  const mockParadasPendentes: Parada[] = [
    {
      id: 'parada-1',
      rota_id: 'rota-1',
      tipo: 'entrega',
      endereco: 'Rua A, 100',
      latitude: -7.1,
      longitude: -34.8,
      ordem: 1,
      status: 'pendente',
      destinatario: 'Cliente A',
      is_checkpoint: true,
    },
    {
      id: 'parada-2',
      rota_id: 'rota-1',
      tipo: 'retirada',
      endereco: 'Rua B, 200',
      latitude: -7.2,
      longitude: -34.9,
      ordem: 2,
      status: 'pendente',
      destinatario: 'Cliente B',
      is_checkpoint: true,
    },
    {
      id: 'parada-3',
      rota_id: 'rota-1',
      tipo: 'entrega',
      endereco: 'Rua C, 300',
      latitude: -7.3,
      longitude: -34.7,
      ordem: 3,
      status: 'pendente',
      is_checkpoint: true,
    },
  ];

  const mockParadasMistas: Parada[] = [
    {
      id: 'parada-concluida',
      rota_id: 'rota-1',
      tipo: 'entrega',
      endereco: 'Rua Concluida, 50',
      latitude: -7.0,
      longitude: -34.6,
      ordem: 1,
      status: 'concluida',
      is_checkpoint: true,
    },
    {
      id: 'parada-pulada',
      rota_id: 'rota-1',
      tipo: 'retirada',
      endereco: 'Rua Pulada, 60',
      latitude: -7.05,
      longitude: -34.65,
      ordem: 2,
      status: 'pulada',
      is_checkpoint: true,
    },
    ...mockParadasPendentes,
  ];

  const defaultProps = {
    paradas: mockParadasPendentes,
    onReorder: jest.fn(),
    rotaStatus: 'pendente',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default to web platform for tests
    Platform.OS = 'web';
  });

  describe('Renderização', () => {
    it('deve renderizar instruções para web', () => {
      Platform.OS = 'web';
      const { getByText } = render(<DraggableStopList {...defaultProps} />);

      expect(getByText('Use as setas para alterar a ordem')).toBeTruthy();
    });

    it('deve renderizar paradas pendentes', () => {
      const { getByText } = render(<DraggableStopList {...defaultProps} />);

      expect(getByText('Rua A, 100')).toBeTruthy();
      expect(getByText('Rua B, 200')).toBeTruthy();
      expect(getByText('Rua C, 300')).toBeTruthy();
    });

    it('deve exibir destinatário quando disponível', () => {
      const { getByText } = render(<DraggableStopList {...defaultProps} />);

      expect(getByText('Cliente A')).toBeTruthy();
      expect(getByText('Cliente B')).toBeTruthy();
    });

    it('deve exibir tag ENT para entregas', () => {
      const { getAllByText } = render(<DraggableStopList {...defaultProps} />);

      expect(getAllByText('ENT').length).toBe(2); // Duas entregas
    });

    it('deve exibir tag RET para retiradas', () => {
      const { getByText } = render(<DraggableStopList {...defaultProps} />);

      expect(getByText('RET')).toBeTruthy();
    });
  });

  describe('Paradas fixas (concluídas/puladas)', () => {
    it('deve renderizar paradas concluídas como fixas', () => {
      const { getByText } = render(
        <DraggableStopList {...defaultProps} paradas={mockParadasMistas} />
      );

      expect(getByText('Rua Concluida, 50')).toBeTruthy();
      expect(getByText('Concluída')).toBeTruthy();
    });

    it('deve renderizar paradas puladas como fixas', () => {
      const { getByText } = render(
        <DraggableStopList {...defaultProps} paradas={mockParadasMistas} />
      );

      expect(getByText('Rua Pulada, 60')).toBeTruthy();
      expect(getByText('Pulada')).toBeTruthy();
    });

    it('deve exibir label de paradas finalizadas', () => {
      const { getByText } = render(
        <DraggableStopList {...defaultProps} paradas={mockParadasMistas} />
      );

      expect(getByText('Paradas finalizadas (ordem fixa)')).toBeTruthy();
    });
  });

  describe('Status da rota e permissão de reordenação', () => {
    it('deve permitir reordenação em rotas pendentes', () => {
      const { getByText } = render(
        <DraggableStopList {...defaultProps} rotaStatus="pendente" />
      );

      // Verifica que as instruções de reordenação estão visíveis
      expect(getByText('Use as setas para alterar a ordem')).toBeTruthy();
    });

    it('deve permitir reordenação em rotas em andamento', () => {
      const { getByText } = render(
        <DraggableStopList {...defaultProps} rotaStatus="em_andamento" />
      );

      // Verifica que as instruções de reordenação estão visíveis
      expect(getByText('Use as setas para alterar a ordem')).toBeTruthy();
    });

    it('deve bloquear reordenação em rotas concluídas', () => {
      const { getByText } = render(
        <DraggableStopList {...defaultProps} rotaStatus="concluida" />
      );

      expect(
        getByText(
          'A ordem das paradas só pode ser alterada em rotas pendentes ou em andamento.'
        )
      ).toBeTruthy();
    });

    it('deve bloquear reordenação em rotas canceladas', () => {
      const { getByText } = render(
        <DraggableStopList {...defaultProps} rotaStatus="cancelada" />
      );

      expect(
        getByText(
          'A ordem das paradas só pode ser alterada em rotas pendentes ou em andamento.'
        )
      ).toBeTruthy();
    });
  });

  describe('Estado vazio', () => {
    it('deve exibir mensagem quando não há paradas', () => {
      const { getByText } = render(
        <DraggableStopList {...defaultProps} paradas={[]} />
      );

      expect(getByText('Nenhuma parada para reordenar.')).toBeTruthy();
    });
  });

  describe('Loading state', () => {
    it('deve exibir overlay de loading quando isLoading=true', () => {
      const { getByText } = render(
        <DraggableStopList {...defaultProps} isLoading={true} />
      );

      expect(getByText('Salvando nova ordem...')).toBeTruthy();
    });

    it('não deve exibir overlay quando isLoading=false', () => {
      const { queryByText } = render(
        <DraggableStopList {...defaultProps} isLoading={false} />
      );

      expect(queryByText('Salvando nova ordem...')).toBeNull();
    });
  });

  describe('Interações Web - Botões de mover', () => {
    it('deve mover parada para cima ao clicar na seta e notificar callback', async () => {
      Platform.OS = 'web';
      const onReorder = jest.fn().mockResolvedValue(undefined);
      const onWebChangesChange = jest.fn();
      const { getAllByTestId } = render(
        <DraggableStopList
          {...defaultProps}
          onReorder={onReorder}
          onWebChangesChange={onWebChangesChange}
        />
      );

      // Encontrar os botões de mover (chevron-up)
      const upButtons = getAllByTestId('icon-chevron-up');

      // Clicar no segundo botão (mover segunda parada para cima)
      fireEvent.press(upButtons[1]);

      // Callback deve ser chamado indicando que há mudanças
      await waitFor(() => {
        expect(onWebChangesChange).toHaveBeenCalledWith(true);
      });
    });

    it('deve mover parada para baixo ao clicar na seta e notificar callback', async () => {
      Platform.OS = 'web';
      const onReorder = jest.fn().mockResolvedValue(undefined);
      const onWebChangesChange = jest.fn();
      const { getAllByTestId } = render(
        <DraggableStopList
          {...defaultProps}
          onReorder={onReorder}
          onWebChangesChange={onWebChangesChange}
        />
      );

      // Encontrar os botões de mover (chevron-down)
      const downButtons = getAllByTestId('icon-chevron-down');

      // Clicar no primeiro botão
      fireEvent.press(downButtons[0]);

      // Callback deve ser chamado indicando que há mudanças
      await waitFor(() => {
        expect(onWebChangesChange).toHaveBeenCalledWith(true);
      });
    });

    it('deve salvar alterações via controlRef', async () => {
      Platform.OS = 'web';
      const onReorder = jest.fn().mockResolvedValue(undefined);
      const controlRef = { current: null as DraggableStopListControl | null };
      const { getAllByTestId } = render(
        <DraggableStopList
          {...defaultProps}
          onReorder={onReorder}
          controlRef={controlRef}
        />
      );

      // Mover uma parada
      const downButtons = getAllByTestId('icon-chevron-down');
      fireEvent.press(downButtons[0]);

      // Salvar via ref
      await act(async () => {
        await controlRef.current?.saveChanges();
      });

      expect(onReorder).toHaveBeenCalled();
    });

    it('deve cancelar alterações via controlRef', async () => {
      Platform.OS = 'web';
      const onReorder = jest.fn();
      const onWebChangesChange = jest.fn();
      const controlRef = { current: null as DraggableStopListControl | null };
      const { getAllByTestId } = render(
        <DraggableStopList
          {...defaultProps}
          onReorder={onReorder}
          onWebChangesChange={onWebChangesChange}
          controlRef={controlRef}
        />
      );

      // Mover uma parada
      const downButtons = getAllByTestId('icon-chevron-down');
      fireEvent.press(downButtons[0]);

      // Cancelar via ref
      act(() => {
        controlRef.current?.cancelChanges();
      });

      // Callback deve ser chamado indicando que não há mais mudanças
      await waitFor(() => {
        expect(onWebChangesChange).toHaveBeenLastCalledWith(false);
      });
    });

    it('deve expor hasChanges via controlRef', async () => {
      Platform.OS = 'web';
      const controlRef = { current: null as DraggableStopListControl | null };
      const { getAllByTestId } = render(
        <DraggableStopList
          {...defaultProps}
          controlRef={controlRef}
        />
      );

      // Inicialmente não deve haver mudanças
      expect(controlRef.current?.hasChanges).toBe(false);

      // Mover uma parada
      const downButtons = getAllByTestId('icon-chevron-down');
      fireEvent.press(downButtons[0]);

      // Agora deve haver mudanças
      await waitFor(() => {
        expect(controlRef.current?.hasChanges).toBe(true);
      });
    });
  });

  describe('Filtro de base points', () => {
    it('deve filtrar base points (is_checkpoint=false)', () => {
      const paradasComBasePoint: Parada[] = [
        ...mockParadasPendentes,
        {
          id: 'base-point',
          rota_id: 'rota-1',
          tipo: 'entrega',
          endereco: 'Base Point Não Visível',
          latitude: -7.0,
          longitude: -34.5,
          ordem: 0,
          status: 'pendente',
          is_checkpoint: false,
        },
      ];

      const { queryByText } = render(
        <DraggableStopList {...defaultProps} paradas={paradasComBasePoint} />
      );

      expect(queryByText('Base Point Não Visível')).toBeNull();
    });
  });

  describe('Ícones', () => {
    it('deve renderizar ícone de swap nas instruções', () => {
      const { getAllByTestId } = render(<DraggableStopList {...defaultProps} />);

      // Há múltiplos ícones swap-vertical (instruções e seção de paradas pendentes)
      expect(getAllByTestId('icon-swap-vertical').length).toBeGreaterThan(0);
    });

    it('deve renderizar ícone de cadeado para rotas não reordenáveis', () => {
      const { getByTestId } = render(
        <DraggableStopList {...defaultProps} rotaStatus="concluida" />
      );

      expect(getByTestId('icon-lock-closed-outline')).toBeTruthy();
    });
  });
});
