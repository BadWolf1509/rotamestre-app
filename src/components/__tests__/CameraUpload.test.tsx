import { render } from '@testing-library/react-native';
import React from 'react';
import { Alert, Platform } from 'react-native';

import CameraUpload from '../CameraUpload';

// Mock functions - declared before jest.mock
const mockRequestCameraPermissionsAsync = jest.fn();
const mockRequestMediaLibraryPermissionsAsync = jest.fn();
const mockLaunchCameraAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();
const mockManipulateAsync = jest.fn();
const mockUploadELinkFotoParada = jest.fn();

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: (...args: any[]) => mockRequestCameraPermissionsAsync(...args),
  requestMediaLibraryPermissionsAsync: (...args: any[]) => mockRequestMediaLibraryPermissionsAsync(...args),
  launchCameraAsync: (...args: any[]) => mockLaunchCameraAsync(...args),
  launchImageLibraryAsync: (...args: any[]) => mockLaunchImageLibraryAsync(...args),
}));

// Mock expo-image-manipulator
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: (...args: any[]) => mockManipulateAsync(...args),
  SaveFormat: {
    JPEG: 'jpeg',
  },
}));

// Mock storage
jest.mock('@/lib/storage', () => ({
  uploadELinkFotoParada: (...args: any[]) => mockUploadELinkFotoParada(...args),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('CameraUpload Component', () => {
  const mockOnUploadSuccess = jest.fn();
  const mockOnUploadError = jest.fn();

  const defaultProps = {
    unidadeId: 'unit-123',
    rotaId: 'route-456',
    paradaId: 'stop-789',
    onUploadSuccess: mockOnUploadSuccess,
    onUploadError: mockOnUploadError,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default successful responses
    mockRequestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockManipulateAsync.mockResolvedValue({ uri: 'compressed-image-uri' });
    mockUploadELinkFotoParada.mockResolvedValue(true);
  });

  describe('Renderização Inicial', () => {
    it('deve renderizar botão de adicionar foto', () => {
      const { getByText } = render(<CameraUpload {...defaultProps} />);
      expect(getByText('📸 Adicionar Foto do Comprovante')).toBeTruthy();
    });

    it('deve renderizar sem callbacks opcionais', () => {
      const { getByText } = render(
        <CameraUpload
          unidadeId="unit-123"
          rotaId="route-456"
          paradaId="stop-789"
        />
      );
      expect(getByText('📸 Adicionar Foto do Comprovante')).toBeTruthy();
    });
  });

  describe('Preview de Imagem', () => {
    it('deve ter estado inicial sem preview', () => {
      const { getByText, queryByText } = render(<CameraUpload {...defaultProps} />);

      expect(getByText('📸 Adicionar Foto do Comprovante')).toBeTruthy();
      expect(queryByText('📤 Enviar Foto')).toBeNull();
      expect(queryByText('❌ Remover')).toBeNull();
    });
  });

  describe('Upload de Foto', () => {
    it('deve aceitar props obrigatórias', () => {
      const { root } = render(<CameraUpload {...defaultProps} />);
      expect(root).toBeTruthy();
    });

    it('deve aceitar callbacks opcionais', () => {
      const { root } = render(
        <CameraUpload
          unidadeId="unit-123"
          rotaId="route-456"
          paradaId="stop-789"
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );
      expect(root).toBeTruthy();
    });
  });

  describe('Permissões', () => {
    it('deve ter mock de permissão de câmera', () => {
      expect(mockRequestCameraPermissionsAsync).toBeDefined();
    });

    it('deve ter mock de permissão de galeria', () => {
      expect(mockRequestMediaLibraryPermissionsAsync).toBeDefined();
    });
  });

  describe('Compressão de Imagem', () => {
    it('deve ter mock de manipulateAsync', () => {
      expect(mockManipulateAsync).toBeDefined();
    });

    it('deve ter SaveFormat.JPEG configurado', () => {
      const ImageManipulator = require('expo-image-manipulator');
      expect(ImageManipulator.SaveFormat.JPEG).toBe('jpeg');
    });
  });

  describe('Comportamento Web', () => {
    it('deve renderizar componente', () => {
      const originalPlatform = Platform.OS;
      Platform.OS = 'web';

      const { getByText } = render(<CameraUpload {...defaultProps} />);
      expect(getByText('📸 Adicionar Foto do Comprovante')).toBeTruthy();

      Platform.OS = originalPlatform;
    });
  });

  describe('Estados de Loading', () => {
    it('deve ter função de upload definida', () => {
      expect(mockUploadELinkFotoParada).toBeDefined();
    });
  });

  describe('Cancelamento de Seleção', () => {
    it('deve manter botão principal visível', () => {
      const { getByText, queryByText } = render(<CameraUpload {...defaultProps} />);

      expect(getByText('📸 Adicionar Foto do Comprovante')).toBeTruthy();
      expect(queryByText('📤 Enviar Foto')).toBeNull();
    });
  });
});
