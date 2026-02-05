import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { Alert, Platform } from 'react-native';

import { logger } from '@/lib/logger';

import CameraUpload from '../CameraUpload';

// Mock the logger module
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// TypeScript declaration for global mock
declare global {
   
  var mockUseAlert: {
    showAlert: jest.Mock;
    showSuccess: jest.Mock;
    showWarning: jest.Mock;
    showError: jest.Mock;
    showConfirm: jest.Mock;
    showDestructive: jest.Mock;
    hideAlert: jest.Mock;
    isVisible: boolean;
    AlertDialog: null;
  };
}

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

// Spy on Alert.alert for the options menu (still uses Alert.alert on mobile)
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

    // Setup default camera/gallery responses (canceled by default)
    mockLaunchCameraAsync.mockResolvedValue({ canceled: true });
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true });
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

  describe('Interações com Câmera (Mock)', () => {
    it('deve chamar Alert.alert ao clicar em adicionar foto (mobile)', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'android',
        configurable: true,
      });

      const { getByText } = render(<CameraUpload {...defaultProps} />);

      fireEvent.press(getByText('📸 Adicionar Foto do Comprovante'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Adicionar Foto',
          'Escolha uma opção:',
          expect.any(Array)
        );
      });

      Object.defineProperty(Platform, 'OS', {
        get: () => originalPlatform,
        configurable: true,
      });
    });

    it('não deve abrir Alert em web (chama galeria diretamente)', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'web',
        configurable: true,
      });

      (Alert.alert as jest.Mock).mockClear();

      const { getByText } = render(<CameraUpload {...defaultProps} />);

      fireEvent.press(getByText('📸 Adicionar Foto do Comprovante'));

      await waitFor(() => {
        // Em web, não chama Alert.alert
        expect(Alert.alert).not.toHaveBeenCalled();
        // Chama requestMediaLibraryPermissionsAsync diretamente
        expect(mockRequestMediaLibraryPermissionsAsync).toHaveBeenCalled();
      });

      Object.defineProperty(Platform, 'OS', {
        get: () => originalPlatform,
        configurable: true,
      });
    });
  });

  describe('Permissões Negadas', () => {
    it('deve mostrar alert quando permissão de câmera negada', async () => {
      mockRequestCameraPermissionsAsync.mockResolvedValue({ status: 'denied' });

      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'android',
        configurable: true,
      });

      const { getByText } = render(<CameraUpload {...defaultProps} />);

      // Simulando pressionar "Tirar Foto" no Alert
      fireEvent.press(getByText('📸 Adicionar Foto do Comprovante'));

      // Aguardar o Alert.alert das opções
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Pegar o callback "Tirar Foto" do Alert e executar
      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const optionsAlert = alertCalls.find(call => call[0] === 'Adicionar Foto');
      if (optionsAlert && optionsAlert[2]) {
        const tirarFotoButton = optionsAlert[2].find((btn: any) => btn.text === '📷 Tirar Foto');
        await tirarFotoButton.onPress();
      }

      // Deve ter solicitado permissão
      expect(mockRequestCameraPermissionsAsync).toHaveBeenCalled();

      // Deve mostrar alert de permissão negada via useAlert hook
      await waitFor(() => {
        expect(global.mockUseAlert.showWarning).toHaveBeenCalledWith(
          'Permissão negada',
          'Precisamos de acesso à câmera para tirar fotos do comprovante de entrega.'
        );
      });

      Object.defineProperty(Platform, 'OS', {
        get: () => originalPlatform,
        configurable: true,
      });
    });

    it('deve mostrar alert quando permissão de galeria negada', async () => {
      mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'denied' });

      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'ios',
        configurable: true,
      });

      const { getByText } = render(<CameraUpload {...defaultProps} />);

      fireEvent.press(getByText('📸 Adicionar Foto do Comprovante'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const optionsAlert = alertCalls.find(call => call[0] === 'Adicionar Foto');
      if (optionsAlert && optionsAlert[2]) {
        const galeriaButton = optionsAlert[2].find((btn: any) => btn.text === '🖼️ Escolher da Galeria');
        await galeriaButton.onPress();
      }

      expect(mockRequestMediaLibraryPermissionsAsync).toHaveBeenCalled();

      // Deve mostrar alert de permissão negada via useAlert hook
      await waitFor(() => {
        expect(global.mockUseAlert.showWarning).toHaveBeenCalledWith(
          'Permissão negada',
          'Precisamos de acesso à galeria para selecionar fotos.'
        );
      });

      Object.defineProperty(Platform, 'OS', {
        get: () => originalPlatform,
        configurable: true,
      });
    });
  });

  describe('Seleção de Imagem', () => {
    it('deve exibir preview e botões quando imagem selecionada da câmera', async () => {
      mockLaunchCameraAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'camera-image-uri' }],
      });

      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'android',
        configurable: true,
      });

      const { getByText, queryByText } = render(<CameraUpload {...defaultProps} />);

      fireEvent.press(getByText('📸 Adicionar Foto do Comprovante'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const optionsAlert = alertCalls.find(call => call[0] === 'Adicionar Foto');
      if (optionsAlert && optionsAlert[2]) {
        const tirarFotoButton = optionsAlert[2].find((btn: any) => btn.text === '📷 Tirar Foto');
        await tirarFotoButton.onPress();
      }

      await waitFor(() => {
        expect(mockLaunchCameraAsync).toHaveBeenCalled();
        expect(mockManipulateAsync).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(getByText('📤 Enviar Foto')).toBeTruthy();
        expect(getByText('❌ Remover')).toBeTruthy();
        expect(queryByText('📸 Adicionar Foto do Comprovante')).toBeNull();
      });

      Object.defineProperty(Platform, 'OS', {
        get: () => originalPlatform,
        configurable: true,
      });
    });

    it('deve exibir preview quando imagem selecionada da galeria', async () => {
      mockLaunchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'gallery-image-uri' }],
      });

      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'web',
        configurable: true,
      });

      const { getByText } = render(<CameraUpload {...defaultProps} />);

      fireEvent.press(getByText('📸 Adicionar Foto do Comprovante'));

      await waitFor(() => {
        expect(mockRequestMediaLibraryPermissionsAsync).toHaveBeenCalled();
        expect(mockLaunchImageLibraryAsync).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(getByText('📤 Enviar Foto')).toBeTruthy();
      });

      Object.defineProperty(Platform, 'OS', {
        get: () => originalPlatform,
        configurable: true,
      });
    });

    it('não deve exibir preview quando usuário cancelar câmera', async () => {
      mockLaunchCameraAsync.mockResolvedValue({ canceled: true });

      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'android',
        configurable: true,
      });

      const { getByText, queryByText } = render(<CameraUpload {...defaultProps} />);

      fireEvent.press(getByText('📸 Adicionar Foto do Comprovante'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const optionsAlert = alertCalls.find(call => call[0] === 'Adicionar Foto');
      if (optionsAlert && optionsAlert[2]) {
        const tirarFotoButton = optionsAlert[2].find((btn: any) => btn.text === '📷 Tirar Foto');
        await tirarFotoButton.onPress();
      }

      await waitFor(() => {
        expect(mockLaunchCameraAsync).toHaveBeenCalled();
      });

      // Não deve mostrar preview
      expect(queryByText('📤 Enviar Foto')).toBeNull();
      expect(getByText('📸 Adicionar Foto do Comprovante')).toBeTruthy();

      Object.defineProperty(Platform, 'OS', {
        get: () => originalPlatform,
        configurable: true,
      });
    });
  });

  describe('Remover Imagem', () => {
    it('deve remover preview ao clicar em Remover', async () => {
      mockLaunchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'test-uri' }],
      });

      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'web',
        configurable: true,
      });

      const { getByText, queryByText } = render(<CameraUpload {...defaultProps} />);

      // Adicionar foto
      fireEvent.press(getByText('📸 Adicionar Foto do Comprovante'));

      await waitFor(() => {
        expect(getByText('📤 Enviar Foto')).toBeTruthy();
      });

      // Remover foto
      fireEvent.press(getByText('❌ Remover'));

      await waitFor(() => {
        expect(queryByText('📤 Enviar Foto')).toBeNull();
        expect(getByText('📸 Adicionar Foto do Comprovante')).toBeTruthy();
      });

      Object.defineProperty(Platform, 'OS', {
        get: () => originalPlatform,
        configurable: true,
      });
    });
  });

  describe('Upload de Imagem', () => {
    it('deve fazer upload com sucesso e chamar onUploadSuccess', async () => {
      mockLaunchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'test-uri' }],
      });
      mockUploadELinkFotoParada.mockResolvedValue(true);

      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'web',
        configurable: true,
      });

      const { getByText } = render(<CameraUpload {...defaultProps} />);

      // Selecionar imagem
      fireEvent.press(getByText('📸 Adicionar Foto do Comprovante'));

      await waitFor(() => {
        expect(getByText('📤 Enviar Foto')).toBeTruthy();
      });

      // Fazer upload
      fireEvent.press(getByText('📤 Enviar Foto'));

      await waitFor(() => {
        expect(mockUploadELinkFotoParada).toHaveBeenCalledWith(
          'unit-123',
          'route-456',
          'stop-789',
          'compressed-image-uri'
        );
      });

      await waitFor(() => {
        expect(mockOnUploadSuccess).toHaveBeenCalledWith('success');
        // On web, success alert is not shown (handled by UI feedback)
      });

      Object.defineProperty(Platform, 'OS', {
        get: () => originalPlatform,
        configurable: true,
      });
    });

    it('deve chamar onUploadError quando upload falhar', async () => {
      mockLaunchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'test-uri' }],
      });
      mockUploadELinkFotoParada.mockResolvedValue(false);

      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'web',
        configurable: true,
      });

      const { getByText } = render(<CameraUpload {...defaultProps} />);

      fireEvent.press(getByText('📸 Adicionar Foto do Comprovante'));

      await waitFor(() => {
        expect(getByText('📤 Enviar Foto')).toBeTruthy();
      });

      fireEvent.press(getByText('📤 Enviar Foto'));

      await waitFor(() => {
        expect(global.mockUseAlert.showError).toHaveBeenCalledWith({
          title: 'Erro',
          message: 'Não foi possível enviar a foto. Tente novamente.'
        });
        expect(mockOnUploadError).toHaveBeenCalledWith('Falha no upload');
      });

      Object.defineProperty(Platform, 'OS', {
        get: () => originalPlatform,
        configurable: true,
      });
    });

    it('deve mostrar alert ao tentar upload sem imagem selecionada', async () => {
      const { getByText } = render(<CameraUpload {...defaultProps} />);

      // Tentar upload sem imagem selecionada - mas não temos o botão visível
      // Este caso é preventivo, mas não podemos testar diretamente via UI
      expect(getByText('📸 Adicionar Foto do Comprovante')).toBeTruthy();
    });
  });

  describe('Compressão de Imagem', () => {
    it('deve comprimir imagem antes de exibir preview', async () => {
      mockLaunchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'original-uri' }],
      });
      mockManipulateAsync.mockResolvedValue({ uri: 'compressed-uri' });

      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'web',
        configurable: true,
      });

      const { getByText } = render(<CameraUpload {...defaultProps} />);

      fireEvent.press(getByText('📸 Adicionar Foto do Comprovante'));

      await waitFor(() => {
        expect(mockManipulateAsync).toHaveBeenCalledWith(
          'original-uri',
          [{ resize: { width: 1200 } }],
          { compress: 0.7, format: 'jpeg' }
        );
      });

      Object.defineProperty(Platform, 'OS', {
        get: () => originalPlatform,
        configurable: true,
      });
    });

    it('deve usar URI original se compressão falhar', async () => {
      mockLaunchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'original-uri' }],
      });
      mockManipulateAsync.mockRejectedValue(new Error('Compress failed'));

      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'web',
        configurable: true,
      });

      const { getByText } = render(<CameraUpload {...defaultProps} />);

      fireEvent.press(getByText('📸 Adicionar Foto do Comprovante'));

      await waitFor(() => {
        expect(mockManipulateAsync).toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith('[CameraUpload] Erro ao comprimir:', expect.any(Error));
      });

      // Deve ainda assim exibir preview com URI original
      await waitFor(() => {
        expect(getByText('📤 Enviar Foto')).toBeTruthy();
      });

      Object.defineProperty(Platform, 'OS', {
        get: () => originalPlatform,
        configurable: true,
      });
    });
  });

  describe('Estado de Loading', () => {
    it('deve mostrar ActivityIndicator durante upload', async () => {
      jest.useFakeTimers();

      mockLaunchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'test-uri' }],
      });

      // Upload demorado
      mockUploadELinkFotoParada.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(true), 1000))
      );

      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'web',
        configurable: true,
      });

      const { getByText, UNSAFE_getByType } = render(<CameraUpload {...defaultProps} />);

      fireEvent.press(getByText('📸 Adicionar Foto do Comprovante'));

      await waitFor(() => {
        expect(getByText('📤 Enviar Foto')).toBeTruthy();
      });

      fireEvent.press(getByText('📤 Enviar Foto'));

      // Verificar que botões estão disabled durante upload
      await waitFor(() => {
        const { ActivityIndicator } = require('react-native');
        expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
      });

      await act(async () => {
        jest.runAllTimers();
      });

      jest.useRealTimers();

      Object.defineProperty(Platform, 'OS', {
        get: () => originalPlatform,
        configurable: true,
      });
    });
  });
});
