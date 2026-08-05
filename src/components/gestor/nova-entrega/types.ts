/**
 * Tipos compartilhados para os componentes de Nova Entrega
 */

import { GoogleDirectionsLeg } from '@/types/google-directions';

export type MotoristaResumo = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  rotaEmAndamento?: boolean;
  rotasPendentes?: number;
  paradasPendentes?: number;
};

export type VinculacaoMotorista = {
  usuario_id: string;
  usuarios: MotoristaResumo | null;
};

export interface ParadaFormData {
  endereco: string;
  tipo: 'entrega' | 'retirada';
  destinatario: string;
  telefone: string;
  observacoes?: string;
}

export interface ParadaFormDataWithCoords extends ParadaFormData {
  latitude?: number;
  longitude?: number;
}

export interface Parada extends ParadaFormData {
  id: string;
  latitude?: number;
  longitude?: number;
  ordem: number;
  vinculo_parada_id?: string;
}

export interface RotaOtimizadaState {
  distancia_total_metros: number;
  duracao_total_segundos: number;
  legs: GoogleDirectionsLeg[];
  polyline?: string;
  isEstimated?: boolean;
  /**
   * Distância (km) da ordem em que as paradas estavam ANTES da otimização.
   * null quando o cálculo falhou — o ganho fica desconhecido, mas a
   * otimização acontece normalmente.
   */
  distanciaAntesKm?: number | null;
}

export interface EnderecoUnidade {
  latitude: number;
  longitude: number;
  endereco: string;
}

export interface DistanciaManualReal {
  metros: number;
  segundos: number;
  isEstimated?: boolean;
  polyline?: string;
}

export interface SanidadeGeografica {
  maiorDistanciaKm: number;
  paradasDistantes: Parada[];
  requerConfirmacao: boolean;
}

export interface RouteDraftValidation {
  valido: boolean;
  erros: string[];
  avisos: string[];
  sanidadeGeografica: SanidadeGeografica;
}

export interface ParadasStatus {
  texto: string;
  cor: 'default' | 'warning' | 'error';
  icone: 'warning' | 'alert-circle' | null;
}
