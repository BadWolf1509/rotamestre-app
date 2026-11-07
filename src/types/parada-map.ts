/**
 * Shared type for parada/stop data used by map components.
 *
 * All map components (MapaWebMapLibre, MapaMobile, MapaAdapter e os mini-mapas)
 * use this type to avoid duplicated local interfaces and `as any` casts.
 */

import type { RouteInfo } from '@/hooks/useRouteDirections';

export interface ParadaMapItem {
  id: string;
  ordem: number;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  tipo?: string | null;
  is_checkpoint?: boolean;
  destinatario?: string | null;
  telefone?: string | null;
}

export type StatusFilter = 'all' | 'pendente' | 'em_andamento' | 'concluida';

/**
 * Parada with guaranteed non-null coordinates (after filtering).
 * Used by components that require valid coordinates (e.g. MapaRN).
 */
export type ParadaWithCoords = ParadaMapItem & {
  latitude: number;
  longitude: number;
};

/**
 * Props do mapa de paradas, iguais nas duas plataformas: `MapaAdapter` (nativo
 * e web) as repassa por spread a `MapaMobile` e `MapaWebMapLibre`. Prop nova
 * entra aqui, e só aqui, para não chegar a uma plataforma só.
 */
export interface MapaAdapterProps {
  paradas: ParadaMapItem[];
  selectedParadaId?: string | null;
  onMarkerPress?: (paradaId: string) => void;
  /**
   * Toque no pino que já está selecionado (ou no balão dele): abre as ações
   * da parada. Sem ela, o toque repetido só seleciona de novo, e o balão não
   * mostra a dica "Toque para ver ações".
   */
  onSelectedMarkerPress?: (paradaId: string) => void;
  /** Callback quando toca fora dos marcadores (deselecionar) */
  onMapPress?: () => void;
  statusFilter?: StatusFilter;
  /** ID da rota para rastreamento em tempo real do motorista */
  rotaId?: string;
  /** Nome do motorista para exibir no marcador */
  motoristaNome?: string;
  /** Se true e rota em andamento, mostra posição do motorista em tempo real */
  showMotorista?: boolean;
  /** Nome da unidade para exibir nos checkpoints (PARTIDA/CHEGADA) */
  unidadeNome?: string;
  /** Geometria viária persistida em rotas.polyline. */
  polyline?: string | null;
  /** Totais persistidos da rota, em metros e segundos. */
  storedRouteInfo?: RouteInfo | null;
}
