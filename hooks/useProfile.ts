import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  nome: string;
  email: string;
  papel: 'gestor' | 'motorista';
  unidade_id: string | null;
  telefone: string | null;
  ativo: boolean;
  is_gestor_principal: boolean;
  primeira_senha: boolean;
  foto_url: string | null;
  ultimo_login: string | null;
}

interface UseProfileReturn {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  isGestorPrincipal: boolean;
  refreshProfile: () => Promise<void>;
}

export function useProfile(user: User | null): UseProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar perfil
  async function loadProfile() {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', user.id)
        .single();

      if (fetchError) throw fetchError;

      setProfile(data);
      setError(null);

      // Atualizar último login
      await supabase
        .from('usuarios')
        .update({ ultimo_login: new Date().toISOString() })
        .eq('id', user.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, [user]);

  // Atualizar perfil
  async function updateProfile(data: Partial<UserProfile>) {
    if (!user || !profile) throw new Error('Usuário não autenticado');

    try {
      const { error: updateError } = await supabase
        .from('usuarios')
        .update(data)
        .eq('id', user.id);

      if (updateError) throw updateError;

      await loadProfile();
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao atualizar perfil');
    }
  }

  // Trocar senha
  async function changePassword(currentPassword: string, newPassword: string) {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      // Validar senha atual fazendo login novamente
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      });

      if (signInError) throw new Error('Senha atual incorreta');

      // Atualizar senha
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      // Marcar como não sendo mais primeira senha
      await supabase
        .from('usuarios')
        .update({ primeira_senha: false })
        .eq('id', user.id);

      await loadProfile();
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao trocar senha');
    }
  }

  return {
    profile,
    loading,
    error,
    updateProfile,
    changePassword,
    isGestorPrincipal: profile?.is_gestor_principal || false,
    refreshProfile: loadProfile,
  };
}
