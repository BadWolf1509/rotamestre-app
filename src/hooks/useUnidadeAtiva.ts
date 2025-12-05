import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { useUser } from './useUser';
import { supabase } from '../lib/supabase';
import { UsuarioUnidade, UnidadeDB } from '../types/usuario';

const STORAGE_KEY = '@rotamestre:unidade_ativa';

type VinculacaoComUnidade = UsuarioUnidade & {
  unidades: UnidadeDB | UnidadeDB[] | null;
};

interface UseUnidadeAtivaReturn {
  /** ID da unidade ativa atual */
  unidadeAtiva: string | null;
  /** Dados completos da unidade ativa */
  unidadeAtivaData: UnidadeDB | null;
  /** Todas as vinculações do usuário com unidades */
  vinculacoes: UsuarioUnidade[];
  /** Se o usuário tem múltiplas unidades */
  temMultiplasUnidades: boolean;
  /** Papel do usuário na unidade ativa */
  papelNaUnidadeAtiva: 'gestor' | 'motorista' | null;
  /** Se está carregando */
  loading: boolean;
  /** Trocar para outra unidade */
  trocarUnidade: (unidadeId: string) => Promise<void>;
  /** Recarregar vinculações */
  refresh: () => Promise<void>;
}

/**
 * Hook para gerenciar a unidade ativa do usuário
 * Permite que usuários com múltiplas unidades troquem entre elas
 */
export function useUnidadeAtiva(): UseUnidadeAtivaReturn {
  const { userData, refresh: refreshUser } = useUser();
  const [unidadeAtiva, setUnidadeAtiva] = useState<string | null>(null);
  const [vinculacoes, setVinculacoes] = useState<UsuarioUnidade[]>([]);
  const [loading, setLoading] = useState(true);

  // Carregar vinculações do usuário
  const loadVinculacoes = useCallback(async () => {
    if (!userData?.id) {
      setVinculacoes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('usuario_unidades')
        .select(`
          id,
          usuario_id,
          unidade_id,
          papel,
          is_principal,
          ativo,
          created_at,
          unidades (
            id,
            nome,
            cnpj,
            cidade,
            endereco,
            telefone,
            email,
            ativa,
            created_at,
            updated_at
          )
        `)
        .eq('usuario_id', userData.id)
        .eq('ativo', true)
        .order('created_at', { ascending: true })
        .returns<VinculacaoComUnidade[]>();

      if (error) {
        console.error('Erro ao carregar vinculações:', error);
        // Fallback: usar unidade_id do usuário se existir
        if (userData.unidade_id) {
          setUnidadeAtiva(userData.unidade_id);
        }
        return;
      }

      const vinculacoesNormalizadas = (data || []).map((vinculo) => ({
        ...vinculo,
        unidades: Array.isArray(vinculo.unidades) ? vinculo.unidades[0] : vinculo.unidades,
      }));

      setVinculacoes(vinculacoesNormalizadas);

      // Determinar unidade ativa
      if (vinculacoesNormalizadas.length > 0) {
        // Tentar recuperar do AsyncStorage
        const storedUnidadeId = await AsyncStorage.getItem(STORAGE_KEY);

        // Verificar se a unidade armazenada ainda é válida
        const unidadeValida = vinculacoesNormalizadas.find(
          (v) => v.unidade_id === storedUnidadeId
        );

        if (unidadeValida) {
          setUnidadeAtiva(storedUnidadeId);
        } else {
          // Usar a primeira unidade disponível ou a que tem is_principal
          const principal = vinculacoesNormalizadas.find((v) => v.is_principal);
          const primeiraUnidade = principal || vinculacoesNormalizadas[0];
          setUnidadeAtiva(primeiraUnidade.unidade_id);
          await AsyncStorage.setItem(STORAGE_KEY, primeiraUnidade.unidade_id);
        }
      } else {
        // Fallback para unidade_id legado
        if (userData.unidade_id) {
          setUnidadeAtiva(userData.unidade_id);
          await AsyncStorage.setItem(STORAGE_KEY, userData.unidade_id);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar vinculações:', error);
      // Fallback
      if (userData?.unidade_id) {
        setUnidadeAtiva(userData.unidade_id);
      }
    } finally {
      setLoading(false);
    }
  }, [userData?.id, userData?.unidade_id]);

  // Trocar de unidade ativa
  const trocarUnidade = useCallback(async (unidadeId: string) => {
    if (!userData?.id) return;

    // Verificar se o usuário tem acesso a essa unidade
    const temAcesso = vinculacoes.some(v => v.unidade_id === unidadeId);
    if (!temAcesso) {
      console.error('Usuário não tem acesso a essa unidade');
      return;
    }

    try {
      // Salvar no AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, unidadeId);

      // Atualizar o cache no banco (usuarios.unidade_id)
      const { error } = await supabase
        .from('usuarios')
        .update({ unidade_id: unidadeId })
        .eq('id', userData.id);

      if (error) {
        console.error('Erro ao atualizar unidade ativa no banco:', error);
      }

      // Atualizar estado local
      setUnidadeAtiva(unidadeId);

      // Recarregar dados do usuário para refletir a mudança
      await refreshUser();
    } catch (error) {
      console.error('Erro ao trocar unidade:', error);
    }
  }, [userData?.id, vinculacoes, refreshUser]);

  // Carregar vinculações quando userData mudar
  useEffect(() => {
    loadVinculacoes();
  }, [loadVinculacoes]);

  // Derivar dados da unidade ativa
  const vinculacaoAtiva = vinculacoes.find(v => v.unidade_id === unidadeAtiva);
  const unidadeAtivaData = vinculacaoAtiva?.unidades || userData?.unidades || null;
  const papelNaUnidadeAtiva = vinculacaoAtiva?.papel || userData?.papel || null;
  const temMultiplasUnidades = vinculacoes.length > 1;

  return {
    unidadeAtiva,
    unidadeAtivaData,
    vinculacoes,
    temMultiplasUnidades,
    papelNaUnidadeAtiva,
    loading,
    trocarUnidade,
    refresh: loadVinculacoes,
  };
}
