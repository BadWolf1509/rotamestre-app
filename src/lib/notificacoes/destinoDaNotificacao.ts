/**
 * Para onde vai o toque numa notificação — no push (`notificationHandlers.ts`)
 * e na lista do sino (`NotificationList.tsx`), que antes decidiam cada um a
 * seu modo.
 *
 * QUEM RECEBE CADA TIPO (triggers do banco + `send-push-notification`):
 * - só gestor: rota_iniciada/concluida/atrasada, parada_pulada/reaberta,
 *   sos_acionado, incidente_reportado;
 * - só motorista: nova_rota_atribuida, lembretes, rota_parada_* e
 *   rota_reordenada (edição da rota pelo gestor);
 * - os dois: rota_nao_executada.
 *
 * O destino tem de existir para quem recebe: `_screens/` do motorista é
 * privado no Expo Router, e a área do gestor redireciona o motorista para a
 * Início. Por isso o papel decide; sem papel conhecido, vale o destinatário do
 * tipo, e o tipo dos dois papéis vai para a raiz, que roteia pelo papel.
 *
 * Abas do motorista usam `navigate` (vai à aba que já existe); `push`
 * empilharia outra Início sobre a atual.
 */
import type { TipoUsuario } from '@/types/usuario';

export interface DestinoNotificacao {
  caminho: string;
  modo: 'push' | 'navigate';
}

const SO_MOTORISTA = new Set([
  'nova_rota_atribuida',
  'lembrete_rota_pendente',
  'lembrete_rota_urgente',
  'rota_parada_adicionada',
  'rota_parada_removida',
  'rota_parada_editada',
  'rota_reordenada',
]);

const SO_GESTOR = new Set([
  'rota_iniciada',
  'rota_concluida',
  'rota_atrasada',
  'parada_pulada',
  'parada_reaberta',
  'sos_acionado',
  'incidente_reportado',
]);

const DOS_DOIS = new Set(['rota_nao_executada']);

const EDICAO_DA_ROTA = new Set([
  'rota_parada_adicionada',
  'rota_parada_removida',
  'rota_parada_editada',
  'rota_reordenada',
]);

function destinoMotorista(tipo: string): DestinoNotificacao {
  if (EDICAO_DA_ROTA.has(tipo)) {
    return { caminho: '/motorista/paradas', modo: 'navigate' };
  }
  if (tipo === 'rota_nao_executada') {
    return { caminho: '/motorista/historico', modo: 'navigate' };
  }
  return { caminho: '/motorista', modo: 'navigate' };
}

function destinoGestor(
  tipo: string,
  rotaId?: string | null,
): DestinoNotificacao {
  if (tipo === 'sos_acionado' || tipo === 'incidente_reportado') {
    return { caminho: '/gestor/incidentes', modo: 'push' };
  }
  if (rotaId) {
    return { caminho: `/gestor/mapa-rota?id=${rotaId}`, modo: 'push' };
  }
  return { caminho: '/gestor/gestao-rotas', modo: 'push' };
}

export function destinoDaNotificacao(
  tipo: string | undefined | null,
  rotaId: string | undefined | null,
  papel: TipoUsuario | null | undefined,
): DestinoNotificacao | null {
  if (!tipo) return null;
  const conhecido =
    SO_MOTORISTA.has(tipo) || SO_GESTOR.has(tipo) || DOS_DOIS.has(tipo);
  if (!conhecido) return null;

  const papelEfetivo: TipoUsuario | null =
    papel ??
    (SO_MOTORISTA.has(tipo)
      ? 'motorista'
      : SO_GESTOR.has(tipo)
        ? 'gestor'
        : null);

  if (papelEfetivo === 'motorista') return destinoMotorista(tipo);
  if (papelEfetivo === 'gestor') return destinoGestor(tipo, rotaId);
  return { caminho: '/', modo: 'navigate' };
}
