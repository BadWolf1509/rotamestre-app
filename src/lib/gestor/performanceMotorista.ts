/**
 * Performance de um motorista para o perfil do gestor.
 *
 * A `vw_performance_motoristas` filtra `usuarios.ativo = true`, então
 * motorista inativo não tem linha. Era `.single()`: sem linha, o PostgREST
 * responde 406 (PGRST116) e o fallback inventava "100%" de execução. Agora
 * `.maybeSingle()`, e sem linha (ou com erro) a taxa vem nula — a tela
 * mostra "—".
 */
import type { MotoristaPerformance } from '@/components/gestor/motorista-perfil/types';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

function semDados(id: string, nome: string): MotoristaPerformance {
  return {
    id,
    nome,
    unidade_id: '',
    unidade_nome: '',
    total_rotas: 0,
    rotas_concluidas: 0,
    rotas_em_andamento: 0,
    rotas_nao_executadas: 0,
    rotas_canceladas: 0,
    taxa_execucao: null,
    distancia_total_km: null,
    tempo_medio_minutos: null,
  };
}

export async function buscarPerformanceMotorista(
  motoristaId: string,
  nome: string,
): Promise<MotoristaPerformance> {
  const { data, error } = await supabase
    .from('vw_performance_motoristas')
    .select('*')
    .eq('id', motoristaId)
    .maybeSingle();

  if (error) {
    logger.warn('[performanceMotorista] view falhou', error);
    return semDados(motoristaId, nome);
  }
  return (data as MotoristaPerformance | null) ?? semDados(motoristaId, nome);
}
