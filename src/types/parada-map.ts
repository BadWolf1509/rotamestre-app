/**
 * Shared type for parada/stop data used by map components.
 *
 * All map components (MapaWebMapLibre, MapaMobile, MapaRN, MapaAdapter)
 * use this type to avoid duplicated local interfaces and `as any` casts.
 */

export interface ParadaMapItem {
  id: string;
  ordem: number;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  tipo?: string | null;
  is_checkpoint?: boolean;
  destinatario?: string;
  telefone?: string;
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
