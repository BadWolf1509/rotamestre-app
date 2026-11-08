/**
 * Performance de um motorista para o perfil do gestor, na loja aberta.
 *
 * Vem da RPC `desempenho_motorista_na_loja` (Migration 89), com as fórmulas
 * da `vw_performance_motoristas` mas contando só as rotas da loja pedida. A
 * view somava as rotas de todas as lojas que o RLS deixasse ver: o motorista
 * que atende duas lojas aparecia com as duas somadas. A RPC só responde a
 * gestor ativo da loja; recusa (`code`), erro, resposta fora do formato ou
 * loja ainda não carregada viram "sem dados" — zeros e taxa nula, que a tela
 * mostra como "—", nunca um número inventado. Sem fallback para a view.
 */
import type { MotoristaPerformance } from '@/components/gestor/motorista-perfil/types';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

function semDados(
  id: string,
  nome: string,
  unidadeId: string | null,
): MotoristaPerformance {
  return {
    id,
    nome,
    unidade_id: unidadeId ?? '',
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

type Resposta = Record<string, unknown>;

function ehObjeto(valor: unknown): valor is Resposta {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function contagem(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function numeroOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export async function buscarPerformanceMotorista(
  motoristaId: string,
  nome: string,
  unidadeId: string | null,
): Promise<MotoristaPerformance> {
  // Sem loja aberta não há escopo: não consulta (fail-closed).
  if (!unidadeId) return semDados(motoristaId, nome, unidadeId);

  const { data, error } = await supabase.rpc('desempenho_motorista_na_loja', {
    p_motorista_id: motoristaId,
    p_unidade_id: unidadeId,
  });

  if (error) {
    logger.warn('[performanceMotorista] RPC falhou', error);
    return semDados(motoristaId, nome, unidadeId);
  }
  if (!ehObjeto(data) || data.success !== true) {
    logger.warn(
      '[performanceMotorista] RPC recusou',
      ehObjeto(data) ? data.code : data,
    );
    return semDados(motoristaId, nome, unidadeId);
  }

  return {
    id: motoristaId,
    nome,
    unidade_id: unidadeId,
    unidade_nome: '',
    total_rotas: contagem(data.total_rotas),
    rotas_concluidas: contagem(data.rotas_concluidas),
    rotas_em_andamento: contagem(data.rotas_em_andamento),
    rotas_nao_executadas: contagem(data.rotas_nao_executadas),
    rotas_canceladas: contagem(data.rotas_canceladas),
    taxa_execucao: numeroOuNulo(data.taxa_execucao),
    distancia_total_km: numeroOuNulo(data.distancia_total_km),
    tempo_medio_minutos: numeroOuNulo(data.tempo_medio_minutos),
  };
}
