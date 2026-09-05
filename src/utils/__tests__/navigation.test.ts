/**
 * Tests for navigation.ts
 * Utilitários para navegação externa
 */

import { Alert } from 'react-native';

import {
  openNavigation,
  showNavigationOptions,
  getShareLocationUrl,
} from '../navigation';

// Mock Linking
const mockCanOpenURL = jest.fn();
const mockOpenURL = jest.fn();

jest.mock('react-native', () => ({
  Linking: {
    canOpenURL: (url: string) => mockCanOpenURL(url),
    openURL: (url: string) => mockOpenURL(url),
  },
  Platform: {
    OS: 'ios',
    select: (obj: Record<string, unknown>) => obj.ios || obj.default,
  },
  Alert: {
    alert: jest.fn(),
  },
}));

describe('navigation', () => {
  const mockDestination = {
    latitude: -23.5505,
    longitude: -46.6333,
    label: 'São Paulo Centro',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCanOpenURL.mockReset();
    mockOpenURL.mockReset();
  });

  describe('getShareLocationUrl', () => {
    it('deve gerar URL de compartilhamento com coordenadas', () => {
      const url = getShareLocationUrl({
        latitude: -23.5505,
        longitude: -46.6333,
      });

      expect(url).toContain('-23.5505');
      expect(url).toContain('-46.6333');
      expect(url).toContain('google.com/maps');
    });

    it('deve incluir label codificado na URL', () => {
      const url = getShareLocationUrl({
        latitude: -23.5505,
        longitude: -46.6333,
        label: 'São Paulo',
      });

      expect(url).toContain(encodeURIComponent('São Paulo'));
    });

    it('deve funcionar sem label', () => {
      const url = getShareLocationUrl({
        latitude: -23.5505,
        longitude: -46.6333,
      });

      expect(url).toBeDefined();
      expect(typeof url).toBe('string');
    });
  });

  describe('openNavigation', () => {
    it('deve tentar abrir Waze primeiro', async () => {
      mockCanOpenURL.mockResolvedValueOnce(true);
      mockOpenURL.mockResolvedValueOnce(undefined);

      await openNavigation(mockDestination);

      expect(mockCanOpenURL).toHaveBeenCalled();
      expect(mockOpenURL).toHaveBeenCalled();
    });

    it('deve tentar Google Maps se Waze não disponível', async () => {
      // Waze não disponível
      mockCanOpenURL.mockResolvedValueOnce(false);
      // Google Maps disponível
      mockCanOpenURL.mockResolvedValueOnce(true);
      mockOpenURL.mockResolvedValueOnce(undefined);

      await openNavigation(mockDestination);

      expect(mockCanOpenURL).toHaveBeenCalledTimes(2);
      expect(mockOpenURL).toHaveBeenCalledTimes(1);
    });

    it('sonda o Waze pelo esquema, mas abre pelo universal link', async () => {
      // Regressão: `waze://?ll=…` abre o app sem destino. A URL aberta tem de
      // ser a https; a sondagem tem de continuar no esquema, senão https passa
      // sempre no canOpenURL e o Google Maps nunca é tentado.
      mockCanOpenURL.mockResolvedValueOnce(true);
      mockOpenURL.mockResolvedValueOnce(undefined);

      await openNavigation(mockDestination);

      expect(mockCanOpenURL).toHaveBeenCalledWith('waze://');
      expect(mockOpenURL).toHaveBeenCalledWith(
        `https://waze.com/ul?ll=${mockDestination.latitude},${mockDestination.longitude}&navigate=yes`,
      );
    });

    it('cai no Google Maps quando o Waze não está instalado', async () => {
      // Waze ausente (sondagem pelo esquema falha), Google Maps presente.
      mockCanOpenURL.mockResolvedValueOnce(false);
      mockCanOpenURL.mockResolvedValueOnce(true);
      mockOpenURL.mockResolvedValueOnce(undefined);

      await openNavigation(mockDestination);

      expect(mockOpenURL).toHaveBeenCalledTimes(1);
      expect(mockOpenURL.mock.calls[0][0]).not.toContain('waze');
    });

    it('deve tentar Apple Maps no iOS se outros não disponíveis', async () => {
      // Waze não disponível
      mockCanOpenURL.mockResolvedValueOnce(false);
      // Google Maps não disponível
      mockCanOpenURL.mockResolvedValueOnce(false);
      // Apple Maps disponível
      mockCanOpenURL.mockResolvedValueOnce(true);
      mockOpenURL.mockResolvedValueOnce(undefined);

      await openNavigation(mockDestination);

      expect(mockCanOpenURL).toHaveBeenCalledTimes(3);
      expect(mockOpenURL).toHaveBeenCalledTimes(1);
    });

    it('deve usar fallback web se nenhum app disponível', async () => {
      // Nenhum app disponível
      mockCanOpenURL.mockResolvedValue(false);
      mockOpenURL.mockResolvedValueOnce(undefined);

      await openNavigation(mockDestination);

      // Deve ter chamado openURL para o fallback web
      expect(mockOpenURL).toHaveBeenCalled();
    });

    it('deve mostrar alerta se fallback falhar', async () => {
      mockCanOpenURL.mockResolvedValue(false);
      mockOpenURL.mockRejectedValueOnce(new Error('Cannot open'));

      await openNavigation(mockDestination);

      expect(Alert.alert).toHaveBeenCalled();
    });
  });

  describe('showNavigationOptions', () => {
    it('deve mostrar alerta com opções de navegação', () => {
      showNavigationOptions(mockDestination);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Navegar com',
        'Escolha o app de navegação',
        expect.any(Array),
      );
    });

    it('deve incluir opção Waze', () => {
      showNavigationOptions(mockDestination);

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const options = alertCall[2];

      expect(options.some((opt: { text: string }) => opt.text === 'Waze')).toBe(
        true,
      );
    });

    it('deve incluir opção Google Maps', () => {
      showNavigationOptions(mockDestination);

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const options = alertCall[2];

      expect(
        options.some((opt: { text: string }) => opt.text === 'Google Maps'),
      ).toBe(true);
    });

    it('deve incluir opção Cancelar', () => {
      showNavigationOptions(mockDestination);

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const options = alertCall[2];

      const cancelOption = options.find(
        (opt: { text: string }) => opt.text === 'Cancelar',
      );
      expect(cancelOption).toBeDefined();
      expect(cancelOption.style).toBe('cancel');
    });
  });
});
