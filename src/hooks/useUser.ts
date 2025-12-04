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

    // Iniciar loading ao carregar dados
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select(`
          *,
          unidades(*),
          usuario_unidades(
            id,
            usuario_id,
            unidade_id,
            papel,
            is_principal,
            ativo,
            created_at,
            unidades(id, nome, cnpj, cidade, ativa)
          )
        `)
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUserData(data);
    } catch (error) {
      console.error('Error loading user data:', error);
      setUserData(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Carregar dados quando userId mudar
  useEffect(() => {
    loadUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Verificar se tem múltiplas unidades
  const vinculacoes = userData?.usuario_unidades?.filter(v => v.ativo) || [];
  const temMultiplasUnidades = vinculacoes.length > 1;

  return {
    userData,
    loading,
    isGestor: userData?.papel === 'gestor',
    isMotorista: userData?.papel === 'motorista',
    unidade: userData?.unidades,
    // NOVO: Suporte a múltiplas unidades
    vinculacoes,
    temMultiplasUnidades,
    refresh: loadUserData,
  };
}
