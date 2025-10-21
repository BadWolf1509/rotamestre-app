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
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Recuperar senha
  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'rotamestre://reset-password',
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
      .select('*')
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
