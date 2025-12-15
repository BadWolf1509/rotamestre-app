import { useCallback, useEffect, useState, useRef } from 'react';

import { useAuth } from './useAuth';
import { getCache, setCache, clearCache, CACHE_TTL, CACHE_KEYS } from '../lib/cache';
import { supabase } from '../lib/supabase';
import { Usuario } from '../types/usuario';

export function useUser() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [userData, setUserData] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchUserData = useCallback(async (): Promise<Usuario | null> => {
    if (!userId) return null;

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
          unidades(id, nome, cidade, ativa)
        )
      `)
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  }, [userId]);

  const loadUserData = useCallback(async (forceRefresh = false) => {
    if (!userId) {
      setUserData(null);
      setLoading(false);
      return;
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    const cacheKey = CACHE_KEYS.USER_DATA(userId);

    try {
      // 1. Verificar cache primeiro (se não for refresh forçado)
      if (!forceRefresh) {
        const cached = await getCache<Usuario>(cacheKey);
        if (cached !== null && mountedRef.current) {
          setUserData(cached);
          setFromCache(true);
          setLoading(false);
          // Continua para revalidar em background (SWR)
        }
      }

      // 2. Buscar dados frescos
      const freshData = await fetchUserData();

      if (freshData && mountedRef.current) {
        setUserData(freshData);
        setFromCache(false);
        await setCache(cacheKey, freshData, CACHE_TTL.USER_DATA);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      if (mountedRef.current && !userData) {
        setUserData(null);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      fetchingRef.current = false;
    }
  // userData omitido intencionalmente para evitar loop infinito
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, fetchUserData]);

  // Carregar dados quando userId mudar
  useEffect(() => {
    mountedRef.current = true;
    loadUserData();

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Invalidar cache quando logout
  useEffect(() => {
    if (!userId && userData) {
      clearCache(CACHE_KEYS.USER_DATA(userData.id));
    }
  }, [userId, userData]);

  // Verificar se tem múltiplas unidades
  const vinculacoes = userData?.usuario_unidades?.filter(v => v.ativo) || [];
  const temMultiplasUnidades = vinculacoes.length > 1;

  // Refresh forçando busca na API (ignorando cache)
  const refresh = useCallback(() => loadUserData(true), [loadUserData]);

  return {
    userData,
    loading,
    fromCache, // ✅ Indica se dados vieram do cache
    isGestor: userData?.papel === 'gestor',
    isMotorista: userData?.papel === 'motorista',
    unidade: userData?.unidades,
    // NOVO: Suporte a múltiplas unidades
    vinculacoes,
    temMultiplasUnidades,
    refresh,
  };
}
