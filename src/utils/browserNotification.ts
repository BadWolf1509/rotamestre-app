/**
 * Browser Notification API utility for web platform
 * Provides native browser notifications when app is in background
 */

/**
 * Check if browser notifications are supported
 */
export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Request permission for browser notifications
 * @returns true if permission granted, false otherwise
 */
export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (!isBrowserNotificationSupported()) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('[BrowserNotification] Error requesting permission:', error);
    return false;
  }
}

/**
 * Get current notification permission status
 */
// eslint-disable-next-line no-undef
export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Send a browser notification
 * @param title - Notification title
 * @param options - Notification options (body, icon, etc.)
 */
export function sendBrowserNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    tag?: string;
    requireInteraction?: boolean;
    silent?: boolean;
    onClick?: () => void;
  }
): Notification | null {
  if (!isBrowserNotificationSupported()) {
    return null;
  }

  if (Notification.permission !== 'granted') {
    return null;
  }

  try {
    const notification = new Notification(title, {
      body: options?.body,
      icon: options?.icon || '/icon-192.png',
      tag: options?.tag,
      requireInteraction: options?.requireInteraction ?? false,
      silent: options?.silent ?? false,
    });

    if (options?.onClick) {
      notification.onclick = () => {
        window.focus();
        options.onClick?.();
        notification.close();
      };
    }

    // Auto-close after 5 seconds if not requiring interaction
    if (!options?.requireInteraction) {
      setTimeout(() => notification.close(), 5000);
    }

    return notification;
  } catch (error) {
    console.error('[BrowserNotification] Error sending notification:', error);
    return null;
  }
}

/**
 * Send notification for new route assignment (web)
 */
export function notifyNewRouteWeb(unidadeNome: string): void {
  sendBrowserNotification('Nova Rota Atribuída', {
    body: `Você recebeu uma nova rota de ${unidadeNome}. Toque para ver detalhes.`,
    icon: '/icon-192.png',
    tag: 'new-route',
    requireInteraction: true,
    onClick: () => {
      // Focus window when clicked
      window.focus();
    },
  });
}

/**
 * Send notification for route completion (web)
 */
export function notifyRouteCompleteWeb(totalParadas: number): void {
  sendBrowserNotification('Rota Concluída!', {
    body: `Parabéns! Você completou ${totalParadas} entregas.`,
    icon: '/icon-192.png',
    tag: 'route-complete',
  });
}

/**
 * Send generic notification (web)
 */
export function notifyGenericWeb(title: string, body: string): void {
  sendBrowserNotification(title, {
    body,
    icon: '/icon-192.png',
  });
}
