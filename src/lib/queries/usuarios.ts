/**
 * User-related Supabase queries
 * Centralized query layer for usuarios table operations
 *
 * Só o que o app usa. As consultas antigas daqui (perfil com cache, lista de
 * motoristas, KPIs, último acesso) não tinham chamador e pediam colunas que
 * `usuarios` não tem (`avatar_url`, `ultimo_acesso`, `criado_em`,
 * `primeiro_acesso`): quem as usasse levaria 400 do PostgREST. Os nomes reais
 * são `foto_url`, `ultimo_login`, `created_at` e `primeira_senha`.
 */

import type { TipoUsuario } from '@/types/usuario';

import {
  supabase,
  withRetry,
  classifyError,
  type QueryResult,
} from './queryClient';

/**
 * Base usuario fields from database (colunas reais de `usuarios`)
 */
export interface UsuarioDB {
  id: string;
  email: string;
  nome: string;
  papel: TipoUsuario;
  telefone: string | null;
  foto_url: string | null;
  ativo: boolean;
  primeira_senha: boolean;
  ultimo_login: string | null;
  created_at: string;
}

/**
 * Usuario update data
 */
export interface UsuarioUpdate {
  nome?: string;
  email?: string;
  telefone?: string | null;
  foto_url?: string | null;
  ativo?: boolean;
}

/**
 * Update user profile
 */
export async function updateUsuario(
  userId: string,
  data: UsuarioUpdate,
): Promise<QueryResult<UsuarioDB>> {
  return withRetry(async () => {
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .update(data)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return usuario as UsuarioDB;
  }).then(
    (data) => ({ success: true as const, data }),
    (error) => ({ success: false as const, error: classifyError(error) }),
  );
}
