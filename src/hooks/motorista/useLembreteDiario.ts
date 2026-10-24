/**
 * Agenda o lembrete diário "Bom dia!" para o MOTORISTA logado.
 *
 * POR QUE AQUI E NÃO NO `initializeNotifications` (raiz do app): lá não se
 * sabe quem está logado, e o lembrete ("verifique se tem rotas pendentes")
 * chegava também ao gestor e sobrevivia ao logout. Quem monta o layout do
 * motorista já passou pelo portão de papel; o logout cancela
 * (`authService.signOut` → `cancelRouteReminder`).
 *
 * Só agenda com a permissão já concedida: pedir é do `initializeNotifications`.
 */
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { logger } from '@/lib/logger';
import { scheduleRouteReminder } from '@/lib/notifications';

export function useLembreteDiario(ehMotorista: boolean): void {
  useEffect(() => {
    if (!ehMotorista || Platform.OS === 'web') return;
    let cancelado = false;
    (async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (cancelado || status !== 'granted') return;
        await scheduleRouteReminder();
      } catch (error) {
        // Lembrete é conveniência: falhar em agendar não atrapalha a rota.
        logger.warn('[Lembrete] Falha ao agendar o lembrete diário', error);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [ehMotorista]);
}
