/**
 * Tests for PhotoModal.tsx
 * Modal unificado para visualização de fotos
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { PhotoModal } from '../PhotoModal';

// Mock DesktopModal
jest.mock('@/components/desktop/DesktopModal', () => ({
  DesktopModal: ({ visible, children, title, onClose }: any) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    if (!visible) return null;
    return (
      <View testID="desktop-modal">
        <Text>{title}</Text>
        <TouchableOpacity testID="desktop-close" onPress={onClose}>
          <Text>Close</Text>
        </TouchableOpacity>
        {children}
      </View>
    );
  },
}));

// Mock styles
jest.mock('../styles', () => ({
  styles: {
    modalOverlay: {},
    modalCloseArea: {},
    modalContent: {},
    modalCloseButton: {},
    modalCloseButtonText: {},
    fotoGrande: {},
    desktopModalImage: {},
  },
}));

describe('PhotoModal', () => {
  const mockOnClose = jest.fn();
  const testPhotoUrl = 'https://example.com/photo.jpg';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Sem Foto', () => {
    it('deve retornar null quando photoUrl é null', () => {
      const { queryByTestId, queryByText } = render(
        <PhotoModal visible={true} photoUrl={null} onClose={mockOnClose} />
      );

      expect(queryByTestId('desktop-modal')).toBeNull();
      expect(queryByText('Foto da Entrega')).toBeNull();
    });
  });

  describe('Modo Mobile', () => {
    it('deve renderizar Modal nativo quando isDesktop=false', () => {
      const { getByText } = render(
        <PhotoModal
          visible={true}
          photoUrl={testPhotoUrl}
          onClose={mockOnClose}
          isDesktop={false}
        />
      );

      expect(getByText('x')).toBeTruthy();
    });

    it('deve chamar onClose ao clicar no botão de fechar', () => {
      const { getByText } = render(
        <PhotoModal
          visible={true}
          photoUrl={testPhotoUrl}
          onClose={mockOnClose}
          isDesktop={false}
        />
      );

      fireEvent.press(getByText('x'));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('não deve renderizar quando visible=false', () => {
      const { queryByText } = render(
        <PhotoModal
          visible={false}
          photoUrl={testPhotoUrl}
          onClose={mockOnClose}
          isDesktop={false}
        />
      );

      expect(queryByText('x')).toBeNull();
    });
  });

  describe('Modo Desktop', () => {
    it('deve renderizar DesktopModal quando isDesktop=true', () => {
      const { getByTestId } = render(
        <PhotoModal
          visible={true}
          photoUrl={testPhotoUrl}
          onClose={mockOnClose}
          isDesktop={true}
        />
      );

      expect(getByTestId('desktop-modal')).toBeTruthy();
    });

    it('deve usar título padrão "Foto da Entrega"', () => {
      const { getByText } = render(
        <PhotoModal
          visible={true}
          photoUrl={testPhotoUrl}
          onClose={mockOnClose}
          isDesktop={true}
        />
      );

      expect(getByText('Foto da Entrega')).toBeTruthy();
    });

    it('deve usar título customizado', () => {
      const { getByText } = render(
        <PhotoModal
          visible={true}
          photoUrl={testPhotoUrl}
          onClose={mockOnClose}
          isDesktop={true}
          title="Comprovante"
        />
      );

      expect(getByText('Comprovante')).toBeTruthy();
    });

    it('não deve renderizar quando visible=false', () => {
      const { queryByTestId } = render(
        <PhotoModal
          visible={false}
          photoUrl={testPhotoUrl}
          onClose={mockOnClose}
          isDesktop={true}
        />
      );

      expect(queryByTestId('desktop-modal')).toBeNull();
    });
  });
});
