/**
 * Handler para navegação quando usuário clica em notificação push
 * Implementa deep linking baseado no tipo de notificação
 */
import { router } from 'expo-router';

import { logger } from './logger';
import { addNotificationResponseListener } from './notifications';

/**
 * Configura o handler de resposta a notificações
 * Navega para a tela apropriada quando o usuário clica em uma notificação
 *
 * @returns Subscription que pode ser removida com .remove()
 */
export function setupNotificationResponseHandler() {
  return addNotificationResponseListener((response) => {
    const data = response.notification.request.content.data;
    const tipo = data?.tipo as string;
    const rotaId = data?.rota_id as string;

    logger.info('[NotificationHandler] Notification tapped', { tipo, rotaId });

    switch (tipo) {
      // ========== MOTORISTA ==========

      // Nova rota atribuída - ir para home do motorista
      case 'nova_rota_atribuida':
      case 'lembrete_rota_pendente':
      case 'lembrete_rota_urgente':
        router.push('/motorista');
        break;

      // Parada pulada ou reaberta - ir para checkpoints
      case 'parada_pulada':
      case 'parada_reaberta':
        router.push('/motorista/_screens/checkpoints');
        break;

      // ========== GESTOR - Rotas ==========

      // Eventos de rota - ir para mapa da rota
      case 'rota_iniciada':
      case 'rota_concluida':
      case 'rota_atrasada':
      case 'rota_nao_executada':
      case 'rota_parada_adicionada':
      case 'rota_parada_removida':
      case 'rota_parada_editada':
      case 'rota_reordenada':
        if (rotaId) {
          router.push(`/gestor/mapa-rota?id=${rotaId}`);
        } else {
          router.push('/gestor/gestao-rotas');
        }
        break;

      // ========== GESTOR - Emergências ==========

      // SOS ou incidente - ir para tela de incidentes
      case 'sos_acionado':
      case 'incidente_reportado':
        router.push('/gestor/incidentes');
        break;

      // ========== DEFAULT ==========

      default:
        logger.warn('[NotificationHandler] Unknown notification type', { tipo });
        // Não navegar para lugar nenhum se tipo desconhecido
        break;
    }
  });
}
