/**
 * RouteStatus types and interfaces
 */

import type { MotivoSkip } from '@/constants/skipReasons';
import type { RastreamentoSegundoPlano } from '@/hooks/route-status/useGarantirRastreamentoDaRota';
import type {
  DescarteDeAcao,
  DestinoDaAcao,
} from '@/lib/motorista/filaAcoesParada';

export type RouteStatus =
  | 'no-route'
  | 'pending'
  | 'active'
  | 'last-stop'
  | 'ready-to-complete'
  | 'completed';

export interface RouteData {
  id: string;
  /** Unidade proprietaria da rota; fonte autoritativa para dados tenant-scoped. */
  unidade_id: string;
  status: string;
  unidade_nome: string;
  distancia_total?: number;
  tempo_total?: number;
  polyline?: string | null;
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
  /** Mantido por gatilho no banco; usado para preservar a identidade na recarga */
  updated_at?: string;
}

/** Dados retornados pela query de rotas do Supabase */
export interface RotaQueryRow {
  id: string;
  unidade_id: string;
  status: string;
  distancia_total: number | null;
  tempo_total: number | null;
  polyline: string | null;
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
  /** Só na carga inicial; recargas são silenciosas. */
  loading: boolean;
  /**
   * Erro da última recarga. Com ele, `route`/`paradas` são os de
   * `atualizadoEm` (preservados), nunca apagados por falha de rede.
   */
  error: Error | null;
  /** Epoch (ms) da última carga bem-sucedida; null se nunca carregou. */
  atualizadoEm: number | null;
  refreshRoute: () => Promise<void>;
  startRoute: () => Promise<void>;
  /**
   * `'na_fila'`: sem rede, a ação ficou guardada no aparelho e sobe sozinha
   * (`src/lib/motorista/filaAcoesParada.ts`). `void` só para mocks antigos.
   */
  completeStop: (
    paradaId: string,
    fotoUrl?: string,
  ) => Promise<DestinoDaAcao | void>;
  skipStop: (
    paradaId: string,
    motivo: MotivoSkip,
    observacoes?: string,
  ) => Promise<DestinoDaAcao | void>;
  /** Paradas resolvidas no aparelho que ainda não chegaram ao banco. */
  paradasComEnvioPendente?: ReadonlySet<string>;
  /** Ações da fila descartadas por conflito (parada removida, rota mudou). */
  avisosDeEnvio?: DescarteDeAcao[];
  dispensarAvisosDeEnvio?: () => Promise<void>;
  completeRoute: () => Promise<void>;
  /**
   * Rastreamento em segundo plano da rota em andamento, religado na abertura e
   * na volta ao primeiro plano. Opcional para os mocks de teste que montam o
   * contexto à mão.
   */
  rastreamentoSegundoPlano?: RastreamentoSegundoPlano;
}
