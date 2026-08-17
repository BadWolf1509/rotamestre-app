import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';

import ConfirmSignup from '../../../auth/confirm-signup';

// Mock do expo-router já está configurado globalmente no jest.setup.js
const mockRouter = require('expo-router').useRouter();

const originalLocation = window.location;
const originalPlatformOS = Platform.OS;

function setLocation(hash: string) {
  Object.defineProperty(window, 'location', {
    value: { ...originalLocation, hash, href: '' },
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

describe('Confirm Signup Screen - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Página web-only, como o confirm-reset.
    jest.replaceProperty(Platform, 'OS', 'web');
  });

  describe('URL Válida', () => {
    it('deve renderizar o botão de confirmação quando URL válida no fragmento', () => {
      setLocation(
        '#url=https://project.supabase.co/auth/v1/verify?token=abc123&type=signup',
      );

      const { getByText } = render(<ConfirmSignup />);

      expect(getByText('Confirmar Email')).toBeTruthy();
      expect(getByText('Confirmação de Cadastro')).toBeTruthy();
    });

    // O ponto do fluxo: o OTP só é consumido quando uma pessoa clica, não
    // quando o scanner do servidor de email faz prefetch da mensagem.
    it('deve redirecionar via window.location.href ao clicar no botão', () => {
      const testUrl =
        'https://project.supabase.co/auth/v1/verify?token=abc123&type=signup&redirect_to=https://app.rotamestre.tec.br';
      setLocation(`#url=${testUrl}`);

      const { getByText } = render(<ConfirmSignup />);

      fireEvent.press(getByText('Confirmar Email'));

      expect(window.location.href).toBe(testUrl);
    });

    it('deve decodificar URL encodada no fragmento', () => {
      const alvo =
        'https://project.supabase.co/auth/v1/verify?token=abc&type=signup';
      setLocation(`#url=${encodeURIComponent(alvo)}`);

      const { getByText } = render(<ConfirmSignup />);

      fireEvent.press(getByText('Confirmar Email'));

      expect(window.location.href).toBe(alvo);
    });

    it('deve ter accessibilityLabel no botão de confirmação', () => {
      setLocation(
        '#url=https://project.supabase.co/auth/v1/verify?token=abc123&type=signup',
      );

      const { getByLabelText } = render(<ConfirmSignup />);

      expect(getByLabelText('Confirmar email e ativar conta')).toBeTruthy();
    });
  });

  describe('URL Inválida', () => {
    it('deve mostrar erro quando fragmento está vazio', () => {
      setLocation('');

      const { getByText } = render(<ConfirmSignup />);

      expect(getByText('Link inválido')).toBeTruthy();
    });

    it('deve mostrar erro quando fragmento não começa com #url=', () => {
      setLocation('#access_token=abc123');

      const { getByText } = render(<ConfirmSignup />);

      expect(getByText('Link inválido')).toBeTruthy();
    });

    // Diferente do reset, aqui não existe "solicitar novo link": o app não
    // expõe auth.resend. A única saída oferecida é o login.
    it('deve navegar para login ao clicar em "Ir para o login"', () => {
      setLocation('');

      const { getByText } = render(<ConfirmSignup />);

      fireEvent.press(getByText('Ir para o login'));

      expect(mockRouter.replace).toHaveBeenCalledWith('/auth/login');
    });

    it('não deve oferecer solicitação de novo link', () => {
      setLocation('');

      const { queryByText } = render(<ConfirmSignup />);

      expect(queryByText('Solicitar Novo Link')).toBeNull();
    });

    it('deve ter accessibilityLabel no botão de login', () => {
      setLocation('');

      const { getByLabelText } = render(<ConfirmSignup />);

      expect(getByLabelText('Ir para a tela de login')).toBeTruthy();
    });
  });

  // Sem esta validação a página seria um open redirect: qualquer um poderia
  // mandar /auth/confirm-signup#url=<phishing> usando o domínio da aplicação
  // como trampolim.
  describe('Validação de destino (anti open-redirect)', () => {
    it.each([
      ['host diferente do Supabase', '#url=https://evil.example/verify?t=1'],
      [
        'subdomínio forjado do host do Supabase',
        '#url=https://project.supabase.co.evil.example/verify',
      ],
      [
        'http mesmo com host correto',
        '#url=http://project.supabase.co/auth/v1/verify',
      ],
      ['javascript:', '#url=javascript:alert(1)'],
      ['url relativa', '#url=/auth/login'],
    ])('deve rejeitar %s', (_caso, hash) => {
      setLocation(hash);

      const { getByText, queryByText } = render(<ConfirmSignup />);

      expect(getByText('Link inválido')).toBeTruthy();
      expect(queryByText('Confirmar Email')).toBeNull();
    });
  });
});
