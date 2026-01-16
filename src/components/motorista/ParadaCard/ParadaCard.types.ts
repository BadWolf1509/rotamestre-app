/**
 * ParadaCard Types - Types and interfaces for ParadaCard component
 */

// Status types
export type ParadaStatus = 'pendente' | 'em_andamento' | 'concluida' | 'pulada';
export type ParadaTipo = 'entrega' | 'retirada' | 'origem';

// Main data interface
export interface Parada {
  id: string;
  endereco: string;
  enderecoSecundario?: string;
  latitude: number;
  longitude: number;
  ordem: number;
  status: ParadaStatus;
  tipo: ParadaTipo;
  destinatario?: string;
  telefone?: string;
  observacoes?: string;
  concluidaEm?: string;
  is_checkpoint?: boolean;
  vinculo_parada_id?: string | null;
}

// Component props
export interface ParadaCardProps {
  parada: Parada;
  rotaEmAndamento: boolean;
  onConcluir: (parada: Parada) => void;
  onPular: (parada: Parada) => void;
  onRetomar: (parada: Parada) => void;
  onNavegar: (parada: Parada) => void;
  onReportar: (parada: Parada) => void;
  concluindo?: boolean;
  pulando?: boolean;
  retomando?: boolean;
  isProxima?: boolean;
  variant?: 'default' | 'summary';
}

// Tipo info helper
export interface TipoInfo {
  label: string;
  icon: string;
  badgeStyleKey: 'tipoBadgeEntrega' | 'tipoBadgeRetirada' | 'tipoBadgeOrigem';
}

// Get tipo info helper
export function getTipoInfo(tipo: ParadaTipo): TipoInfo {
  switch (tipo) {
    case 'entrega':
      return { label: 'Entrega', icon: 'cube-outline', badgeStyleKey: 'tipoBadgeEntrega' };
    case 'retirada':
      return { label: 'Retirada', icon: 'download-outline', badgeStyleKey: 'tipoBadgeRetirada' };
    default:
      return { label: 'Origem', icon: 'flag-outline', badgeStyleKey: 'tipoBadgeOrigem' };
  }
}

// Get status badge text
export function getStatusBadgeText(
  isConcluida: boolean,
  isPulada: boolean,
  isEmAndamento: boolean,
  isSummary: boolean
): string {
  if (isSummary) {
    if (isConcluida) return 'Concluída';
    if (isPulada) return 'Pulada';
    if (isEmAndamento) return 'Em rota';
    return 'Pendente';
  }

  if (isConcluida) return '✓ Concluída';
  if (isPulada) return '↷ Pulada';
  if (isEmAndamento) return 'Em rota';
  return '○ Pendente';
}

// Get status label for accessibility
export function getStatusLabel(
  isConcluida: boolean,
  isPulada: boolean,
  isEmAndamento: boolean
): string {
  if (isConcluida) return 'concluída';
  if (isPulada) return 'pulada';
  if (isEmAndamento) return 'em rota';
  return 'pendente';
}

// Format completion time
export function formatCompletionTime(concluidaEm: string | undefined): string | null {
  if (!concluidaEm) return null;

  const dataConclusao = new Date(concluidaEm);
  if (Number.isNaN(dataConclusao.getTime())) return null;

  return dataConclusao.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
