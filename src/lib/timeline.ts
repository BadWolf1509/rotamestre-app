/**
 * Timeline Utilities
 *
 * All constants, types, and mapping functions for RouteTimeline and TimelineCollapsible.
 * Provides a centralized API for converting database logs, paradas, and incidents
 * into timeline events.
 */

import { formatarDecimal } from '@/lib/formatNumber';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Log events displayed in timeline
 * Centralized for use in RouteTimeline and TimelineCollapsible
 */
export const TIMELINE_LOG_EVENTS = [
  'rota_criada',
  'motorista_iniciou_rota',
  'motorista_concluiu_rota',
  'rota_cancelada',
  'rota_reativada',
  'rota_finalizada',
  'parada_reaberta',
  'parada_adicionada',
  'parada_editada',
  'parada_removida',
  'parada_retomada',
  'motorista_alterado',
  'paradas_reordenadas',
  'rota_otimizada',
  'sos_acionado',
] as const;

export type TimelineLogEvent = (typeof TIMELINE_LOG_EVENTS)[number];

/**
 * Labels for incident categories
 */
export const INCIDENTE_LABELS: Record<string, string> = {
  accident: 'Acidente/Incidente',
  absent: 'Cliente ausente',
  wrong_address: 'Endereço incorreto',
  blocked: 'Acesso bloqueado',
  vehicle: 'Problema no veículo',
  weather: 'Condições climáticas',
  other: 'Outros',
};

/**
 * Critical incident categories
 */
export const CRITICAL_INCIDENT_CATEGORIES = ['accident', 'vehicle'];

// ============================================================================
// TYPES
// ============================================================================

/**
 * Preview event type for collapsible timeline
 */
export type TimelinePreviewEventType =
  'inicio' | 'conclusao' | 'parada' | 'incidente' | 'outro';

/**
 * Result of mapping log event to preview
 */
export interface TimelinePreviewEvent {
  title: string;
  type: TimelinePreviewEventType;
  timestamp: string;
}

/**
 * Semantic color for timeline events
 * Should be resolved by component using theme
 */
export type TimelineSemanticColor =
  'info' | 'success' | 'error' | 'warning' | 'purple' | 'blue' | 'gray';

/**
 * Full event type for RouteTimeline
 */
export type TimelineEventType =
  'status_change' | 'parada_update' | 'incidente' | 'gps_update';

/**
 * Mapped event for RouteTimeline (without resolved color)
 */
export interface TimelineEventMapped {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  title: string;
  description: string;
  icon: string;
  colorKey: TimelineSemanticColor;
  isCritical?: boolean;
  fullDescription?: string;
  hasPhoto?: boolean;
  photoUrl?: string;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Check if a log event is a valid timeline event
 */
export function isTimelineLogEvent(evento: string): boolean {
  const eventoLower = evento.toLowerCase();

  // Check exact events
  if (TIMELINE_LOG_EVENTS.includes(eventoLower as TimelineLogEvent)) {
    return true;
  }

  // Check substring patterns (compatibility)
  return (
    eventoLower.includes('iniciou') ||
    eventoLower.includes('concluiu') ||
    eventoLower.includes('finaliz') ||
    eventoLower.includes('cancelou') ||
    eventoLower.includes('cancel') ||
    eventoLower.includes('start')
  );
}

// ============================================================================
// PREVIEW MAPPING (for TimelineCollapsible)
// ============================================================================

/**
 * Map a log event to a timeline preview event
 * @param log - Object with evento and timestamp
 * @returns TimelinePreviewEvent or null if not mappable
 */
export function mapLogToTimelinePreview(log: {
  evento: string;
  timestamp: string;
}): TimelinePreviewEvent | null {
  const evento = log.evento.toLowerCase();

  // Route started
  if (
    evento.includes('iniciou') ||
    evento === 'motorista_iniciou_rota' ||
    evento.includes('start')
  ) {
    return { timestamp: log.timestamp, title: 'Rota iniciada', type: 'inicio' };
  }

  // Route completed
  if (
    evento.includes('concluiu') ||
    evento === 'motorista_concluiu_rota' ||
    evento.includes('finaliz')
  ) {
    return {
      timestamp: log.timestamp,
      title: 'Rota concluída',
      type: 'conclusao',
    };
  }

  // Route cancelled
  if (
    evento.includes('cancelou') ||
    evento === 'rota_cancelada' ||
    evento.includes('cancel')
  ) {
    return { timestamp: log.timestamp, title: 'Rota cancelada', type: 'outro' };
  }

  // Route created
  if (evento === 'rota_criada') {
    return { timestamp: log.timestamp, title: 'Rota criada', type: 'outro' };
  }

  // SOS
  if (evento === 'sos_acionado') {
    return {
      timestamp: log.timestamp,
      title: 'SOS Acionado',
      type: 'incidente',
    };
  }

  // Stop updates
  if (
    evento === 'parada_adicionada' ||
    evento === 'parada_editada' ||
    evento === 'parada_removida'
  ) {
    return {
      timestamp: log.timestamp,
      title: 'Parada atualizada',
      type: 'parada',
    };
  }

  return null;
}

// ============================================================================
// FULL EVENT MAPPING (for RouteTimeline)
// ============================================================================

/**
 * Map a database log to a timeline event
 * @param log - Log from Supabase
 * @returns TimelineEventMapped or null if not mappable
 */
export function mapLogToTimelineEvent(log: {
  id: string;
  evento: string;
  timestamp: string;
  detalhes?: Record<string, any> | null;
}): TimelineEventMapped | null {
  const evento = log.evento.toLowerCase();
  const detalhes = typeof log.detalhes === 'object' ? log.detalhes : null;

  // ROUTE CREATED
  if (evento === 'rota_criada') {
    const totalParadas = detalhes?.total_paradas || 0;
    const temVinculos = detalhes?.tem_vinculos;
    let description = `Rota criada com ${totalParadas} parada(s)`;
    if (temVinculos) {
      description += ` • ${detalhes?.total_vinculos || 0} vínculo(s)`;
    }
    return {
      id: `log-${log.id}`,
      type: 'status_change',
      timestamp: log.timestamp,
      title: 'Rota Criada',
      description,
      icon: 'add-circle',
      colorKey: 'purple',
    };
  }

  // ROUTE STARTED
  if (
    evento.includes('iniciou') ||
    evento.includes('start') ||
    evento === 'motorista_iniciou_rota'
  ) {
    return {
      id: `log-${log.id}`,
      type: 'status_change',
      timestamp: log.timestamp,
      title: 'Rota Iniciada',
      description: detalhes?.timestamp
        ? `Motorista iniciou a rota às ${new Date(detalhes.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
        : 'Motorista iniciou a rota',
      icon: 'play-circle',
      colorKey: 'info',
    };
  }

  // ROUTE COMPLETED
  if (
    evento.includes('concluiu') ||
    evento.includes('finaliz') ||
    evento === 'motorista_concluiu_rota'
  ) {
    return {
      id: `log-${log.id}`,
      type: 'status_change',
      timestamp: log.timestamp,
      title: 'Rota Concluída',
      description: detalhes?.timestamp
        ? `Motorista finalizou a rota às ${new Date(detalhes.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
        : 'Motorista finalizou a rota',
      icon: 'checkmark-circle',
      colorKey: 'success',
    };
  }

  // ROUTE CANCELLED
  if (
    evento.includes('cancelou') ||
    evento.includes('cancel') ||
    evento === 'rota_cancelada'
  ) {
    return {
      id: `log-${log.id}`,
      type: 'status_change',
      timestamp: log.timestamp,
      title: 'Rota Cancelada',
      description: detalhes?.timestamp
        ? `Rota cancelada às ${new Date(detalhes.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
        : 'Rota foi cancelada',
      icon: 'close-circle',
      colorKey: 'error',
    };
  }

  // STOP REOPENED
  if (evento === 'parada_reaberta') {
    return {
      id: `log-${log.id}`,
      type: 'parada_update',
      timestamp: log.timestamp,
      title: 'Parada Reaberta',
      description: detalhes?.endereco || 'Parada voltou para pendente',
      icon: 'refresh-circle',
      colorKey: 'warning',
    };
  }

  // SOS (CRITICAL)
  if (evento === 'sos_acionado') {
    return {
      id: `log-${log.id}`,
      type: 'status_change',
      timestamp: log.timestamp,
      title: '🚨 SOS Acionado',
      description: detalhes?.motivo || 'Motorista acionou botão de emergência',
      fullDescription: detalhes?.motivo,
      icon: 'warning',
      colorKey: 'error',
      isCritical: true,
    };
  }

  // ROUTE FINALIZED (SUMMARY)
  if (evento === 'rota_finalizada') {
    const concluidas = detalhes?.paradas_concluidas || 0;
    const puladas = detalhes?.paradas_puladas || 0;
    return {
      id: `log-${log.id}`,
      type: 'status_change',
      timestamp: log.timestamp,
      title: 'Resumo Confirmado',
      description: `${concluidas} concluída(s), ${puladas} pulada(s)`,
      icon: 'document-text',
      colorKey: 'blue',
    };
  }

  // STOP ADDED
  if (evento === 'parada_adicionada') {
    return {
      id: `log-${log.id}`,
      type: 'parada_update',
      timestamp: log.timestamp,
      title: 'Parada Adicionada',
      description: detalhes?.endereco || 'Nova parada adicionada à rota',
      icon: 'add-circle',
      colorKey: 'success',
    };
  }

  // STOP EDITED
  if (evento === 'parada_editada') {
    const camposAlterados = detalhes?.campos_alterados;
    let descricao = 'Parada foi editada';
    if (camposAlterados) {
      const campos: string[] = [];
      if (camposAlterados.endereco) campos.push('endereço');
      if (camposAlterados.destinatario) campos.push('destinatário');
      if (camposAlterados.telefone) campos.push('telefone');
      if (camposAlterados.tipo) campos.push('tipo');
      if (camposAlterados.observacoes) campos.push('observações');
      if (campos.length > 0) {
        descricao = `Alterado: ${campos.join(', ')}`;
      }
    }
    return {
      id: `log-${log.id}`,
      type: 'parada_update',
      timestamp: log.timestamp,
      title: 'Parada Editada',
      description: descricao,
      icon: 'create',
      colorKey: 'warning',
    };
  }

  // STOP REMOVED
  if (evento === 'parada_removida') {
    return {
      id: `log-${log.id}`,
      type: 'parada_update',
      timestamp: log.timestamp,
      title: 'Parada Removida',
      description: `${detalhes?.paradas_restantes || 0} parada(s) restante(s)`,
      icon: 'trash',
      colorKey: 'error',
    };
  }

  // DRIVER CHANGED
  if (evento === 'motorista_alterado') {
    return {
      id: `log-${log.id}`,
      type: 'status_change',
      timestamp: log.timestamp,
      title: 'Motorista Alterado',
      description: detalhes?.motorista_novo_nome
        ? `Novo motorista: ${detalhes.motorista_novo_nome}`
        : 'Motorista da rota foi alterado',
      icon: 'person',
      colorKey: 'purple',
    };
  }

  // STOPS REORDERED
  if (evento === 'paradas_reordenadas') {
    const autor = detalhes?.alterado_por;
    const desfezOtimizacao = detalhes?.desfez_otimizacao === true;
    const descricaoBase = autor
      ? `Ordem alterada por ${autor}`
      : 'Ordem das paradas foi alterada';
    return {
      id: `log-${log.id}`,
      type: 'status_change',
      timestamp: log.timestamp,
      title: 'Rota Reordenada',
      description: desfezOtimizacao
        ? `${descricaoBase} — desfez a otimização`
        : descricaoBase,
      icon: 'swap-vertical',
      colorKey: 'purple',
    };
  }

  // ROUTE OPTIMIZED
  if (evento === 'rota_otimizada') {
    const antes = detalhes?.distancia_antes as number | null | undefined;
    const depois = detalhes?.distancia_depois as number | null | undefined;
    const description =
      typeof antes === 'number' && typeof depois === 'number'
        ? `${formatarDecimal(antes)} km → ${formatarDecimal(depois)} km`
        : 'Ordem definida pelo otimizador';
    return {
      id: `log-${log.id}`,
      type: 'status_change',
      timestamp: log.timestamp,
      title: 'Rota otimizada',
      description,
      icon: 'flash',
      colorKey: 'success',
    };
  }

  // ROUTE REACTIVATED
  if (evento === 'rota_reativada') {
    return {
      id: `log-${log.id}`,
      type: 'status_change',
      timestamp: log.timestamp,
      title: 'Rota Reativada',
      description: detalhes?.reativado_por
        ? `Reativada por ${detalhes.reativado_por}`
        : 'Rota foi reativada',
      icon: 'refresh-circle',
      colorKey: 'success',
    };
  }

  // STOP RESUMED
  if (evento === 'parada_retomada') {
    return {
      id: `log-${log.id}`,
      type: 'parada_update',
      timestamp: log.timestamp,
      title: 'Parada Retomada',
      description: detalhes?.endereco || 'Parada pulada foi retomada',
      icon: 'arrow-undo-circle',
      colorKey: 'info',
    };
  }

  return null;
}

/**
 * Truncate length for descriptions
 */
const DESCRIPTION_TRUNCATE_LENGTH = 80;

/**
 * Map a parada from database to timeline event
 * @param parada - Parada from Supabase
 * @returns TimelineEventMapped or null
 */
export function mapParadaToTimelineEvent(parada: {
  id: string;
  ordem: number;
  endereco: string;
  status: 'pendente' | 'concluida' | 'pulada';
  concluida_em?: string | null;
  is_checkpoint?: boolean;
  foto_url?: string | null;
}): TimelineEventMapped | null {
  // Ignore checkpoints
  if (parada.is_checkpoint === false) {
    return null;
  }

  // Only process paradas with concluida_em
  if (!parada.concluida_em) {
    return null;
  }

  const hasPhoto = !!parada.foto_url;

  if (parada.status === 'concluida') {
    return {
      id: `parada-${parada.id}`,
      type: 'parada_update',
      timestamp: parada.concluida_em,
      title: `Parada #${parada.ordem} Concluída`,
      description: parada.endereco,
      icon: 'location',
      colorKey: 'success',
      hasPhoto,
      photoUrl: parada.foto_url || undefined,
    };
  }

  if (parada.status === 'pulada') {
    return {
      id: `parada-${parada.id}`,
      type: 'parada_update',
      timestamp: parada.concluida_em,
      title: `Parada #${parada.ordem} Pulada`,
      description: parada.endereco,
      icon: 'remove-circle',
      colorKey: 'warning',
      hasPhoto,
      photoUrl: parada.foto_url || undefined,
    };
  }

  return null;
}

/**
 * Map an incident from database to timeline event
 * @param incidente - Incidente from Supabase
 * @returns TimelineEventMapped
 */
export function mapIncidenteToTimelineEvent(incidente: {
  id: string;
  categoria: string;
  descricao?: string | null;
  created_at: string;
  foto_url?: string | null;
}): TimelineEventMapped {
  const isCritical = CRITICAL_INCIDENT_CATEGORIES.includes(incidente.categoria);
  const hasPhoto = !!incidente.foto_url;
  const descricao = incidente.descricao || '';

  return {
    id: `incidente-${incidente.id}`,
    type: 'incidente',
    timestamp: incidente.created_at,
    title: INCIDENTE_LABELS[incidente.categoria] || 'Incidente',
    description:
      descricao.length > DESCRIPTION_TRUNCATE_LENGTH
        ? descricao.substring(0, DESCRIPTION_TRUNCATE_LENGTH) + '...'
        : descricao,
    fullDescription: descricao,
    icon: 'alert-circle',
    colorKey: 'error',
    isCritical,
    hasPhoto,
    photoUrl: incidente.foto_url || undefined,
  };
}

// ============================================================================
// DATE/TIME FUNCTIONS FOR TIMELINE
// ============================================================================

/**
 * Format a timestamp as relative time in Portuguese
 * @param timestamp - ISO string or Date
 * @returns "agora", "há 5 min", "há 2h", "ontem 14:30", or formatted date
 */
export function formatRelativeTime(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Less than 1 minute
  if (diffMinutes < 1) {
    return 'agora';
  }

  // Less than 1 hour
  if (diffMinutes < 60) {
    return `há ${diffMinutes} min`;
  }

  // Less than 24 hours
  if (diffHours < 24) {
    return `há ${diffHours}h`;
  }

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return `ontem ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  // More than 24 hours - show date + time
  if (diffDays < 7) {
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // More than 7 days - show only date
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Returns the date group for grouping events in timeline
 * @param timestamp - ISO string or Date
 * @returns "Hoje", "Ontem", or formatted date (ex: "25/12/2025")
 */
export function getDateGroup(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();

  // Compare only date (ignore time)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateOnly = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  const diffDays = Math.floor(
    (today.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) {
    return 'Hoje';
  }

  if (diffDays === 1) {
    return 'Ontem';
  }

  // Return formatted date
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Calculate duration between two timestamps and return formatted
 * @param start - Older timestamp (ISO string or Date)
 * @param end - Newer timestamp (ISO string or Date)
 * @returns Formatted duration (ex: "↓ 15 min", "↓ 2h 30min") or null if < 1 min
 */
export function calculateDurationBetween(
  start: string | Date,
  end: string | Date,
): string | null {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;

  const diffMs = Math.abs(endDate.getTime() - startDate.getTime());
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  // Don't show if less than 1 minute
  if (diffMinutes < 1) {
    return null;
  }

  // Less than 1 hour
  if (diffMinutes < 60) {
    return `↓ ${diffMinutes} min`;
  }

  // 1 hour or more
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;

  if (mins === 0) {
    return `↓ ${hours}h`;
  }

  return `↓ ${hours}h ${mins}min`;
}

// ============================================================================
// VIEW HELPERS (for RouteTimeline isNew derivation)
// ============================================================================

/**
 * Determina quais ids são "recém-adicionados" para fins de flag isNew + animação.
 * - Carga inicial (previousIds vazio) → vazio (nada é "novo").
 * - Paginação (isPagination) → vazio (eventos antigos anexados não são novos).
 * - Caso contrário → ids presentes agora e ausentes antes.
 */
export function computeNewlyAddedIds(
  currentIds: string[],
  previousIds: Set<string>,
  isPagination: boolean,
): Set<string> {
  if (isPagination || previousIds.size === 0) {
    return new Set();
  }
  return new Set(currentIds.filter((id) => !previousIds.has(id)));
}
