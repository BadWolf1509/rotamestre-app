/**
 * Tests for ChangeDriverModal.tsx
 * Modal para trocar motorista de uma rota
 */

import { act, render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import {
  ChangeDriverModal,
  ChangeDriverModalProps,
} from '../ChangeDriverModal';

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
// Mock DesktopModal with declarative button API
jest.mock('@/components/desktop/DesktopModal', () => ({
  DesktopModal: ({
    visible,
    onClose,
    title,
    children,
    primaryButton,
    secondaryButton,
  }: {
    visible: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    primaryButton?: {
      text: string;
      onPress: () => void;
      loading?: boolean;
      disabled?: boolean;
    };
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
    {
      id: 'motorista-1',
      nome: 'João Silva',
      email: 'joao@email.com',
      ativo: true,
    },
    {
      id: 'motorista-2',
      nome: 'Maria Santos',
      email: 'maria@email.com',
      ativo: true,
    },
    {
      id: 'motorista-3',
      nome: 'Carlos Ferreira',
      email: 'carlos@email.com',
      ativo: true,
    },
  ];

  const comLogin = (m: (typeof mockMotoristas)[number]) => ({
    ...m,
    ultimo_login: '2026-10-01T10:00:00Z',
  });
  const mockShowConfirm = (
    global as unknown as { mockUseAlert: { showConfirm: jest.Mock } }
  ).mockUseAlert.showConfirm;

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
      const { getByTestId, getByText } = render(
        <ChangeDriverModal {...defaultProps} />,
      );

      expect(getByTestId('desktop-modal')).toBeTruthy();
      expect(getByText('Trocar Motorista')).toBeTruthy();

      await waitFor(() => {
        // Wait for motoristas to load
      });
    });

    it('não deve renderizar quando visible=false', () => {
      const { queryByTestId } = render(
        <ChangeDriverModal {...defaultProps} visible={false} />,
      );

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

      const { getByText } = render(
        <ChangeDriverModal {...propsWithoutMotorista} />,
      );

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
      const { getByText } = render(<ChangeDriverModal {...defaultProps} />);

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
        expect(
          getByText('Nenhum motorista cadastrado na unidade'),
        ).toBeTruthy();
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
      const { getByText, getByTestId } = render(
        <ChangeDriverModal {...defaultProps} />,
      );

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

      expect(defaultProps.onConfirm).toHaveBeenCalledWith(
        'motorista-2',
        'Maria Santos',
      );
    });
  });

  describe('Confirmação que falha (G10)', () => {
    async function selecionarEConfirmar(
      utils: ReturnType<typeof render>,
    ): Promise<void> {
      await waitFor(() => {
        expect(utils.getByText('Maria Santos')).toBeTruthy();
      });
      fireEvent.press(utils.getByText('Maria Santos'));
      await act(async () => {
        fireEvent.press(utils.getByText('Confirmar'));
      });
    }

    it('onConfirm que falha devolve os botões, sem ficar carregando', async () => {
      const onConfirm = jest.fn().mockRejectedValue(new Error('rede'));
      const utils = render(
        <ChangeDriverModal {...defaultProps} onConfirm={onConfirm} />,
      );

      await selecionarEConfirmar(utils);

      expect(onConfirm).toHaveBeenCalled();
      expect(
        utils.getByTestId('primary-button').props.accessibilityState?.disabled,
      ).toBeFalsy();
      expect(
        utils.getByTestId('secondary-button').props.accessibilityState
          ?.disabled,
      ).toBeFalsy();
    });

    it('reabrir depois de uma troca não começa carregando', async () => {
      const onConfirm = jest.fn().mockResolvedValue(undefined);
      const utils = render(
        <ChangeDriverModal {...defaultProps} onConfirm={onConfirm} />,
      );
      await selecionarEConfirmar(utils);

      utils.rerender(
        <ChangeDriverModal
          {...defaultProps}
          onConfirm={onConfirm}
          visible={false}
        />,
      );
      utils.rerender(
        <ChangeDriverModal {...defaultProps} onConfirm={onConfirm} visible />,
      );

      await waitFor(() => {
        expect(utils.getByText('Maria Santos')).toBeTruthy();
      });
      expect(
        utils.getByTestId('secondary-button').props.accessibilityState
          ?.disabled,
      ).toBeFalsy();
    });
  });

  // Outra ação da rota (cancelar, remover parada…) em voo: a trava do handler
  // recusaria a troca e a página fecharia o modal sem trocar nada. O botão
  // fica carregando/desabilitado até a outra ação terminar.
  describe('Outra ação da rota em andamento (ocupado)', () => {
    it('desabilita Confirmar e não chama onConfirm', async () => {
      const onConfirm = jest.fn();
      const utils = render(
        <ChangeDriverModal {...defaultProps} onConfirm={onConfirm} ocupado />,
      );
      await waitFor(() => {
        expect(utils.getByText('Maria Santos')).toBeTruthy();
      });
      fireEvent.press(utils.getByText('Maria Santos'));
      await act(async () => {
        fireEvent.press(utils.getByText('Confirmar'));
      });

      expect(onConfirm).not.toHaveBeenCalled();
      expect(
        utils.getByTestId('primary-button').props.accessibilityState?.disabled,
      ).toBe(true);
    });

    it('volta a confirmar quando a outra ação termina', async () => {
      const onConfirm = jest.fn().mockResolvedValue(undefined);
      const utils = render(
        <ChangeDriverModal {...defaultProps} onConfirm={onConfirm} ocupado />,
      );
      await waitFor(() => {
        expect(utils.getByText('Maria Santos')).toBeTruthy();
      });
      fireEvent.press(utils.getByText('Maria Santos'));

      utils.rerender(
        <ChangeDriverModal
          {...defaultProps}
          onConfirm={onConfirm}
          ocupado={false}
        />,
      );
      await act(async () => {
        fireEvent.press(utils.getByText('Confirmar'));
      });

      expect(onConfirm).toHaveBeenCalledWith('motorista-2', 'Maria Santos');
    });
  });

  describe('Motorista que nunca entrou no app', () => {
    beforeEach(() => {
      // clearAllMocks mantém implementações: o teste de cancelar não pode vazar.
      mockShowConfirm.mockResolvedValue(true);
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        returns: jest.fn().mockResolvedValue({
          data: [
            {
              usuario_id: 'motorista-1',
              usuarios: comLogin(mockMotoristas[0]),
            },
            {
              usuario_id: 'motorista-2',
              usuarios: { ...mockMotoristas[1], ultimo_login: null },
            },
            {
              usuario_id: 'motorista-3',
              usuarios: comLogin(mockMotoristas[2]),
            },
          ],
          error: null,
        }),
      });
    });

    it('mostra o selo só para quem nunca entrou', async () => {
      const { getAllByText, getByText } = render(
        <ChangeDriverModal {...defaultProps} />,
      );

      await waitFor(() => expect(getByText('Maria Santos')).toBeTruthy());

      expect(getAllByText('Nunca entrou no app')).toHaveLength(1);
    });

    it('pede confirmação e só chama onConfirm depois de aceitar', async () => {
      const { getByText } = render(<ChangeDriverModal {...defaultProps} />);
      await waitFor(() => expect(getByText('Maria Santos')).toBeTruthy());

      fireEvent.press(getByText('Maria Santos'));
      fireEvent.press(getByText('Confirmar'));

      expect(mockShowConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Motorista nunca entrou no app',
          message: expect.stringContaining(
            'Maria Santos ainda não entrou no RotaMestre',
          ),
          type: 'warning',
          confirmText: 'Trocar mesmo assim',
        }),
      );
      await waitFor(() =>
        expect(defaultProps.onConfirm).toHaveBeenCalledWith(
          'motorista-2',
          'Maria Santos',
        ),
      );
    });

    it('não chama onConfirm quando o gestor cancela', async () => {
      mockShowConfirm.mockResolvedValue(false);
      const { getByText } = render(<ChangeDriverModal {...defaultProps} />);
      await waitFor(() => expect(getByText('Maria Santos')).toBeTruthy());

      fireEvent.press(getByText('Maria Santos'));
      fireEvent.press(getByText('Confirmar'));

      await waitFor(() => expect(mockShowConfirm).toHaveBeenCalled());
      // deixa a promessa resolvida (false) ser processada antes de afirmar.
      await act(async () => {});
      expect(defaultProps.onConfirm).not.toHaveBeenCalled();
    });

    it('confirma direto quando o motorista já entrou', async () => {
      const { getByText } = render(<ChangeDriverModal {...defaultProps} />);
      await waitFor(() => expect(getByText('Carlos Ferreira')).toBeTruthy());

      fireEvent.press(getByText('Carlos Ferreira'));
      fireEvent.press(getByText('Confirmar'));

      expect(mockShowConfirm).not.toHaveBeenCalled();
      expect(defaultProps.onConfirm).toHaveBeenCalledWith(
        'motorista-3',
        'Carlos Ferreira',
      );
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

      expect(mockFrom).not.toHaveBeenCalled();
    });

    // Até 24/10/2026 a falha virava "Nenhum motorista cadastrado na unidade":
    // o gestor lia uma loja sem motoristas, sem como tentar de novo (G10).
    it('falha ao carregar mostra o erro e "Tentar de novo", que recarrega', async () => {
      const returns = jest
        .fn()
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Database error' },
        })
        .mockResolvedValueOnce({
          data: mockMotoristas.map((m) => ({ usuario_id: m.id, usuarios: m })),
          error: null,
        });
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        returns,
      });

      const { getByText, queryByText } = render(
        <ChangeDriverModal {...defaultProps} />,
      );

      await waitFor(() => {
        expect(
          getByText('Não foi possível carregar os motoristas.'),
        ).toBeTruthy();
      });
      expect(queryByText('Nenhum motorista cadastrado na unidade')).toBeNull();
      expect(queryByText('Carregando motoristas...')).toBeNull();
      expect(console.error).toHaveBeenCalled();

      fireEvent.press(getByText('Tentar de novo'));

      await waitFor(() => {
        expect(getByText('Maria Santos')).toBeTruthy();
      });
      expect(
        queryByText('Não foi possível carregar os motoristas.'),
      ).toBeNull();
    });

    it('rota sem loja não fica em "Carregando motoristas..." para sempre', async () => {
      const { getByText, queryByText } = render(
        <ChangeDriverModal {...defaultProps} unidadeId="" />,
      );

      await waitFor(() => {
        expect(queryByText('Carregando motoristas...')).toBeNull();
      });
      // Mensagem própria e sem "Tentar de novo": repetir não muda nada.
      expect(
        getByText('Esta rota não tem loja: não há motoristas para listar.'),
      ).toBeTruthy();
      expect(queryByText('Tentar de novo')).toBeNull();
    });

    it('deve filtrar motoristas inativos', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        returns: jest.fn().mockResolvedValue({
          data: [
            {
              usuario_id: 'motorista-1',
              usuarios: {
                id: 'motorista-1',
                nome: 'Motorista Inativo',
                email: 'inativo@email.com',
                ativo: false,
              },
            },
            { usuario_id: 'motorista-2', usuarios: mockMotoristas[1] }, // ativo
          ],
          error: null,
        }),
      });

      const { getByText, queryByText } = render(
        <ChangeDriverModal
          {...defaultProps}
          currentMotoristaId=""
          currentMotoristaNome=""
        />,
      );

      await waitFor(() => {
        expect(getByText('Maria Santos')).toBeTruthy();
      });

      // Motorista inativo não deve aparecer na lista
      expect(queryByText('Motorista Inativo')).toBeNull();
    });

    it('deve recarregar motoristas quando modal abre novamente', async () => {
      const { rerender } = render(
        <ChangeDriverModal {...defaultProps} visible={false} />,
      );

      expect(mockFrom).not.toHaveBeenCalled();

      rerender(<ChangeDriverModal {...defaultProps} visible={true} />);

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalled();
      });
    });
  });
});
