export type TipoUsuario = 'gestor' | 'motorista';

/**
 * Dados da unidade quando retornados do banco (join com usuarios)
 */
export interface UnidadeDB {
  id: string;
  nome: string;
  cnpj?: string;
  cidade?: string;
  endereco?: string;
  telefone?: string | null;
  email?: string | null;
  ativa: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Vinculação entre usuário e unidade (tabela usuario_unidades)
 * Permite que um usuário pertença a múltiplas unidades
 */
export interface UsuarioUnidade {
  id: string;
  usuario_id: string;
  unidade_id: string;
  papel: TipoUsuario;
  is_principal: boolean;
  ativo: boolean;
  created_at: string;
  updated_at?: string;
  // Join opcional com unidade
  unidades?: UnidadeDB;
}

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  papel: TipoUsuario; // Alterado de 'tipo' para 'papel' (match com DB)
  unidade_id?: string;
  telefone?: string | null;
  ativo?: boolean;
  ultimo_login?: string | null;
  created_at: string;
  updated_at: string;

  // Campos de gestão de perfil (migration 20251104)
  primeira_senha?: boolean;
  is_gestor_principal?: boolean;
  foto_url?: string | null;

  // Dados da unidade quando faz join com select('*, unidades(*)')
  // LEGACY: Unidade ativa atual (cache)
  unidades?: UnidadeDB;

  // NOVO: Todas as vinculações do usuário com unidades
  // Retornado quando faz join com select('*, usuario_unidades(*)')
  usuario_unidades?: UsuarioUnidade[];
}

export interface AuthState {
  usuario: Usuario | null;
  session: any;
  loading: boolean;
}
