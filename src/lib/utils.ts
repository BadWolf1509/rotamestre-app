/**
 * Utility functions for the RotaMestre app
 */

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds to human readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}min ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}min`;
}

/**
 * Debounce function execution
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function execution
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as any;
  if (obj instanceof Object) {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        (clonedObj as any)[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Chunk an array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Remove duplicates from an array
 */
export function unique<T>(array: T[], key?: keyof T): T[] {
  if (!key) {
    return [...new Set(array)];
  }

  const seen = new Set();
  return array.filter(item => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

/**
 * Group array items by a key or key extractor function
 */
export function groupBy<T>(
  array: T[],
  keyOrFn: keyof T | ((item: T) => string)
): Record<string, T[]> {
  return array.reduce((result, item) => {
    const group = typeof keyOrFn === 'function'
      ? keyOrFn(item)
      : String(item[keyOrFn]);
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

/**
 * Sort array by multiple fields
 */
export function sortBy<T>(
  array: T[],
  fields: Array<{ key: keyof T; order: 'asc' | 'desc' }>
): T[] {
  return [...array].sort((a, b) => {
    for (const field of fields) {
      const aVal = a[field.key];
      const bVal = b[field.key];

      if (aVal < bVal) return field.order === 'asc' ? -1 : 1;
      if (aVal > bVal) return field.order === 'asc' ? 1 : -1;
    }
    return 0;
  });
}

/**
 * Memoize a function
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  getKey?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = getKey ? getKey(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Check if value is empty
 */
export function isEmpty(value: any): boolean {
  if (value == null) return true;
  if (typeof value === 'string' || Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Map a value from one range to another
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  const normalized = (value - inMin) / (inMax - inMin);
  return lerp(outMin, outMax, normalized);
}

// ============================================================================
// CONSTANTES E FUNÇÕES PARA TIMELINE
// ============================================================================

/**
 * Eventos de log que são exibidos na timeline
 * Centralizado para uso em RouteTimeline e TimelineCollapsible
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
  'sos_acionado',
] as const;

export type TimelineLogEvent = (typeof TIMELINE_LOG_EVENTS)[number];

/**
 * Tipo de evento para preview na timeline colapsável
 */
export type TimelinePreviewEventType = 'inicio' | 'conclusao' | 'parada' | 'incidente' | 'outro';

/**
 * Resultado do mapeamento de evento de log para preview
 */
export interface TimelinePreviewEvent {
  title: string;
  type: TimelinePreviewEventType;
  timestamp: string;
}

/**
 * Verifica se um evento de log é um evento válido da timeline
 */
export function isTimelineLogEvent(evento: string): boolean {
  const eventoLower = evento.toLowerCase();

  // Verificar eventos exatos
  if (TIMELINE_LOG_EVENTS.includes(eventoLower as TimelineLogEvent)) {
    return true;
  }

  // Verificar padrões de substring (compatibilidade)
  return (
    eventoLower.includes('iniciou') ||
    eventoLower.includes('concluiu') ||
    eventoLower.includes('finaliz') ||
    eventoLower.includes('cancelou') ||
    eventoLower.includes('cancel') ||
    eventoLower.includes('start')
  );
}

/**
 * Mapeia um evento de log para um evento de preview da timeline
 * @param log - Objeto com evento e timestamp
 * @returns TimelinePreviewEvent ou null se não for mapeável
 */
export function mapLogToTimelinePreview(log: {
  evento: string;
  timestamp: string;
}): TimelinePreviewEvent | null {
  const evento = log.evento.toLowerCase();

  // Início de rota
  if (evento.includes('iniciou') || evento === 'motorista_iniciou_rota' || evento.includes('start')) {
    return { timestamp: log.timestamp, title: 'Rota iniciada', type: 'inicio' };
  }

  // Conclusão de rota
  if (evento.includes('concluiu') || evento === 'motorista_concluiu_rota' || evento.includes('finaliz')) {
    return { timestamp: log.timestamp, title: 'Rota concluída', type: 'conclusao' };
  }

  // Cancelamento de rota
  if (evento.includes('cancelou') || evento === 'rota_cancelada' || evento.includes('cancel')) {
    return { timestamp: log.timestamp, title: 'Rota cancelada', type: 'outro' };
  }

  // Criação de rota
  if (evento === 'rota_criada') {
    return { timestamp: log.timestamp, title: 'Rota criada', type: 'outro' };
  }

  // SOS
  if (evento === 'sos_acionado') {
    return { timestamp: log.timestamp, title: 'SOS Acionado', type: 'incidente' };
  }

  // Atualizações de parada
  if (evento === 'parada_adicionada' || evento === 'parada_editada' || evento === 'parada_removida') {
    return { timestamp: log.timestamp, title: 'Parada atualizada', type: 'parada' };
  }

  return null;
}

// ============================================================================
// MAPEAMENTO COMPLETO DE EVENTOS PARA TIMELINE
// ============================================================================

/**
 * Cor semântica para eventos da timeline
 * Deve ser resolvida pelo componente usando theme
 */
export type TimelineSemanticColor = 'info' | 'success' | 'error' | 'warning' | 'purple' | 'blue' | 'gray';

/**
 * Tipo de evento completo para RouteTimeline
 */
export type TimelineEventType = 'status_change' | 'parada_update' | 'incidente' | 'gps_update';

/**
 * Evento mapeado para RouteTimeline (sem cor resolvida)
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

/**
 * Labels para categorias de incidentes
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
 * Categorias de incidente consideradas críticas
 */
export const CRITICAL_INCIDENT_CATEGORIES = ['accident', 'vehicle'];

/**
 * Mapeia um log do banco de dados para um evento da timeline
 * @param log - Log do Supabase
 * @returns TimelineEventMapped ou null se não for mapeável
 */
export function mapLogToTimelineEvent(log: {
  id: string;
  evento: string;
  timestamp: string;
  detalhes?: Record<string, any> | null;
}): TimelineEventMapped | null {
  const evento = log.evento.toLowerCase();
  const detalhes = typeof log.detalhes === 'object' ? log.detalhes : null;

  // ROTA CRIADA
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

  // ROTA INICIADA
  if (evento.includes('iniciou') || evento.includes('start') || evento === 'motorista_iniciou_rota') {
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

  // ROTA CONCLUÍDA
  if (evento.includes('concluiu') || evento.includes('finaliz') || evento === 'motorista_concluiu_rota') {
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

  // ROTA CANCELADA
  if (evento.includes('cancelou') || evento.includes('cancel') || evento === 'rota_cancelada') {
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

  // PARADA REABERTA
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

  // SOS ACIONADO (CRÍTICO)
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

  // ROTA FINALIZADA (RESUMO)
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

  // PARADA ADICIONADA
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

  // PARADA EDITADA
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

  // PARADA REMOVIDA
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

  // MOTORISTA ALTERADO
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

  // PARADAS REORDENADAS
  if (evento === 'paradas_reordenadas') {
    return {
      id: `log-${log.id}`,
      type: 'status_change',
      timestamp: log.timestamp,
      title: 'Rota Reordenada',
      description: detalhes?.alterado_por
        ? `Ordem alterada por ${detalhes.alterado_por}`
        : 'Ordem das paradas foi alterada',
      icon: 'swap-vertical',
      colorKey: 'purple',
    };
  }

  // ROTA REATIVADA
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

  // PARADA RETOMADA
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
 * Limite de caracteres para truncar descrição
 */
const DESCRIPTION_TRUNCATE_LENGTH = 80;

/**
 * Mapeia uma parada do banco de dados para um evento da timeline
 * @param parada - Parada do Supabase
 * @returns TimelineEventMapped
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
  // Ignorar checkpoints
  if (parada.is_checkpoint === false) {
    return null;
  }

  // Só processar paradas com concluida_em
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
 * Mapeia um incidente do banco de dados para um evento da timeline
 * @param incidente - Incidente do Supabase
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
    description: descricao.length > DESCRIPTION_TRUNCATE_LENGTH
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
// FUNÇÕES DE DATA/TEMPO PARA TIMELINE
// ============================================================================

/**
 * Formata um timestamp como tempo relativo em português
 * @param timestamp - ISO string ou Date
 * @returns "agora", "há 5 min", "há 2h", "ontem 14:30", ou data formatada
 */
export function formatRelativeTime(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Menos de 1 minuto
  if (diffMinutes < 1) {
    return 'agora';
  }

  // Menos de 1 hora
  if (diffMinutes < 60) {
    return `há ${diffMinutes} min`;
  }

  // Menos de 24 horas
  if (diffHours < 24) {
    return `há ${diffHours}h`;
  }

  // Ontem
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return `ontem ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  // Mais de 24 horas - mostrar data + hora
  if (diffDays < 7) {
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Mais de 7 dias - mostrar apenas data
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Retorna o grupo de data para agrupar eventos na timeline
 * @param timestamp - ISO string ou Date
 * @returns "Hoje", "Ontem", ou data formatada (ex: "25/12/2025")
 */
export function getDateGroup(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();

  // Comparar apenas a data (ignorar hora)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.floor((today.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Hoje';
  }

  if (diffDays === 1) {
    return 'Ontem';
  }

  // Retornar data formatada
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Calcula a duração entre dois timestamps e retorna formatado
 * @param start - Timestamp mais antigo (ISO string ou Date)
 * @param end - Timestamp mais recente (ISO string ou Date)
 * @returns Duração formatada (ex: "↓ 15 min", "↓ 2h 30min") ou null se < 1 min
 */
export function calculateDurationBetween(
  start: string | Date,
  end: string | Date
): string | null {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;

  const diffMs = Math.abs(endDate.getTime() - startDate.getTime());
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  // Não mostrar se for menos de 1 minuto
  if (diffMinutes < 1) {
    return null;
  }

  // Menos de 1 hora
  if (diffMinutes < 60) {
    return `↓ ${diffMinutes} min`;
  }

  // 1 hora ou mais
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;

  if (mins === 0) {
    return `↓ ${hours}h`;
  }

  return `↓ ${hours}h ${mins}min`;
}

// ============================================================================
// UTILITÁRIOS PARA INFOWINDOW/CALLOUT
// ============================================================================

/**
 * Escapa caracteres HTML para prevenir XSS
 * Usar sempre que inserir dados de usuário em HTML strings
 * @param unsafe - String potencialmente perigosa
 * @returns String segura com caracteres HTML escapados
 */
export function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * CSS de animação compartilhado para InfoWindows
 * Evita duplicação em cada builder
 */
export const INFO_WINDOW_ANIMATION_CSS = `
  @keyframes infoWindowFadeIn {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

/**
 * Cores semânticas para InfoWindows
 * Mapeadas dos design tokens para uso em HTML strings
 */
export const INFO_WINDOW_COLORS = {
  text: {
    primary: '#111827',    // colors.text.primary (gray[900])
    secondary: '#6b7280',  // colors.text.secondary (gray[500])
    link: '#284093',       // colors.text.link (primary.main)
  },
  background: {
    surface: '#f9fafb',    // colors.gray[50]
    border: '#e5e7eb',     // colors.gray[200]
  },
  brand: {
    primary: '#284093',    // colors.primary.main
    primaryDark: '#1b2c63', // colors.primary.dark
  },
} as const;
