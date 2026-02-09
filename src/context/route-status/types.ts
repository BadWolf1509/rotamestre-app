/**
 * RouteStatus types and interfaces
 */

import type { MotivoSkip } from '@/constants/skipReasons';

export type RouteStatus = 'no-route' | 'pending' | 'active' | 'last-stop' | 'ready-to-complete' | 'completed';

export interface RouteData {
  id: string;
  status: string;
  unidade_nome: string;
  distancia_total?: number;
  tempo_total?: number;
  iniciada_em?: string;
  concluida_em?: string;
  data?: string;
  created_at?: string;
}

export interface ParadaData {
  id: string;
  endereco: string;
  ordem: number;
  status: string;
  tipo: string;
  latitude: number;
  longitude: number;
  destinatario?: string;
  telefone?: string;
  observacoes?: string;
  motivo_skip?: MotivoSkip;
  foto_url?: string | null;
  /** false = checkpoint de partida/chegada, true/undefined = entrega real */
  is_checkpoint?: boolean;
  /** Timestamp quando a parada foi concluída */
  concluida_em?: string;
  /** true se a parada foi concluída automaticamente pelo sistema de tracking */
  auto_concluida?: boolean;
}

/** Dados retornados pela query de rotas do Supabase */
export interface RotaQueryRow {
  id: string;
  status: string;
  distancia_total: number | null;
  tempo_total: number | null;
  iniciada_em: string | null;
  concluida_em: string | null;
  created_at: string;
  data: string | null;
  // Supabase returns related tables as single object or array depending on relation type
  unidades: { nome: string } | { nome: string }[] | null;
}

/** Dados para atualização de parada */
export interface ParadaUpdateData {
  status: string;
  concluida_em: string;
  foto_url?: string;
}

export interface RouteStatusContextData {
  routeStatus: RouteStatus;
  route: RouteData | null;
  paradas: ParadaData[];
  currentStop: ParadaData | null;
  nextStop: ParadaData | null;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  /** Quantidade de outras rotas pendentes (além da atual) */
  pendingRoutesCount: number;
  loading: boolean;
  refreshRoute: () => Promise<void>;
  startRoute: () => Promise<void>;
  completeStop: (paradaId: string, fotoUrl?: string) => Promise<void>;
  skipStop: (paradaId: string, motivo: MotivoSkip, observacoes?: string) => Promise<void>;
  completeRoute: () => Promise<void>;
}
