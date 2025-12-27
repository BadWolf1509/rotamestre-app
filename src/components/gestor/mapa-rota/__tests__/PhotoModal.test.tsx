/**
 * Tests for PhotoModal.tsx
 * Modal unificado para visualização de fotos usando DesktopModal
 */

import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { PhotoModal } from '../PhotoModal';

// Mock useResponsive
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isDesktop: true,
    isMobile: false,
    isTablet: false,
  }),
}));

// Mock useUnistyles
jest.mock('@/utils/styles', () => ({
  useUnistyles: () => ({
    theme: {
      colors: {
        primary: '#FF6B00',
        primaryBg: '#FFF5EB',
        gray400: '#9CA3AF',
        gray500: '#6B7280',
        gray100: '#F3F4F6',
      },
      spacing: { xs: 4, sm: 8, md: 16, xl: 32 },
      typography: { sm: 14, fontSans: 'System', fontSansSemiBold: 'System-SemiBold' },
      borderRadius: { md: 8 },
    },
  }),
  StyleSheet: {
    create: (fn: any) => fn({
      colors: { primary: '#FF6B00', primaryBg: '#FFF5EB', gray100: '#F3F4F6', gray500: '#6B7280' },
      spacing: { xs: 4, sm: 8, md: 16, xl: 32 },
      typography: { sm: 14, fontSans: 'System', fontSansSemiBold: 'System-SemiBold' },
      borderRadius: { md: 8 },
    }),
  },
}));

// Mock DesktopModal
jest.mock('@/components/desktop/DesktopModal', () => ({
  DesktopModal: ({ visible, children, title, onClose }: any) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    if (!visible) return null;
    return (
      <View testID="desktop-modal">
        <Text testID="modal-title">{title}</Text>
        <TouchableOpacity testID="close-button" onPress={onClose}>
          <Text>Close</Text>
        </TouchableOpacity>
        {children}
      </View>
    );
  },
}));

describe('PhotoModal', () => {
  const mockOnClose = jest.fn();
  const testPhotoUrl = 'https://example.com/photo.jpg';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização básica', () => {
    it('deve retornar null quando photoUrl é null', () => {
      const { queryByTestId } = render(
        <PhotoModal visible={true} photoUrl={null} onClose={mockOnClose} />
      );

      expect(queryByTestId('desktop-modal')).toBeNull();
    });

    it('deve renderizar DesktopModal quando visible=true e photoUrl existe', () => {
      const { getByTestId } = render(
        <PhotoModal
          visible={true}
          photoUrl={testPhotoUrl}
          onClose={mockOnClose}
        />
      );

      expect(getByTestId('desktop-modal')).toBeTruthy();
    });

    it('não deve renderizar quando visible=false', () => {
      const { queryByTestId } = render(
        <PhotoModal
          visible={false}
          photoUrl={testPhotoUrl}
          onClose={mockOnClose}
        />
      );

      expect(queryByTestId('desktop-modal')).toBeNull();
    });
  });

  describe('Título', () => {
    it('deve usar título padrão "Foto da Entrega"', () => {
      const { getByTestId } = render(
        <PhotoModal
          visible={true}
          photoUrl={testPhotoUrl}
          onClose={mockOnClose}
        />
      );

      expect(getByTestId('modal-title').props.children).toBe('Foto da Entrega');
    });

    it('deve usar título customizado quando fornecido', () => {
      const { getByTestId } = render(
        <PhotoModal
          visible={true}
          photoUrl={testPhotoUrl}
          onClose={mockOnClose}
          title="Comprovante de Entrega"
        />
      );

      expect(getByTestId('modal-title').props.children).toBe('Comprovante de Entrega');
    });
  });

  describe('Interações', () => {
    it('deve chamar onClose ao fechar o modal', () => {
      const { getByTestId } = render(
        <PhotoModal
          visible={true}
          photoUrl={testPhotoUrl}
          onClose={mockOnClose}
        />
      );

      fireEvent.press(getByTestId('close-button'));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Estados de carregamento', () => {
    it('deve mostrar loading indicator inicialmente', () => {
      const { getByText } = render(
        <PhotoModal
          visible={true}
          photoUrl={testPhotoUrl}
          onClose={mockOnClose}
        />
      );

      expect(getByText('Carregando foto...')).toBeTruthy();
    });

    it('deve renderizar imagem com a URL fornecida', () => {
      const { getByLabelText } = render(
        <PhotoModal
          visible={true}
          photoUrl={testPhotoUrl}
          onClose={mockOnClose}
        />
      );

      const image = getByLabelText('Foto da entrega');
      expect(image.props.source.uri).toBe(testPhotoUrl);
    });

    it('deve esconder loading após imagem carregar', async () => {
      const { getByLabelText, queryByText } = render(
        <PhotoModal
          visible={true}
          photoUrl={testPhotoUrl}
          onClose={mockOnClose}
        />
      );

      const image = getByLabelText('Foto da entrega');
      fireEvent(image, 'load');

      await waitFor(() => {
        expect(queryByText('Carregando foto...')).toBeNull();
      });
    });

    it('deve mostrar erro quando imagem falha ao carregar', async () => {
      const { getByLabelText, getByText } = render(
        <PhotoModal
          visible={true}
          photoUrl={testPhotoUrl}
          onClose={mockOnClose}
        />
      );

      const image = getByLabelText('Foto da entrega');
      fireEvent(image, 'error');

      await waitFor(() => {
        expect(getByText('Não foi possível carregar a foto')).toBeTruthy();
      });
    });
  });

  describe('Botão Tentar novamente', () => {
    it('deve mostrar botão "Tentar novamente" quando há erro', async () => {
      const { getByLabelText, getByText } = render(
        <PhotoModal
          visible={true}
          photoUrl={testPhotoUrl}
          onClose={mockOnClose}
        />
      );

      const image = getByLabelText('Foto da entrega');
      fireEvent(image, 'error');

      await waitFor(() => {
        expect(getByText('Tentar novamente')).toBeTruthy();
      });
    });

    it('deve tentar recarregar imagem ao clicar em "Tentar novamente"', async () => {
      const { getByLabelText, getByText, queryByText } = render(
        <PhotoModal
          visible={true}
          photoUrl={testPhotoUrl}
          onClose={mockOnClose}
        />
      );

      // Simular erro
      const image = getByLabelText('Foto da entrega');
      fireEvent(image, 'error');

      // Aguardar botão aparecer
      await waitFor(() => {
        expect(getByText('Tentar novamente')).toBeTruthy();
      });

      // Clicar no botão
      fireEvent.press(getByText('Tentar novamente'));

      // Deve voltar ao estado de loading
      await waitFor(() => {
        expect(getByText('Carregando foto...')).toBeTruthy();
        expect(queryByText('Tentar novamente')).toBeNull();
      });
    });

    it('deve adicionar parâmetro retry à URL ao tentar novamente', async () => {
      const { getByLabelText, getByText, rerender } = render(
        <PhotoModal
          visible={true}
          photoUrl={testPhotoUrl}
          onClose={mockOnClose}
        />
      );

      // Simular erro
      let image = getByLabelText('Foto da entrega');
      fireEvent(image, 'error');

      // Clicar no botão retry
      await waitFor(() => {
        expect(getByText('Tentar novamente')).toBeTruthy();
      });
      fireEvent.press(getByText('Tentar novamente'));

      // A imagem deve ter URL com parâmetro retry
      await waitFor(() => {
        image = getByLabelText('Foto da entrega');
        expect(image.props.source.uri).toBe(`${testPhotoUrl}?retry=1`);
      });
    });
  });
});
