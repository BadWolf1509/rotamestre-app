// ============================================
// Types para Sistema de Notificações
// ============================================

export type NotificationType =
  // Notificações para GESTOR (sobre ações do motorista)
  | 'rota_iniciada' // Motorista iniciou uma rota
  | 'rota_concluida' // Motorista finalizou uma rota
  | 'parada_concluida' // Motorista concluiu uma parada
  | 'parada_pulada' // Motorista pulou uma parada
  | 'parada_reaberta' // Parada foi reaberta
  | 'incidente_reportado' // Motorista reportou um incidente
  | 'sos_acionado' // Motorista acionou emergência SOS
  | 'rota_atrasada' // Rota está atrasada
  // Notificações para MOTORISTA
  | 'nova_rota_atribuida' // Nova rota foi atribuída ao motorista
  | 'lembrete_rota_pendente' // Lembrete às 16h sobre rota pendente
  | 'lembrete_rota_urgente' // Aviso urgente às 20h (2h antes expiração)
  // Notificações para AMBOS (gestor e motorista)
  | 'rota_nao_executada'; // Rota expirou sem ser executada

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
