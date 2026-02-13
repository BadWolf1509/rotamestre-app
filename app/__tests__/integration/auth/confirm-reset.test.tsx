import { fireEvent, render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import React from 'react';

import ConfirmReset from '../../../auth/confirm-reset';

// Mock do expo-router já está configurado globalmente no jest.setup.js
const mockRouter = require('expo-router').useRouter();

// Mock window.location for web fragment parsing
const originalLocation = window.location;
const originalPlatformOS = Platform.OS;

function setHash(hash: string) {
  Object.defineProperty(window, 'location', {
    value: { ...originalLocation, hash },
    writable: true,
    configurable: true,
  });
}

afterEach(() => {
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
  jest.replaceProperty(Platform, 'OS', originalPlatformOS);
});

describe('Confirm Reset Screen - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // This page is web-only, so set Platform.OS = 'web' for all tests
    jest.replaceProperty(Platform, 'OS', 'web');
  });

  // ============================================
  // GRUPO 1: URL Válida no Fragmento
  // ============================================
  describe('URL Válida', () => {
    it('deve renderizar botão "Continuar" quando URL válida no fragmento', () => {
      setHash('#url=https://project.supabase.co/auth/v1/verify?token=abc123&type=recovery');

      const { getByText } = render(<ConfirmReset />);

      expect(getByText('Continuar')).toBeTruthy();
      expect(getByText('Recuperação de Senha')).toBeTruthy();
    });

    it('deve redirecionar via window.location.href ao clicar no botão', () => {
      const testUrl = 'https://project.supabase.co/auth/v1/verify?token=abc123&type=recovery&redirect_to=https://app.rotamestre.tec.br/auth/reset-password';
      setHash(`#url=${testUrl}`);

      // Also mock window.location.href setter
      const locationMock = {
        ...originalLocation,
        hash: `#url=${testUrl}`,
        href: '',
      };
      Object.defineProperty(window, 'location', {
        value: locationMock,
        writable: true,
        configurable: true,
      });

      const { getByText } = render(<ConfirmReset />);

      fireEvent.press(getByText('Continuar'));

      expect(window.location.href).toBe(testUrl);
    });

    it('deve decodificar URL encodada no fragmento', () => {
      const encodedUrl = encodeURIComponent('https://project.supabase.co/auth/v1/verify?token=abc&type=recovery');
      setHash(`#url=${encodedUrl}`);

      const locationMock = {
        ...originalLocation,
        hash: `#url=${encodedUrl}`,
        href: '',
      };
      Object.defineProperty(window, 'location', {
        value: locationMock,
        writable: true,
        configurable: true,
      });

      const { getByText } = render(<ConfirmReset />);

      fireEvent.press(getByText('Continuar'));

      expect(window.location.href).toBe('https://project.supabase.co/auth/v1/verify?token=abc&type=recovery');
    });

    it('deve ter accessibilityLabel no botão Continuar', () => {
      setHash('#url=https://project.supabase.co/auth/v1/verify?token=abc123&type=recovery');

      const { getByLabelText } = render(<ConfirmReset />);

      expect(getByLabelText('Continuar para redefinir senha')).toBeTruthy();
    });
  });

  // ============================================
  // GRUPO 2: URL Inválida ou Ausente
  // ============================================
  describe('URL Inválida', () => {
    it('deve mostrar erro quando fragmento está vazio', () => {
      setHash('');

      const { getByText } = render(<ConfirmReset />);

      expect(getByText('Link inválido')).toBeTruthy();
      expect(getByText('Solicitar Novo Link')).toBeTruthy();
    });

    it('deve mostrar erro quando fragmento não começa com #url=', () => {
      setHash('#token=abc123');

      const { getByText } = render(<ConfirmReset />);

      expect(getByText('Link inválido')).toBeTruthy();
    });

    it('deve mostrar botão "Solicitar Novo Link" quando URL inválida', () => {
      setHash('');

      const { getByText } = render(<ConfirmReset />);

      expect(getByText('Solicitar Novo Link')).toBeTruthy();
      expect(getByText('Voltar para login')).toBeTruthy();
    });

    it('deve navegar para forgot-password ao clicar em "Solicitar Novo Link"', () => {
      setHash('');

      const { getByText } = render(<ConfirmReset />);

      fireEvent.press(getByText('Solicitar Novo Link'));

      expect(mockRouter.replace).toHaveBeenCalledWith('/auth/forgot-password');
    });

    it('deve navegar para login ao clicar em "Voltar para login"', () => {
      setHash('');

      const { getByText } = render(<ConfirmReset />);

      fireEvent.press(getByText('Voltar para login'));

      expect(mockRouter.replace).toHaveBeenCalledWith('/auth/login');
    });
  });

  // ============================================
  // GRUPO 3: Acessibilidade
  // ============================================
  describe('Acessibilidade', () => {
    it('deve ter accessibilityLabel no botão "Solicitar Novo Link"', () => {
      setHash('');

      const { getByLabelText } = render(<ConfirmReset />);

      expect(getByLabelText('Solicitar novo link de recuperação')).toBeTruthy();
    });

    it('deve ter accessibilityLabel no botão "Voltar para login"', () => {
      setHash('');

      const { getByLabelText } = render(<ConfirmReset />);

      expect(getByLabelText('Voltar para login')).toBeTruthy();
    });
  });
});
