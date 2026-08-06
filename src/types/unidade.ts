import { Endereco } from './endereco';

export interface Unidade {
  id: string;
  nome: string;
  endereco: Endereco;
  telefone?: string;
  email?: string;
  ativa: boolean;
  created_at: string;
  updated_at: string;

  // Onboarding self-service (RPC `criar_unidade_para_novo_gestor`,
  // migration `20260806175617_onboarding_self_service.sql`). `origem`/`status`
  // também descrevem unidades criadas por outros fluxos, não só self-service.
  uf?: string | null;
  sede_endereco?: string | null;
  sede_latitude?: number | null;
  sede_longitude?: number | null;
  origem?: string | null;
  status?: string | null;
}

export interface Motorista {
  id: string;
  usuario_id: string;
  unidade_id: string;
  nome: string;
  telefone?: string;
  veiculo_placa?: string;
  veiculo_modelo?: string;
  ativo: boolean;
  created_at: string;
}
