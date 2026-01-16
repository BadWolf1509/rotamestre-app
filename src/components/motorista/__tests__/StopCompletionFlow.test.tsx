/**
 * Tests for StopCompletionFlow.tsx
 * Componente unificado para conclusão de paradas
 */

import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';

import type { ParadaData } from '@/context/RouteStatusContext';

import { StopCompletionFlow } from '../StopCompletionFlow';


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
      black: '#000000',
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
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      '1': 4,
      '1.5': 6,
      '2': 8,
    },
    typography: {
      xl: 20,
      lg: 18,
      base: 16,
      sm: 14,
      fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20 },
      fontSans: 'System',
      fontSansMedium: 'System',
      fontSansSemiBold: 'System',
      fontSansBold: 'System-Bold',
    },
    borderRadius: { xs: 2, sm: 4, md: 8, lg: 12, xl: 16 },
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
    components: {
      dialog: {
        buttonGap: 12,
        buttonPaddingV: 12,
        buttonPaddingH: 16,
      },
    },
  };

  return {
    defaultTheme: theme,
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: (t: typeof theme) => Record<string, unknown>) => fn(theme),
    },
    type: { Theme: {} },
  };
});

// Mock responsive hook used by DesktopModal
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: false, isMobile: true, isTablet: false }),
}));

jest.mock('@/utils/color', () => ({
  withOpacity: (color: string, opacity: number) => `${color}${Math.round(opacity * 255).toString(16)}`,
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, testID }: { name: string; testID?: string }) => {
    const { Text } = require('react-native');
    return <Text testID={testID || `icon-${name}`}>{name}</Text>;
  },
}));

// Mock CameraUpload
const mockOnUploadSuccess = jest.fn();
jest.mock('@/components/CameraUpload', () => {
  const _React = require('react');
  const { View, TouchableOpacity, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ onUploadSuccess, onUploadError }: {
      onUploadSuccess: (url: string) => void;
      onUploadError: (error: string) => void;
    }) => {
      mockOnUploadSuccess.mockImplementation(onUploadSuccess);
      return (
        <View testID="camera-upload">
          <TouchableOpacity
            testID="simulate-upload-success"
            onPress={() => onUploadSuccess('https://example.com/photo.jpg')}
          >
            <Text>Upload Success</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="simulate-upload-error"
            onPress={() => onUploadError('Upload failed')}
          >
            <Text>Upload Error</Text>
          </TouchableOpacity>
        </View>
      );
    },
  };
});

// Mock Dialog (migrated from ConfirmDialog)
jest.mock('@/components/Dialog', () => ({
  Dialog: ({ visible, title, message, onConfirm, onCancel }: {
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    if (!visible) return null;
    return (
      <View testID="confirm-dialog">
        <Text>{title}</Text>
        <Text>{message}</Text>
        <TouchableOpacity testID="confirm-dialog-confirm" onPress={onConfirm}>
          <Text>Confirm</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="confirm-dialog-cancel" onPress={onCancel}>
          <Text>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

// Mock RouteStatusContext
const mockCompleteStop = jest.fn();
jest.mock('@/context/RouteStatusContext', () => ({
  useRouteStatus: () => ({
    route: { id: 'route-1' },
    completeStop: mockCompleteStop,
  }),
}));

// Mock useUser
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    userData: { unidade_id: 'unit-1' },
  }),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('StopCompletionFlow', () => {
  const mockParada: ParadaData = {
    id: 'parada-1',
    ordem: 1,
    endereco: 'Rua das Flores, 123, Centro, São Paulo - SP',
    tipo: 'entrega',
    status: 'em_andamento',
    latitude: -23.56,
    longitude: -46.64,
    destinatario: 'João Silva',
    telefone: '(11) 99999-8888',
  };

  const defaultProps = {
    parada: mockParada,
    visible: true,
    onClose: jest.fn(),
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCompleteStop.mockResolvedValue(undefined);
    Platform.OS = 'ios';
  });

  describe('Renderização', () => {
    it('não deve renderizar quando parada é null', () => {
      const { queryByText } = render(
        <StopCompletionFlow {...defaultProps} parada={null} />
      );

      expect(queryByText('Foto de Comprovante')).toBeNull();
    });

    it('não deve renderizar quando visible é false', () => {
      const { queryByText } = render(
        <StopCompletionFlow {...defaultProps} visible={false} />
      );

      expect(queryByText('Foto de Comprovante')).toBeNull();
    });

    it('deve renderizar step de foto por padrão', () => {
      const { getByText, getByTestId } = render(
        <StopCompletionFlow {...defaultProps} />
      );

      expect(getByText('Foto de Comprovante')).toBeTruthy();
      expect(getByText('Rua das Flores, 123, Centro, São Paulo - SP')).toBeTruthy();
      expect(getByText('João Silva')).toBeTruthy();
      expect(getByTestId('camera-upload')).toBeTruthy();
    });

    it('deve exibir botão de pular foto quando allowSkipPhoto é true', () => {
      const { getByText } = render(
        <StopCompletionFlow {...defaultProps} allowSkipPhoto={true} />
      );

      expect(getByText('Continuar sem foto')).toBeTruthy();
    });

    it('não deve exibir botão de pular foto quando allowSkipPhoto é false', () => {
      const { queryByText } = render(
        <StopCompletionFlow {...defaultProps} allowSkipPhoto={false} />
      );

      expect(queryByText('Continuar sem foto')).toBeNull();
    });
  });

  describe('Fluxo de Foto', () => {
    it('deve ir para step de confirmação após upload de foto bem-sucedido', async () => {
      const { getByTestId, getByText } = render(
        <StopCompletionFlow {...defaultProps} />
      );

      fireEvent.press(getByTestId('simulate-upload-success'));

      await waitFor(() => {
        expect(getByText('Confirmar Conclusão')).toBeTruthy();
        expect(getByText('Foto anexada')).toBeTruthy();
      });
    });

    it('deve mostrar dialog ao pular foto (web)', () => {
      Platform.OS = 'web' as typeof Platform.OS;

      const { getByText, getByTestId } = render(
        <StopCompletionFlow {...defaultProps} allowSkipPhoto={true} />
      );

      fireEvent.press(getByText('Continuar sem foto'));

      expect(getByTestId('confirm-dialog')).toBeTruthy();
    });

    it('deve mostrar Alert ao pular foto (mobile)', () => {
      Platform.OS = 'ios';

      const { getByText } = render(
        <StopCompletionFlow {...defaultProps} allowSkipPhoto={true} />
      );

      fireEvent.press(getByText('Continuar sem foto'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Pular foto?',
        'A foto serve como prova de entrega. Deseja continuar sem foto?',
        expect.any(Array)
      );
    });
  });

  describe('Step de Confirmação', () => {
    it('deve exibir informações da parada no step de confirmação', async () => {
      const { getByTestId, getByText } = render(
        <StopCompletionFlow {...defaultProps} />
      );

      fireEvent.press(getByTestId('simulate-upload-success'));

      await waitFor(() => {
        expect(getByText('Confirmar Conclusão')).toBeTruthy();
        expect(getByText('Rua das Flores, 123, Centro, São Paulo - SP')).toBeTruthy();
        expect(getByText('João Silva')).toBeTruthy();
        expect(getByText('Foto anexada')).toBeTruthy();
      });
    });

    it('deve indicar quando não há foto', async () => {
      Platform.OS = 'web' as typeof Platform.OS;

      const { getByText, getByTestId } = render(
        <StopCompletionFlow {...defaultProps} allowSkipPhoto={true} />
      );

      // Pular foto
      fireEvent.press(getByText('Continuar sem foto'));
      fireEvent.press(getByTestId('confirm-dialog-confirm'));

      await waitFor(() => {
        expect(getByText('Sem foto de comprovante')).toBeTruthy();
      });
    });

    it('deve mostrar pergunta de confirmação com tipo da parada', async () => {
      const { getByTestId, getByText } = render(
        <StopCompletionFlow {...defaultProps} />
      );

      fireEvent.press(getByTestId('simulate-upload-success'));

      await waitFor(() => {
        expect(getByText('Confirma a conclusão desta entrega?')).toBeTruthy();
      });
    });

    it('deve exibir botão Voltar no step de confirmação', async () => {
      const { getByTestId, getByText } = render(
        <StopCompletionFlow {...defaultProps} />
      );

      fireEvent.press(getByTestId('simulate-upload-success'));

      await waitFor(() => {
        expect(getByText('Voltar')).toBeTruthy();
      });
    });

    it('deve voltar para step de foto ao clicar em Voltar', async () => {
      const { getByTestId, getByText } = render(
        <StopCompletionFlow {...defaultProps} />
      );

      fireEvent.press(getByTestId('simulate-upload-success'));

      await waitFor(() => {
        expect(getByText('Confirmar Conclusão')).toBeTruthy();
      });

      fireEvent.press(getByText('Voltar'));

      await waitFor(() => {
        expect(getByText('Foto de Comprovante')).toBeTruthy();
      });
    });
  });

  describe('Conclusão da Parada', () => {
    it('deve chamar completeStop ao confirmar', async () => {
      const { getByTestId, getByText } = render(
        <StopCompletionFlow {...defaultProps} />
      );

      fireEvent.press(getByTestId('simulate-upload-success'));

      await waitFor(() => {
        expect(getByText('Concluir')).toBeTruthy();
      });

      fireEvent.press(getByText('Concluir'));

      await waitFor(() => {
        expect(mockCompleteStop).toHaveBeenCalledWith('parada-1', 'https://example.com/photo.jpg');
      });
    });

    it('deve chamar completeStop sem foto quando pulada', async () => {
      Platform.OS = 'web' as typeof Platform.OS;

      const { getByText, getByTestId } = render(
        <StopCompletionFlow {...defaultProps} allowSkipPhoto={true} />
      );

      // Pular foto
      fireEvent.press(getByText('Continuar sem foto'));
      fireEvent.press(getByTestId('confirm-dialog-confirm'));

      await waitFor(() => {
        expect(getByText('Concluir')).toBeTruthy();
      });

      fireEvent.press(getByText('Concluir'));

      await waitFor(() => {
        expect(mockCompleteStop).toHaveBeenCalledWith('parada-1', undefined);
      });
    });

    it('deve chamar onSuccess após conclusão bem-sucedida', async () => {
      Platform.OS = 'web' as typeof Platform.OS;
      const onSuccess = jest.fn();

      const { getByTestId, getByText } = render(
        <StopCompletionFlow {...defaultProps} onSuccess={onSuccess} />
      );

      fireEvent.press(getByTestId('simulate-upload-success'));

      await waitFor(() => {
        expect(getByText('Concluir')).toBeTruthy();
      });

      fireEvent.press(getByText('Concluir'));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('deve chamar onClose após conclusão bem-sucedida', async () => {
      Platform.OS = 'web' as typeof Platform.OS;
      const onClose = jest.fn();

      const { getByTestId, getByText } = render(
        <StopCompletionFlow {...defaultProps} onClose={onClose} />
      );

      fireEvent.press(getByTestId('simulate-upload-success'));

      await waitFor(() => {
        expect(getByText('Concluir')).toBeTruthy();
      });

      fireEvent.press(getByText('Concluir'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('deve exibir erro quando conclusão falha', async () => {
      mockCompleteStop.mockRejectedValueOnce(new Error('Falha ao completar'));

      const { getByTestId, getByText } = render(
        <StopCompletionFlow {...defaultProps} />
      );

      fireEvent.press(getByTestId('simulate-upload-success'));

      await waitFor(() => {
        expect(getByText('Concluir')).toBeTruthy();
      });

      fireEvent.press(getByText('Concluir'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Falha ao completar');
      });
    });
  });

  describe('Fechar Modal', () => {
    it('deve chamar onClose ao clicar no botão fechar', () => {
      const onClose = jest.fn();
      const { getByTestId } = render(
        <StopCompletionFlow {...defaultProps} onClose={onClose} />
      );

      fireEvent.press(getByTestId('icon-close'));

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Reset de Estado', () => {
    it('deve resetar estado quando modal é fechado', async () => {
      const { rerender, getByTestId, getByText, queryByText } = render(
        <StopCompletionFlow {...defaultProps} visible={true} />
      );

      // Ir para step de confirmação
      fireEvent.press(getByTestId('simulate-upload-success'));

      await waitFor(() => {
        expect(getByText('Confirmar Conclusão')).toBeTruthy();
      });

      // Fechar e reabrir
      rerender(<StopCompletionFlow {...defaultProps} visible={false} />);
      rerender(<StopCompletionFlow {...defaultProps} visible={true} />);

      // Deve estar no step de foto novamente
      await waitFor(() => {
        expect(getByText('Foto de Comprovante')).toBeTruthy();
        expect(queryByText('Confirmar Conclusão')).toBeNull();
      });
    });
  });
});
