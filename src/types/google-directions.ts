import { Coordenadas } from './endereco';

export interface GoogleDirectionsLeg {
  distancia_metros: number;
  duracao_segundos: number;
  endereco_inicio: string;
  endereco_fim: string;
  coordenadas_inicio: Coordenadas;
  coordenadas_fim: Coordenadas;
}

export interface GoogleDirectionsResult {
  polyline: string;
  distancia_total_metros: number;
  duracao_total_segundos: number;
  ordem_otimizada: number[];
  legs: GoogleDirectionsLeg[];
  /** Indica que distância e duração são apenas estimativas em linha reta. */
  is_estimated?: boolean;
}
