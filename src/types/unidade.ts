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
