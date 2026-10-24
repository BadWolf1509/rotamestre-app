/**
 * Lembrete diário "Bom dia!": agendado para o MOTORISTA logado e cancelado
 * para o gestor.
 *
 * POR QUE AQUI E NÃO NO `initializeNotifications` (raiz do app): lá não se
 * sabe quem está logado, e o lembrete ("verifique se tem rotas pendentes")
 * chegava também ao gestor e sobrevivia ao logout. Quem monta o layout de um
 * papel já passou pelo portão dele; o logout cancela
 * (`authService.signOut` → `cancelRouteReminder`).
 *
 * Gestor: versões anteriores agendavam o lembrete para todo mundo, e quem já
 * o tem agendado o receberia até o próximo logout. Cancelar não pede
 * permissão e não depende dela.
 *
 * Motorista: só agenda com a permissão já concedida (pedir é do
 * `initializeNotifications`).
 */
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { logger } from '@/lib/logger';
import { cancelRouteReminder, scheduleRouteReminder } from '@/lib/notifications';

export function useLembreteDiario(papel: 'motorista' | 'gestor' | null): void {
  useEffect(() => {
    if (!papel || Platform.OS === 'web') return;
    let cancelado = false;
    (async () => {
      try {
        if (papel === 'gestor') {
          await cancelRouteReminder();
          return;
        }
        const { status } = await Notifications.getPermissionsAsync();
        if (cancelado || status !== 'granted') return;
        await scheduleRouteReminder();
      } catch (error) {
        // Lembrete é conveniência: falhar aqui não atrapalha a rota.
        logger.warn('[Lembrete] Falha ao ajustar o lembrete diário', error);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [papel]);
}
