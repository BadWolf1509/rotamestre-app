/**
 * Hook para gerenciar lista de motoristas com cache
 * Evita múltiplas requisições à API quando navegando entre telas
 */

import { useCallback, useEffect, useState, useRef } from 'react';

import { getCache, setCache, CACHE_TTL, CACHE_KEYS } from '@/lib/cache';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import { useUnidadeAtiva } from './useUnidadeAtiva';

export interface Motorista {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  ativo?: boolean;
}

interface UseMotoristaResult {
  motoristas: Motorista[];
  loading: boolean;
  fromCache: boolean;
  refresh: () => Promise<void>;
  getMotoristaById: (id: string) => Motorista | undefined;
}

export function useMotoristas(): UseMotoristaResult {
  const { unidadeAtiva } = useUnidadeAtiva();
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchMotoristas = useCallback(async (): Promise<Motorista[]> => {
    if (!unidadeAtiva) return [];

    // Buscar motoristas vinculados à unidade via usuario_unidades
    const { data: vinculacoes, error: vinculacoesError } = await supabase
      .from('usuario_unidades')
      .select(`
        usuario_id,
        usuarios!inner(id, nome, email, telefone, ativo)
      `)
      .eq('unidade_id', unidadeAtiva)
      .eq('papel', 'motorista')
      .eq('ativo', true);

    if (vinculacoesError) throw vinculacoesError;

    // Extrair dados dos motoristas
    const motoristasData = (vinculacoes || []).map((v: any) => ({
      id: v.usuarios.id,
      nome: v.usuarios.nome,
      email: v.usuarios.email,
      telefone: v.usuarios.telefone,
      ativo: v.usuarios.ativo,
    }));

    // Ordenar por nome
    return motoristasData.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [unidadeAtiva]);

  const loadMotoristas = useCallback(async (forceRefresh = false) => {
    if (!unidadeAtiva) {
      setMotoristas([]);
      setLoading(false);
      return;
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    const cacheKey = CACHE_KEYS.MOTORISTAS(unidadeAtiva);

    try {
      // 1. Verificar cache primeiro
      if (!forceRefresh) {
        const cached = await getCache<Motorista[]>(cacheKey);
        if (cached !== null && mountedRef.current) {
          setMotoristas(cached);
          setFromCache(true);
          setLoading(false);
          // Continua para revalidar em background (SWR)
        }
      }

      // 2. Buscar dados frescos
      const freshData = await fetchMotoristas();

      if (mountedRef.current) {
        setMotoristas(freshData);
        setFromCache(false);
        await setCache(cacheKey, freshData, CACHE_TTL.MOTORISTAS);
      }
    } catch (error) {
      logger.error('[useMotoristas] Erro ao carregar:', error);
      if (mountedRef.current && motoristas.length === 0) {
        setMotoristas([]);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      fetchingRef.current = false;
    }
  }, [unidadeAtiva, fetchMotoristas, motoristas.length]);

  // Carregar quando unidade mudar
  useEffect(() => {
    mountedRef.current = true;
    loadMotoristas();

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeAtiva]);

  // Refresh forçando busca na API
  const refresh = useCallback(async () => {
    await loadMotoristas(true);
  }, [loadMotoristas]);

  // Helper para buscar motorista por ID
  const getMotoristaById = useCallback((id: string): Motorista | undefined => {
    return motoristas.find(m => m.id === id);
  }, [motoristas]);

  return {
    motoristas,
    loading,
    fromCache,
    refresh,
    getMotoristaById,
  };
}
