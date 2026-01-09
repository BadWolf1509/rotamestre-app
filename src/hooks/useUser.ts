import { useCallback, useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';

import { useAuth } from './useAuth';
import { getCache, setCache, clearCache, CACHE_TTL, CACHE_KEYS } from '../lib/cache';
import { logger } from '../lib/logger';
import { initializePushNotifications } from '../lib/notifications';
import { onProfileUpdate } from '../lib/profileEvents';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Usuario } from '../types/usuario';

// Mock user data storage for E2E/CI environments
let mockUserData: Usuario | null = null;

// Export function to set mock user data (called after login)
export function setMockUserData(user: Usuario | null) {
  mockUserData = user;
}

export function useUser() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [userData, setUserData] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchUserData = useCallback(async (): Promise<Usuario | null> => {
    if (!userId) return null;

    // For E2E/CI: Return mock user data
    if (!isSupabaseConfigured) {
      const isGestor = userId.includes('gestor');
      const mockUnidadeId = 'mock-unidade-id';

      return {
        id: userId,
        email: isGestor ? 'gestor.test@rotamestre.tec.br' : 'motorista.test@rotamestre.tec.br',
        nome: isGestor ? 'Gestor Teste' : 'Motorista Teste',
        papel: isGestor ? 'gestor' : 'motorista',
        ativo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        unidade_id: mockUnidadeId,
        unidades: {
          id: mockUnidadeId,
          nome: 'Unidade Teste',
          cidade: 'São Paulo',
          ativa: true,
          sede_latitude: -23.5505,
          sede_longitude: -46.6333,
        } as any,
        usuario_unidades: [{
          id: 'vinculo-mock-1',
          usuario_id: userId,
          unidade_id: mockUnidadeId,
          papel: isGestor ? 'gestor' : 'motorista',
          is_principal: true,
          ativo: true,
          created_at: new Date().toISOString(),
          unidades: {
            id: mockUnidadeId,
            nome: 'Unidade Teste',
            cidade: 'São Paulo',
            ativa: true,
          }
        }]
      } as Usuario;
    }

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
    // Aguardar auth estar pronto antes de fazer queries (evita 406)
    if (authLoading) return;

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
      // IMPORTANTE: Não definir loading=false do cache para evitar que
      // outros componentes façam queries antes da sessão Supabase estar validada
      if (!forceRefresh) {
        const cached = await getCache<Usuario>(cacheKey);
        if (cached !== null && mountedRef.current) {
          setUserData(cached);
          setFromCache(true);
          // NÃO definir loading=false aqui - aguardar query Supabase validar sessão
        }
      }

      // 2. Buscar dados frescos (valida que a sessão Supabase está funcionando)
      const freshData = await fetchUserData();

      if (freshData && mountedRef.current) {
        setUserData(freshData);
        setFromCache(false);
        await setCache(cacheKey, freshData, CACHE_TTL.USER_DATA);
      }
    } catch (error) {
      logger.error('Error loading user data:', error);
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
  }, [authLoading, userId, fetchUserData]);

  // Carregar dados quando userId ou authLoading mudar
  useEffect(() => {
    mountedRef.current = true;
    loadUserData();

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userId]);

  // Invalidar cache quando logout
  useEffect(() => {
    if (!userId && userData) {
      clearCache(CACHE_KEYS.USER_DATA(userData.id));
    }
  }, [userId, userData]);

  // Registrar push token quando usuário carregar (mobile only)
  const pushTokenRegistered = useRef(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Registrar token quando usuário estiver carregado
    if (userData?.id && !pushTokenRegistered.current) {
      pushTokenRegistered.current = true;
      initializePushNotifications(userData.id).catch((error) => {
        logger.error('[Push] Erro ao inicializar push:', error);
      });
    }

    // Remover token quando logout
    if (!userId && pushTokenRegistered.current) {
      pushTokenRegistered.current = false;
      // Nota: unregisterPushToken precisa do userId, então usamos o último userData
      // Isso é handled no signOut do useAuth
    }
  }, [userData?.id, userId]);

  // Verificar se tem múltiplas unidades
  const vinculacoes = userData?.usuario_unidades?.filter(v => v.ativo) || [];
  const temMultiplasUnidades = vinculacoes.length > 1;

  // Refresh forçando busca na API (ignorando cache)
  const refresh = useCallback(() => loadUserData(true), [loadUserData]);

  // Escutar eventos de atualização de perfil (ex: foto alterada)
  useEffect(() => {
    const unsubscribe = onProfileUpdate(() => {
      logger.info('[useUser] Perfil atualizado, recarregando dados...');
      loadUserData(true);
    });
    return unsubscribe;
  }, [loadUserData]);

  return {
    userData,
    loading: authLoading || loading, // ✅ Inclui authLoading para evitar queries prematuras
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
