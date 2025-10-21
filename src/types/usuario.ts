export type TipoUsuario = 'gestor' | 'motorista';

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  papel: TipoUsuario; // Alterado de 'tipo' para 'papel' (match com DB)
  unidade_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  usuario: Usuario | null;
  session: any;
  loading: boolean;
}
