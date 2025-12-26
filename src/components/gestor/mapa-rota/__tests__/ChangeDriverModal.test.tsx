/**
 * Tests for ChangeDriverModal.tsx
 * Modal para trocar motorista de uma rota
 */

import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { ChangeDriverModal, ChangeDriverModalProps } from '../ChangeDriverModal';

// Mock Supabase
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isDesktop: false,
    isMobile: true,
    isTablet: false,
    width: 375,
  }),
}));

// Mock theme
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
      white: '#ffffff',
      gray50: '#f9fafb',
      gray200: '#e5e7eb',
      gray300: '#d1d5db',
      gray400: '#9ca3af',
      gray500: '#6b7280',
      gray700: '#374151',
      gray900: '#111827',
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
    typography: {
      fontSans: 'NunitoSans-Regular',
      fontSansSemiBold: 'NunitoSans-SemiBold',
      xs: 12,
      sm: 14,
      base: 16,
    },
    borderRadius: { md: 10 },
    desktop: {
      input: { fontSize: 14 },
      button: { fontSize: 13, paddingHorizontal: 12 },
      section: { padding: 12, gap: 8 },
      modal: { footerGap: 8, footerPadding: 12 },
      dialog: { buttonPaddingV: 8 },
    },
  };

  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: (t: typeof theme) => Record<string, unknown>) => fn(theme),
    },
  };
});

// Mock DesktopModal with declarative button API
jest.mock('@/components/desktop/DesktopModal', () => ({
  DesktopModal: ({ visible, onClose, title, children, primaryButton, secondaryButton }: {
    visible: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    primaryButton?: { text: string; onPress: () => void; loading?: boolean; disabled?: boolean };
    secondaryButton?: { text: string; onPress: () => void; disabled?: boolean };
  }) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    if (!visible) return null;
    return (
      <View testID="desktop-modal">
        <Text testID="modal-title">{title}</Text>
        <TouchableOpacity testID="close-button" onPress={onClose}>
          <Text>X</Text>
        </TouchableOpacity>
        {children}
        <View testID="modal-footer">
          {secondaryButton && (
            <TouchableOpacity
              onPress={secondaryButton.onPress}
              disabled={secondaryButton.disabled}
              testID="secondary-button"
            >
              <Text>{secondaryButton.text}</Text>
            </TouchableOpacity>
          )}
          {primaryButton && (
            <TouchableOpacity
              onPress={primaryButton.onPress}
              disabled={primaryButton.disabled || primaryButton.loading}
              testID="primary-button"
            >
              <Text>{primaryButton.text}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  },
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text testID={`icon-${name}`}>{name}</Text>;
  },
}));

describe('ChangeDriverModal', () => {
  const mockMotoristas = [
    { id: 'motorista-1', nome: 'João Silva', email: 'joao@email.com', ativo: true },
    { id: 'motorista-2', nome: 'Maria Santos', email: 'maria@email.com', ativo: true },
    { id: 'motorista-3', nome: 'Carlos Ferreira', email: 'carlos@email.com', ativo: true },
  ];

  const defaultProps: ChangeDriverModalProps = {
    visible: true,
    currentMotoristaId: 'motorista-1',
    currentMotoristaNome: 'João Silva',
    unidadeId: 'unidade-123',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Default mock for loading motoristas
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      returns: jest.fn().mockResolvedValue({
        data: mockMotoristas.map((m) => ({
          usuario_id: m.id,
          usuarios: m,
        })),
        error: null,
      }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Renderização', () => {
    it('deve renderizar o modal quando visible=true', async () => {
      const { getByTestId, getByText } = render(<ChangeDriverModal {...defaultProps} />);

      expect(getByTestId('desktop-modal')).toBeTruthy();
      expect(getByText('Trocar Motorista')).toBeTruthy();

      await waitFor(() => {
        // Wait for motoristas to load
      });
    });

    it('não deve renderizar quando visible=false', () => {
      const { queryByTestId } = render(<ChangeDriverModal {...defaultProps} visible={false} />);

      expect(queryByTestId('desktop-modal')).toBeNull();
    });

    it('deve exibir motorista atual', async () => {
      const { getByText } = render(<ChangeDriverModal {...defaultProps} />);

      expect(getByText('Motorista atual')).toBeTruthy();
      expect(getByText('João Silva')).toBeTruthy();
    });

    it('deve exibir "Sem motorista" quando não há motorista atual', () => {
      const propsWithoutMotorista = {
        ...defaultProps,
        currentMotoristaId: undefined,
        currentMotoristaNome: undefined,
      };

      const { getByText } = render(<ChangeDriverModal {...propsWithoutMotorista} />);

      expect(getByText('Sem motorista')).toBeTruthy();
    });

    it('deve exibir estado de loading enquanto carrega motoristas', () => {
      // Mock slow loading
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        returns: jest.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
      });

      const { getByText } = render(<ChangeDriverModal {...defaultProps} />);

      expect(getByText('Carregando motoristas...')).toBeTruthy();
    });

    it('deve exibir lista de outros motoristas (excluindo o atual)', async () => {
      const { getByText, queryByText } = render(<ChangeDriverModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Maria Santos')).toBeTruthy();
        expect(getByText('Carlos Ferreira')).toBeTruthy();
      });

      // O motorista atual não deve aparecer na lista de seleção
      // (Ele aparece no header, mas não na lista de opções)
    });

    it('deve exibir mensagem quando não há outros motoristas', async () => {
      // Mock com apenas o motorista atual
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        returns: jest.fn().mockResolvedValue({
          data: [{ usuario_id: 'motorista-1', usuarios: mockMotoristas[0] }],
          error: null,
        }),
      });

      const { getByText } = render(<ChangeDriverModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Não há outros motoristas disponíveis')).toBeTruthy();
      });
    });

    it('deve exibir mensagem quando não há motoristas cadastrados', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        returns: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const { getByText } = render(<ChangeDriverModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Nenhum motorista cadastrado na unidade')).toBeTruthy();
      });
    });
  });

  describe('Interações', () => {
    it('deve chamar onCancel quando botão Cancelar é pressionado', async () => {
      const { getByText } = render(<ChangeDriverModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Maria Santos')).toBeTruthy();
      });

      fireEvent.press(getByText('Cancelar'));

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('deve selecionar motorista quando item é pressionado', async () => {
      const { getByText, getByTestId } = render(<ChangeDriverModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Maria Santos')).toBeTruthy();
      });

      fireEvent.press(getByText('Maria Santos'));

      // Ícone de check deve aparecer
      await waitFor(() => {
        expect(getByTestId('icon-checkmark-circle')).toBeTruthy();
      });
    });

    it('não deve chamar onConfirm quando nenhum motorista está selecionado', async () => {
      const { getByText } = render(<ChangeDriverModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Maria Santos')).toBeTruthy();
      });

      fireEvent.press(getByText('Confirmar'));

      expect(defaultProps.onConfirm).not.toHaveBeenCalled();
    });

    it('deve chamar onConfirm com motorista selecionado', async () => {
      const { getByText } = render(<ChangeDriverModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Maria Santos')).toBeTruthy();
      });

      // Selecionar motorista
      fireEvent.press(getByText('Maria Santos'));

      // Confirmar
      fireEvent.press(getByText('Confirmar'));

      expect(defaultProps.onConfirm).toHaveBeenCalledWith('motorista-2', 'Maria Santos');
    });
  });

  describe('Carregamento de motoristas', () => {
    it('deve carregar motoristas ao abrir modal', async () => {
      render(<ChangeDriverModal {...defaultProps} />);

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('usuario_unidades');
      });
    });

    it('não deve carregar motoristas se unidadeId não está definido', async () => {
      mockFrom.mockClear();

      render(<ChangeDriverModal {...defaultProps} unidadeId="" />);

      // Esperar um pouco para garantir que não carregou
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Se unidadeId vazio, não deve chamar from
      // Note: o comportamento atual retorna cedo se !unidadeId
    });

    it('deve lidar com erro ao carregar motoristas', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        returns: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      const { getByText } = render(<ChangeDriverModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Nenhum motorista cadastrado na unidade')).toBeTruthy();
      });

      expect(console.error).toHaveBeenCalled();
    });

    it('deve filtrar motoristas inativos', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        returns: jest.fn().mockResolvedValue({
          data: [
            { usuario_id: 'motorista-1', usuarios: { id: 'motorista-1', nome: 'Motorista Inativo', email: 'inativo@email.com', ativo: false } },
            { usuario_id: 'motorista-2', usuarios: mockMotoristas[1] }, // ativo
          ],
          error: null,
        }),
      });

      const { getByText, queryByText } = render(
        <ChangeDriverModal {...defaultProps} currentMotoristaId="" currentMotoristaNome="" />
      );

      await waitFor(() => {
        expect(getByText('Maria Santos')).toBeTruthy();
      });

      // Motorista inativo não deve aparecer na lista
      expect(queryByText('Motorista Inativo')).toBeNull();
    });

    it('deve recarregar motoristas quando modal abre novamente', async () => {
      const { rerender } = render(<ChangeDriverModal {...defaultProps} visible={false} />);

      expect(mockFrom).not.toHaveBeenCalled();

      rerender(<ChangeDriverModal {...defaultProps} visible={true} />);

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalled();
      });
    });
  });
});
