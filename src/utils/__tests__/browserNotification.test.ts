/**
 * Tests for browserNotification.ts
 * Browser Notification API utility
 */

import {
  isBrowserNotificationSupported,
  requestBrowserNotificationPermission,
  getBrowserNotificationPermission,
  sendBrowserNotification,
  notifyNewRouteWeb,
  notifyRouteCompleteWeb,
  notifyGenericWeb,
} from '../browserNotification';

// Store original window
const originalWindow = global.window;

describe('browserNotification', () => {
  // Mock Notification API
  const mockNotificationClose = jest.fn();
  const mockNotificationInstance = {
    close: mockNotificationClose,
    onclick: null as (() => void) | null,
  };

  const MockNotification = jest.fn().mockImplementation(() => mockNotificationInstance);
  (MockNotification as any).permission = 'default';
  (MockNotification as any).requestPermission = jest.fn().mockResolvedValue('granted');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup window with Notification
    (global as any).window = {
      Notification: MockNotification,
      focus: jest.fn(),
    };
    (global as any).Notification = MockNotification;
    (MockNotification as any).permission = 'default';
  });

  afterEach(() => {
    jest.useRealTimers();
    (global as any).window = originalWindow;
  });

  describe('isBrowserNotificationSupported', () => {
    it('deve retornar true quando Notification disponível', () => {
      expect(isBrowserNotificationSupported()).toBe(true);
    });

    it('deve retornar false quando window não definido', () => {
      (global as any).window = undefined;

      expect(isBrowserNotificationSupported()).toBe(false);
    });

    it('deve retornar false quando Notification não disponível', () => {
      delete (global as any).window.Notification;

      expect(isBrowserNotificationSupported()).toBe(false);
    });
  });

  describe('getBrowserNotificationPermission', () => {
    it('deve retornar "unsupported" quando não suportado', () => {
      (global as any).window = undefined;

      expect(getBrowserNotificationPermission()).toBe('unsupported');
    });

    it('deve retornar permission atual', () => {
      (MockNotification as any).permission = 'granted';

      expect(getBrowserNotificationPermission()).toBe('granted');
    });

    it('deve retornar "denied" quando negado', () => {
      (MockNotification as any).permission = 'denied';

      expect(getBrowserNotificationPermission()).toBe('denied');
    });
  });

  describe('requestBrowserNotificationPermission', () => {
    it('deve retornar false quando não suportado', async () => {
      (global as any).window = undefined;

      const result = await requestBrowserNotificationPermission();

      expect(result).toBe(false);
    });

    it('deve retornar true quando já concedido', async () => {
      (MockNotification as any).permission = 'granted';

      const result = await requestBrowserNotificationPermission();

      expect(result).toBe(true);
    });

    it('deve retornar false quando já negado', async () => {
      (MockNotification as any).permission = 'denied';

      const result = await requestBrowserNotificationPermission();

      expect(result).toBe(false);
    });

    it('deve solicitar permissão quando default', async () => {
      (MockNotification as any).permission = 'default';
      (MockNotification as any).requestPermission = jest.fn().mockResolvedValue('granted');

      const result = await requestBrowserNotificationPermission();

      expect((MockNotification as any).requestPermission).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('deve retornar false quando permissão negada pelo usuário', async () => {
      (MockNotification as any).permission = 'default';
      (MockNotification as any).requestPermission = jest.fn().mockResolvedValue('denied');

      const result = await requestBrowserNotificationPermission();

      expect(result).toBe(false);
    });

    it('deve retornar false em caso de erro', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (MockNotification as any).permission = 'default';
      (MockNotification as any).requestPermission = jest.fn().mockRejectedValue(new Error('Error'));

      const result = await requestBrowserNotificationPermission();

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('sendBrowserNotification', () => {
    it('deve retornar null quando não suportado', () => {
      (global as any).window = undefined;

      const result = sendBrowserNotification('Test');

      expect(result).toBeNull();
    });

    it('deve retornar null quando permissão não concedida', () => {
      (MockNotification as any).permission = 'denied';

      const result = sendBrowserNotification('Test');

      expect(result).toBeNull();
    });

    it('deve criar notificação quando permissão concedida', () => {
      (MockNotification as any).permission = 'granted';

      const result = sendBrowserNotification('Test Title', { body: 'Test Body' });

      expect(MockNotification).toHaveBeenCalledWith('Test Title', expect.objectContaining({
        body: 'Test Body',
      }));
      expect(result).toBeTruthy();
    });

    it('deve usar ícone padrão quando não fornecido', () => {
      (MockNotification as any).permission = 'granted';

      sendBrowserNotification('Test');

      expect(MockNotification).toHaveBeenCalledWith('Test', expect.objectContaining({
        icon: '/icon-192.png',
      }));
    });

    it('deve auto-fechar após 5 segundos por padrão', () => {
      (MockNotification as any).permission = 'granted';

      sendBrowserNotification('Test');

      jest.advanceTimersByTime(5000);

      expect(mockNotificationClose).toHaveBeenCalled();
    });

    it('não deve auto-fechar quando requireInteraction=true', () => {
      (MockNotification as any).permission = 'granted';

      sendBrowserNotification('Test', { requireInteraction: true });

      jest.advanceTimersByTime(5000);

      expect(mockNotificationClose).not.toHaveBeenCalled();
    });

    it('deve tratar erro ao criar notificação', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (MockNotification as any).permission = 'granted';
      MockNotification.mockImplementationOnce(() => {
        throw new Error('Notification error');
      });

      const result = sendBrowserNotification('Test');

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('notifyNewRouteWeb', () => {
    it('deve enviar notificação de nova rota', () => {
      (MockNotification as any).permission = 'granted';

      notifyNewRouteWeb('Unidade Teste');

      expect(MockNotification).toHaveBeenCalledWith(
        'Nova Rota Atribuída',
        expect.objectContaining({
          tag: 'new-route',
          requireInteraction: true,
        })
      );
    });
  });

  describe('notifyRouteCompleteWeb', () => {
    it('deve enviar notificação de rota completa', () => {
      (MockNotification as any).permission = 'granted';

      notifyRouteCompleteWeb(10);

      expect(MockNotification).toHaveBeenCalledWith(
        'Rota Concluída!',
        expect.objectContaining({
          body: expect.stringContaining('10'),
          tag: 'route-complete',
        })
      );
    });
  });

  describe('notifyGenericWeb', () => {
    it('deve enviar notificação genérica', () => {
      (MockNotification as any).permission = 'granted';

      notifyGenericWeb('Título', 'Mensagem');

      expect(MockNotification).toHaveBeenCalledWith(
        'Título',
        expect.objectContaining({
          body: 'Mensagem',
        })
      );
    });
  });
});
