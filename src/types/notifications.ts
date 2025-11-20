// ============================================
// Types para Sistema de Notificações
// ============================================

export type NotificationType =
  | 'rota_iniciada'
  | 'rota_concluida'
  | 'parada_concluida'
  | 'incidente_reportado'
  | 'rota_atrasada'
  | 'parada_pulada';

export interface Notificacao {
  id: string;
  usuario_id: string;
  tipo: NotificationType;
  titulo: string;
  mensagem: string;
  rota_id: string | null;
  parada_id: string | null;
  incidente_id: string | null;
  lida: boolean;
  created_at: string;
}

export interface MotoristaLocation {
  id: string;
  motorista_id: string;
  rota_id: string | null;
  latitude: number;
  longitude: number;
  timestamp: string;
  velocidade: number | null; // km/h
  precisao: number | null; // metros
  heading: number | null; // direção em graus (0-360)
}

export interface NotificacaoComDetalhes extends Notificacao {
  rota?: {
    data: string;
    status: string;
  };
  parada?: {
    endereco: string;
    ordem: number;
  };
  incidente?: {
    categoria: string;
    descricao: string;
  };
}
