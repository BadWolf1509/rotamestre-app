/**
 * Hook para a lista de motoristas da loja ativa, com cache SWR (`useCachedData`,
 * chave por loja: trocar de loja não mostra a lista da anterior nem deixa a
 * resposta velha sobrescrever a nova).
 *
 * Serve ao FILTRO de rotas (Início): basta o vínculo ativo na loja, porque quem
 * teve a conta desativada ainda tem rotas antigas para filtrar. Para ATRIBUIR
 * motorista a uma rota, use `buscarMotoristasAtivosDaLoja` com o padrão (exige
 * também o cadastro ativo).
 */

import { useCallback, useMemo } from 'react';

import { CACHE_TTL, CACHE_KEYS } from '@/lib/cache';
import { buscarMotoristasAtivosDaLoja } from '@/lib/gestor/motoristasDaLoja';
import { logger } from '@/lib/logger';

import { useCachedData } from './useCachedData';
import { useUnidadeAtiva } from './useUnidadeAtiva';

interface Motorista {
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

  const fetchMotoristas = useCallback(async (): Promise<Motorista[]> => {
    if (!unidadeAtiva) return [];
    try {
      const doBanco = await buscarMotoristasAtivosDaLoja(unidadeAtiva, {
        incluirCadastroInativo: true,
      });
      return doBanco.map((m) => ({
        id: m.id,
        nome: m.nome,
        email: m.email,
        telefone: m.telefone ?? undefined,
        ativo: m.ativo,
      }));
    } catch (error) {
      logger.error('[useMotoristas] Erro ao carregar:', error);
      throw error;
    }
  }, [unidadeAtiva]);

  const { data, loading, error, isStale, refresh } = useCachedData<Motorista[]>(
    CACHE_KEYS.MOTORISTAS(unidadeAtiva ?? ''),
    fetchMotoristas,
    { ttl: CACHE_TTL.MOTORISTAS, enabled: !!unidadeAtiva },
  );

  const motoristas = useMemo(() => data ?? [], [data]);

  const getMotoristaById = useCallback(
    (id: string): Motorista | undefined => motoristas.find((m) => m.id === id),
    [motoristas],
  );

  return {
    motoristas,
    // Sem dado e sem erro é "ainda carregando": entre a troca de loja e o
    // início da carga do `useCachedData` o `loading` dele ainda é false.
    loading: !!unidadeAtiva && (loading || (data === null && !error)),
    fromCache: isStale,
    refresh,
    getMotoristaById,
  };
}
