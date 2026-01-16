/**
 * MainCard Types - Interfaces and types for MainCard components
 */

import { RouteStatus } from '@/context/RouteStatusContext';

// Parada interface - compatible with ParadaData from RouteStatusContext
export interface Parada {
  id: string;
  endereco: string;
  latitude: number;
  longitude: number;
  ordem: number;
  status: string; // 'pendente' | 'concluida' | 'pulada' - kept as string for compatibility
  tipo?: string; // 'entrega' | 'retirada' | 'origem'
  destinatario?: string;
  telefone?: string;
  observacoes?: string;
  is_checkpoint?: boolean;
}

// Rota interface
export interface Rota {
  id: string;
  unidade_nome?: string;
  data?: string;
  distancia_total?: number;
  tempo_total?: number;
  iniciada_em?: string;
  concluida_em?: string;
}

// Location interface
export interface Location {
  latitude: number;
  longitude: number;
}

// Main card props - uses any for backwards compatibility with existing code
export interface MainCardProps {
  state: RouteStatus;
  route: any; // Rota | null - kept as any for compatibility
  paradas: any[]; // Parada[] - kept as any for compatibility
  currentStop?: any | null; // Parada | null
  nextStop?: any | null; // Parada | null
  location?: Location | null;
  pendingRoutesCount?: number;
  onSwipeLeft?: () => void | Promise<void>;
  onSwipeRight?: (fotoUrl?: string) => void | Promise<void>;
  onPress?: () => void | Promise<void>;
  onChecklistChange?: (canStart: boolean, allOk: boolean) => void;
  testID?: string;
}

// Stats interface for no-route state
export interface NoRouteStats {
  rotasHoje: number;
  paradasHoje: number;
  distanciaHoje: number;
  rotasOntem: number;
  paradasOntem: number;
  distanciaOntem: number;
}

// Expired route data
export interface ExpiredRouteData {
  rota_id: string;
  data: string;
  paradas_pendentes: number;
  total_paradas: number;
  paradas_concluidas: number;
}

// Last route data
export interface LastRouteData {
  concluida_em: string;
  paradas_concluidas: number;
  total_paradas: number;
  distancia_km: number;
  tempo_total: string;
}
