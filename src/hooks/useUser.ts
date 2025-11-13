import { useCallback, useEffect, useState } from 'react';

import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import { Usuario } from '../types/usuario';

export function useUser() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [userData, setUserData] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async () => {
    if (!userId) {
      setUserData(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*, unidades(*)')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUserData(data);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // ✅ FIX: Usar userId diretamente ao invés de loadUserData
  useEffect(() => {
    loadUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]); // Apenas userId, evita loop infinito

  return {
    userData,
    loading,
    isGestor: userData?.papel === 'gestor',
    isMotorista: userData?.papel === 'motorista',
    unidade: userData?.unidades,
    refresh: loadUserData,
  };
}
