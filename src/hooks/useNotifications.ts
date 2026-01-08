/**
 * Hook for notifications - uses NotificationDataContext
 *
 * This hook is a convenience wrapper around the context.
 * The actual subscription and data management is handled by NotificationDataProvider
 * which stays mounted across navigation (avoiding WebSocket reconnection issues).
 */

import { useNotificationData } from '@/context/NotificationDataContext';

export function useNotifications() {
  return useNotificationData();
}

// Re-export the type for backwards compatibility
export type { NotificacaoComDetalhes } from '@/types/notifications';
