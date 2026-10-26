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

  // Contador de requisição: toda carga roda e só a MAIS RECENTE escreve no
  // estado (mesma regra do `useCachedData`). Antes, um `fetchingRef`
  // descartava a carga da loja nova enquanto a da anterior estava em voo, e a
  // resposta atrasada da anterior ainda sobrescrevia a lista.
  const requisicaoRef = useRef(0);
  // Loja da última carga iniciada: se mudou, a lista na tela é da OUTRA loja.
  const lojaDaCargaRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const loadMotoristasRef = useRef<(forceRefresh?: boolean) => Promise<void>>(
    async () => {},
  );

  const fetchMotoristas = useCallback(async (): Promise<Motorista[]> => {
    if (!unidadeAtiva) return [];

    // Buscar motoristas vinculados à unidade via usuario_unidades
    const { data: vinculacoes, error: vinculacoesError } = await supabase
      .from('usuario_unidades')
      .select(
        `
        usuario_id,
        usuarios!inner(id, nome, email, telefone, ativo)
      `,
      )
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

  const loadMotoristas = useCallback(
    async (forceRefresh = false) => {
      const minha = ++requisicaoRef.current;
      const vigente = () =>
        mountedRef.current && minha === requisicaoRef.current;

      if (!unidadeAtiva) {
        lojaDaCargaRef.current = null;
        setMotoristas([]);
        setLoading(false);
        return;
      }

      // Loja trocada: os motoristas da anterior saem da tela e o carregamento
      // volta (ou o cache da loja nova, logo abaixo).
      if (lojaDaCargaRef.current !== unidadeAtiva) {
        if (lojaDaCargaRef.current !== null) {
          setMotoristas([]);
          setFromCache(false);
          setLoading(true);
        }
        lojaDaCargaRef.current = unidadeAtiva;
      }

      const cacheKey = CACHE_KEYS.MOTORISTAS(unidadeAtiva);

      try {
        // 1. Verificar cache primeiro
        if (!forceRefresh) {
          const cached = await getCache<Motorista[]>(cacheKey);
          if (cached !== null && vigente()) {
            setMotoristas(cached);
            setFromCache(true);
            setLoading(false);
            // Continua para revalidar em background (SWR)
          }
        }

        // 2. Buscar dados frescos
        const freshData = await fetchMotoristas();

        if (mountedRef.current) {
          // O cache é por loja: a resposta atrasada ainda é válida para a chave
          // dela, só não pode entrar na tela da loja atual.
          await setCache(cacheKey, freshData, CACHE_TTL.MOTORISTAS);
        }
        if (vigente()) {
          setMotoristas(freshData);
          setFromCache(false);
        }
      } catch (error) {
        // A lista fica como está: vazia (loja trocada) ou o cache já mostrado.
        logger.error('[useMotoristas] Erro ao carregar:', error);
      } finally {
        // Só a carga mais recente encerra o carregamento.
        if (vigente()) {
          setLoading(false);
        }
      }
    },
    [unidadeAtiva, fetchMotoristas],
  );

  // Sync ref with latest loadMotoristas function
  useEffect(() => {
    loadMotoristasRef.current = loadMotoristas;
  }, [loadMotoristas]);

  // Carregar quando unidade mudar - uses ref to avoid re-execution when loadMotoristas changes
  useEffect(() => {
    mountedRef.current = true;
    loadMotoristasRef.current();

    return () => {
      mountedRef.current = false;
    };
  }, [unidadeAtiva]);

  // Refresh forçando busca na API
  const refresh = useCallback(async () => {
    await loadMotoristas(true);
  }, [loadMotoristas]);

  // Helper para buscar motorista por ID
  const getMotoristaById = useCallback(
    (id: string): Motorista | undefined => {
      return motoristas.find((m) => m.id === id);
    },
    [motoristas],
  );

  return {
    motoristas,
    loading,
    fromCache,
    refresh,
    getMotoristaById,
  };
}
