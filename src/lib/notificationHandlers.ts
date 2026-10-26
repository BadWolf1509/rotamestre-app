/**
 * Handler para navegação quando usuário clica em notificação push
 * Implementa deep linking baseado no tipo de notificação e no papel de quem
 * recebe (ver `destinoDaNotificacao`).
 */
import { router, type Href } from 'expo-router';

import { lerPerfilConhecido } from './auth/perfilConhecido';
import { logger } from './logger';
import { destinoDaNotificacao } from './notificacoes/destinoDaNotificacao';
import { addNotificationResponseListener } from './notifications';
import { supabase } from './supabase';

import type { TipoUsuario } from '../types/usuario';

/**
 * Papel de quem está logado, sem rede: sessão local + último perfil lido
 * neste aparelho. Null quando não dá para saber — o destino então segue o
 * destinatário do tipo.
 */
async function papelDoAparelho(): Promise<TipoUsuario | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return null;
    const perfil = await lerPerfilConhecido(userId);
    return perfil?.papel ?? null;
  } catch (error) {
    // Não crítico: sem papel, o destino cai no destinatário do tipo.
    logger.warn('[NotificationHandler] Papel indisponível', error);
    return null;
  }
}

/**
 * Configura o handler de resposta a notificações
 * Navega para a tela apropriada quando o usuário clica em uma notificação
 *
 * @returns Subscription que pode ser removida com .remove()
 */
export function setupNotificationResponseHandler() {
  return addNotificationResponseListener(async (response) => {
    const data = response.notification.request.content.data;
    const tipo = data?.tipo as string | undefined;
    const rotaId = data?.rota_id as string | undefined;

    logger.info('[NotificationHandler] Notification tapped', { tipo, rotaId });

    // Tipo desconhecido não navega (nem consulta o papel).
    if (!destinoDaNotificacao(tipo, rotaId, null)) {
      logger.warn('[NotificationHandler] Unknown notification type', { tipo });
      return;
    }

    const destino = destinoDaNotificacao(tipo, rotaId, await papelDoAparelho());
    if (!destino) return;

    const caminho = destino.caminho as Href;
    if (destino.modo === 'navigate') {
      router.navigate(caminho);
    } else {
      router.push(caminho);
    }
  });
}
