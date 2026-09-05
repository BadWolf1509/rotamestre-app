import { Alert, Linking } from 'react-native';

import {
  abrirNavegacao,
  abrirNavegacaoDireta,
  verificarAppInstalado,
  abrirNavegacaoRotaCompleta,
  Coordenadas,
} from '../navigation';

// Mock LocationTrackingService
jest.mock('@/services/locationTracking', () => ({
  __esModule: true,
  default: {
    getNavigationPreferences: jest.fn().mockResolvedValue({
      preferredNavApp: 'default',
    }),
  },
}));

// Mock Linking
jest.mock('react-native', () => ({
  Linking: {
    canOpenURL: jest.fn().mockResolvedValue(true),
    openURL: jest.fn().mockResolvedValue(true),
  },
  Platform: {
    OS: 'ios',
    select: jest.fn((obj: any) => obj.ios || obj.android),
  },
  Alert: {
    alert: jest.fn((title, message, buttons) => {
      // Simula pressionar o primeiro botão
      if (buttons && buttons[0] && buttons[0].onPress) {
        buttons[0].onPress();
      }
    }),
  },
  ActionSheetIOS: {
    showActionSheetWithOptions: jest.fn(),
  },
}));

describe('navigation lib', () => {
  const mockCoords: Coordenadas = {
    latitude: -23.5505,
    longitude: -46.6333,
    endereco: 'Rua Teste, 123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('abrirNavegacao', () => {
    it('deve ser uma função async', () => {
      expect(typeof abrirNavegacao).toBe('function');
    });

    it('deve aceitar coordenadas como parâmetro', async () => {
      await expect(abrirNavegacao(mockCoords)).resolves.not.toThrow();
    });

    it('deve usar app preferido quando configurado', async () => {
      const LocationTrackingService =
        require('@/services/locationTracking').default;
      LocationTrackingService.getNavigationPreferences.mockResolvedValueOnce({
        preferredNavApp: 'waze',
      });
      (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true);

      await abrirNavegacao(mockCoords);

      // Deve tentar abrir Waze diretamente
      expect(Linking.openURL).toHaveBeenCalled();
      const openedUrl = (Linking.openURL as jest.Mock).mock.calls[0][0];
      expect(openedUrl).toContain('waze.com/ul');
    });

    it('abre o Waze pelo universal link, nunca pelo esquema custom', async () => {
      // Regressão: `waze://ul?ll=…` e `waze://?ll=…` abrem o app na tela
      // inicial, sem destino. Só `https://waze.com/ul?…` traça a rota.
      const LocationTrackingService =
        require('@/services/locationTracking').default;
      LocationTrackingService.getNavigationPreferences.mockResolvedValueOnce({
        preferredNavApp: 'waze',
      });
      (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true);

      await abrirNavegacao(mockCoords);

      const openedUrl = (Linking.openURL as jest.Mock).mock.calls[0][0];
      expect(openedUrl).toBe(
        `https://waze.com/ul?ll=${mockCoords.latitude},${mockCoords.longitude}&navigate=yes`,
      );
      expect(openedUrl).not.toContain('waze://');
    });

    it('deve usar app preferido google_maps', async () => {
      const LocationTrackingService =
        require('@/services/locationTracking').default;
      LocationTrackingService.getNavigationPreferences.mockResolvedValueOnce({
        preferredNavApp: 'google_maps',
      });
      (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true);

      await abrirNavegacao(mockCoords);

      expect(Linking.openURL).toHaveBeenCalled();
    });

    it('deve mostrar menu quando preferência é default', async () => {
      const LocationTrackingService =
        require('@/services/locationTracking').default;
      LocationTrackingService.getNavigationPreferences.mockResolvedValueOnce({
        preferredNavApp: 'default',
      });
      const { ActionSheetIOS } = require('react-native');

      await abrirNavegacao(mockCoords);

      // No iOS, deve mostrar ActionSheet
      expect(ActionSheetIOS.showActionSheetWithOptions).toHaveBeenCalled();
    });
  });

  describe('abrirNavegacaoDireta', () => {
    it('deve ser uma função', () => {
      expect(typeof abrirNavegacaoDireta).toBe('function');
    });

    it('deve abrir Google Maps quando appName é google', async () => {
      (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true);

      await abrirNavegacaoDireta(mockCoords, 'google');

      expect(Linking.openURL).toHaveBeenCalled();
    });

    it('deve abrir Waze quando appName é waze', async () => {
      (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true);

      await abrirNavegacaoDireta(mockCoords, 'waze');

      expect(Linking.openURL).toHaveBeenCalled();
    });

    it('deve usar fallback quando app não está instalado', async () => {
      (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(false);

      await abrirNavegacaoDireta(mockCoords, 'google');

      expect(Linking.openURL).toHaveBeenCalled();
    });
  });

  describe('verificarAppInstalado', () => {
    it('deve ser uma função', () => {
      expect(typeof verificarAppInstalado).toBe('function');
    });

    it('deve verificar se Waze está instalado', async () => {
      (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true);

      const result = await verificarAppInstalado('waze');

      expect(Linking.canOpenURL).toHaveBeenCalledWith('waze://');
      expect(result).toBe(true);
    });

    it('deve verificar se Google Maps está instalado', async () => {
      (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true);

      const result = await verificarAppInstalado('google');

      expect(Linking.canOpenURL).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('deve retornar false quando app não está instalado', async () => {
      (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(false);

      const result = await verificarAppInstalado('waze');

      expect(result).toBe(false);
    });
  });

  describe('abrirNavegacaoRotaCompleta', () => {
    it('deve ser uma função', () => {
      expect(typeof abrirNavegacaoRotaCompleta).toBe('function');
    });

    it('deve mostrar alerta quando há menos de 2 paradas', () => {
      abrirNavegacaoRotaCompleta([mockCoords]);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Rota Incompleta',
        'É necessário pelo menos 2 paradas para iniciar navegação.',
      );
    });

    it('deve aceitar array de paradas', () => {
      const paradas: Coordenadas[] = [
        { latitude: -23.5505, longitude: -46.6333 },
        { latitude: -23.56, longitude: -46.64 },
      ];

      expect(() => abrirNavegacaoRotaCompleta(paradas)).not.toThrow();
    });
  });

  describe('Coordenadas interface', () => {
    it('deve aceitar latitude e longitude', () => {
      const coords: Coordenadas = {
        latitude: -23.5505,
        longitude: -46.6333,
      };

      expect(coords.latitude).toBe(-23.5505);
      expect(coords.longitude).toBe(-46.6333);
    });

    it('deve aceitar endereco opcional', () => {
      const coords: Coordenadas = {
        latitude: -23.5505,
        longitude: -46.6333,
        endereco: 'Rua Teste',
      };

      expect(coords.endereco).toBe('Rua Teste');
    });
  });
});
