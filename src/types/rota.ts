import type { MotivoSkip } from '@/constants/skipReasons';

import { Endereco, Coordenadas } from './endereco';

export type TipoCheckpoint = 'entrega' | 'retirada' | 'origem';
/**
 * Espelha o CHECK `rotas_status_check` do banco, que é a fonte autoritativa:
 * `pendente, em_andamento, concluida, cancelada, nao_executada`.
 *
 * `nao_executada` faltava aqui desde sempre, embora o banco já tenha 17 linhas
 * assim — é o estado que `expire_old_pending_routes` grava ao encerrar rota que
 * não foi cumprida. Passou despercebido porque os componentes que exibem status
 * tipam o parâmetro como `string` (ver `getStatusBadgeVariant` e
 * `formatStatusLabel` em `RouteInfoHeader.tsx`), então o typecheck nunca teve
 * chance de reclamar.
 *
 * Ao adicionar valor aqui, atualize também `validStatusRota` em
 * `src/lib/type-guards.ts` — a lista é manual e não deriva deste tipo.
 */
export type StatusRota =
  'pendente' | 'em_andamento' | 'concluida' | 'cancelada' | 'nao_executada';
export type StatusCheckpoint = 'pendente' | 'concluida' | 'pulada';

/**
 * Como a ordem das paradas da rota foi definida.
 *
 * `null`/ausente significa **sem registro** — rota criada antes desta feature.
 * Nunca trate ausência como `'manual'`: não há como saber se aquelas rotas
 * foram otimizadas, e assumir uma delas falsearia a auditoria.
 */
export type OtimizacaoEstado = 'otimizada' | 'manual' | 'otimizada_alterada';

export interface Checkpoint {
  id: string;
  rota_id: string;
  tipo: TipoCheckpoint;
  endereco: Endereco;
  ordem: number;
  status: StatusCheckpoint;
  observacoes?: string;
  motivo_skip?: MotivoSkip;
  timestamp_conclusao?: string;
  concluida_em?: string;
  is_checkpoint?: boolean;
  created_at: string;
  /** ID da parada que deve ser executada ANTES desta (ex: retirada antes da entrega) */
  vinculo_parada_id?: string;
  /** Dados da parada vinculada (populated em queries) */
  vinculo_parada?: {
    id: string;
    endereco: string;
    destinatario?: string;
  };
}

export interface Rota {
  id: string;
  unidade_id: string;
  motorista_id?: string;
  status: StatusRota;
  origem: Coordenadas;
  checkpoints: Checkpoint[];
  distancia_total?: number; // em km
  tempo_estimado?: number; // em minutos
  tempo_real?: number; // em minutos
  tempo_total?: number; // em minutos
  polyline?: string; // encoded polyline do Google
  created_at: string;
  updated_at: string;
  iniciada_em?: string;
  concluida_em?: string;
  // Auditoria de uso do otimizador. O ganho é derivado na leitura
  // (`antes - depois`), nunca persistido, para não haver duas fontes de verdade.
  otimizacao_estado?: OtimizacaoEstado | null;
  otimizacao_distancia_antes?: number | null; // em km
  otimizacao_distancia_depois?: number | null; // em km
  otimizada_em?: string | null;
  otimizada_por?: string | null;
}

export interface RotaOtimizada {
  rota_original: Rota;
  ordem_otimizada: number[];
  distancia_total: number; // em km
  tempo_estimado: number; // em minutos
  polyline: string;
}

export interface ResumoRota {
  distancia_km: string;
  tempo_estimado: string;
  total_entregas: number;
  total_retiradas: number;
  checkpoints_concluidos: number;
  progresso_percentual: number;
}
