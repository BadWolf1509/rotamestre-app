/**
 * Tests for notificationHandlers
 */

import { router } from 'expo-router';

// Mock logger
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock notifications with __esModule
let notificationCallback: ((response: any) => void) | null = null;
const mockAddNotificationResponseListener = jest.fn((callback) => {
  notificationCallback = callback;
  return { remove: jest.fn() };
});

jest.mock('../notifications', () => ({
  __esModule: true,
  addNotificationResponseListener: (...args: unknown[]) => mockAddNotificationResponseListener(...args),
}));

import { logger } from '../logger';
import { setupNotificationResponseHandler } from '../notificationHandlers';

describe('notificationHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notificationCallback = null;
  });

  const createNotificationResponse = (tipo: string, rotaId?: string) => ({
    notification: {
      request: {
        content: {
          data: {
            tipo,
            rota_id: rotaId,
          },
        },
      },
    },
  });

  describe('setupNotificationResponseHandler', () => {
    it('should register notification response listener', () => {
      setupNotificationResponseHandler();

      expect(mockAddNotificationResponseListener).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('should return subscription object', () => {
      const result = setupNotificationResponseHandler();

      expect(result).toHaveProperty('remove');
      expect(typeof result.remove).toBe('function');
    });
  });

  describe('motorista notifications', () => {
    beforeEach(() => {
      setupNotificationResponseHandler();
    });

    it('should navigate to /motorista/ for nova_rota_atribuida', () => {
      notificationCallback!(createNotificationResponse('nova_rota_atribuida'));

      expect(router.push).toHaveBeenCalledWith('/motorista/');
      expect(logger.info).toHaveBeenCalledWith(
        '[NotificationHandler] Notification tapped',
        { tipo: 'nova_rota_atribuida', rotaId: undefined }
      );
    });

    it('should navigate to /motorista/ for lembrete_rota_pendente', () => {
      notificationCallback!(createNotificationResponse('lembrete_rota_pendente'));

      expect(router.push).toHaveBeenCalledWith('/motorista/');
    });

    it('should navigate to /motorista/ for lembrete_rota_urgente', () => {
      notificationCallback!(createNotificationResponse('lembrete_rota_urgente'));

      expect(router.push).toHaveBeenCalledWith('/motorista/');
    });

    it('should navigate to /motorista/checkpoints for parada_pulada', () => {
      notificationCallback!(createNotificationResponse('parada_pulada'));

      expect(router.push).toHaveBeenCalledWith('/motorista/checkpoints');
    });

    it('should navigate to /motorista/checkpoints for parada_reaberta', () => {
      notificationCallback!(createNotificationResponse('parada_reaberta'));

      expect(router.push).toHaveBeenCalledWith('/motorista/checkpoints');
    });
  });

  describe('gestor route notifications', () => {
    beforeEach(() => {
      setupNotificationResponseHandler();
    });

    it('should navigate to mapa-rota with id for rota_iniciada', () => {
      notificationCallback!(createNotificationResponse('rota_iniciada', 'rota-123'));

      expect(router.push).toHaveBeenCalledWith('/gestor/mapa-rota?id=rota-123');
    });

    it('should navigate to mapa-rota with id for rota_concluida', () => {
      notificationCallback!(createNotificationResponse('rota_concluida', 'rota-456'));

      expect(router.push).toHaveBeenCalledWith('/gestor/mapa-rota?id=rota-456');
    });

    it('should navigate to mapa-rota with id for rota_atrasada', () => {
      notificationCallback!(createNotificationResponse('rota_atrasada', 'rota-789'));

      expect(router.push).toHaveBeenCalledWith('/gestor/mapa-rota?id=rota-789');
    });

    it('should navigate to mapa-rota with id for rota_nao_executada', () => {
      notificationCallback!(createNotificationResponse('rota_nao_executada', 'rota-abc'));

      expect(router.push).toHaveBeenCalledWith('/gestor/mapa-rota?id=rota-abc');
    });

    it('should navigate to mapa-rota with id for rota_parada_adicionada', () => {
      notificationCallback!(createNotificationResponse('rota_parada_adicionada', 'rota-def'));

      expect(router.push).toHaveBeenCalledWith('/gestor/mapa-rota?id=rota-def');
    });

    it('should navigate to mapa-rota with id for rota_parada_removida', () => {
      notificationCallback!(createNotificationResponse('rota_parada_removida', 'rota-ghi'));

      expect(router.push).toHaveBeenCalledWith('/gestor/mapa-rota?id=rota-ghi');
    });

    it('should navigate to mapa-rota with id for rota_parada_editada', () => {
      notificationCallback!(createNotificationResponse('rota_parada_editada', 'rota-jkl'));

      expect(router.push).toHaveBeenCalledWith('/gestor/mapa-rota?id=rota-jkl');
    });

    it('should navigate to mapa-rota with id for rota_reordenada', () => {
      notificationCallback!(createNotificationResponse('rota_reordenada', 'rota-mno'));

      expect(router.push).toHaveBeenCalledWith('/gestor/mapa-rota?id=rota-mno');
    });

    it('should navigate to gestao-rotas when no rotaId for rota_iniciada', () => {
      notificationCallback!(createNotificationResponse('rota_iniciada'));

      expect(router.push).toHaveBeenCalledWith('/gestor/gestao-rotas');
    });

    it('should navigate to gestao-rotas when no rotaId for rota_concluida', () => {
      notificationCallback!(createNotificationResponse('rota_concluida'));

      expect(router.push).toHaveBeenCalledWith('/gestor/gestao-rotas');
    });
  });

  describe('gestor emergency notifications', () => {
    beforeEach(() => {
      setupNotificationResponseHandler();
    });

    it('should navigate to /gestor/incidentes for sos_acionado', () => {
      notificationCallback!(createNotificationResponse('sos_acionado'));

      expect(router.push).toHaveBeenCalledWith('/gestor/incidentes');
    });

    it('should navigate to /gestor/incidentes for incidente_reportado', () => {
      notificationCallback!(createNotificationResponse('incidente_reportado'));

      expect(router.push).toHaveBeenCalledWith('/gestor/incidentes');
    });
  });

  describe('unknown notifications', () => {
    beforeEach(() => {
      setupNotificationResponseHandler();
    });

    it('should log warning for unknown notification type', () => {
      notificationCallback!(createNotificationResponse('unknown_type'));

      expect(logger.warn).toHaveBeenCalledWith(
        '[NotificationHandler] Unknown notification type',
        { tipo: 'unknown_type' }
      );
      expect(router.push).not.toHaveBeenCalled();
    });

    it('should not navigate for undefined tipo', () => {
      notificationCallback!({
        notification: {
          request: {
            content: {
              data: {},
            },
          },
        },
      });

      expect(logger.warn).toHaveBeenCalled();
      expect(router.push).not.toHaveBeenCalled();
    });
  });
});
