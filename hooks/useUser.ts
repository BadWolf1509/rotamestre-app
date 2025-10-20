import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Usuario } from '../types/usuario';
import { useAuth } from './useAuth';

export function useUser() {
  const { user } = useAuth();
  const [userData, setUserData] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUserData(null);
      setLoading(false);
      return;
    }

    loadUserData();
  }, [user]);

  async function loadUserData() {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*, unidades(*)')
        .eq('id', user!.id)
        .single();

      if (error) throw error;
      setUserData(data);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  }

  return {
    userData,
    loading,
    isGestor: userData?.papel === 'gestor',
    isMotorista: userData?.papel === 'motorista',
    unidade: userData?.unidades,
    refresh: loadUserData,
  };
}
