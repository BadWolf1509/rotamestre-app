import { supabase } from './supabase';
import { Usuario, TipoUsuario } from '../types/usuario';

export const authService = {
  // Login
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Buscar dados do usuário na tabela usuarios
    if (data.user) {
      const usuario = await this.getUsuario(data.user.id);
      await supabase
        .from('usuarios')
        .update({ ultimo_login: new Date().toISOString() })
        .eq('id', data.user.id);
      return { session: data.session, usuario };
    }

    return { session: data.session, usuario: null };
  },

  // Registro
  async signUp(email: string, password: string, nome: string, papel: TipoUsuario) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    // Criar registro na tabela usuarios
    if (data.user) {
      const { error: insertError } = await supabase
        .from('usuarios')
        .insert([
          {
            id: data.user.id,
            email,
            nome,
            papel, // Alterado de 'tipo' para 'papel' (match com DB)
          },
        ]);

      if (insertError) throw insertError;
    }

    return data;
  },

  // Logout
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      // Ignora erro "Auth session missing" pois o objetivo é deslogar
      // Se não há sessão, o usuário já está deslogado
      if (error && !error.message?.includes('Auth session missing')) {
        throw error;
      }
    } catch (err: any) {
      // Trata graciosamente erros de sessão inexistente
      if (!err.message?.includes('Auth session missing')) {
        throw err;
      }
      console.log('[Auth] Sessão já estava encerrada');
    }
  },

  // Recuperar senha
  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'rotamestre://reset-password',
    });
    if (error) throw error;
  },

  // Atualizar senha
  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  },

  // Obter sessão atual
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  // Obter dados do usuário
  async getUsuario(userId: string): Promise<Usuario | null> {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*, unidades(nome)')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Erro ao buscar usuário:', error);
      return null;
    }

    return data;
  },

  // Verificar tipo de usuário
  async verificarTipoUsuario(userId: string): Promise<TipoUsuario | null> {
    const usuario = await this.getUsuario(userId);
    return usuario?.papel || null; // Alterado de 'tipo' para 'papel' (match com DB)
  },
};
