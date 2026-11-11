/**
 * Consulta paginada dos incidentes do gestor.
 *
 * Por que existe: a lista não tinha limite. O PostgREST do Supabase corta a
 * resposta em 1.000 linhas sem erro, então uma loja com mais incidentes que
 * isso via só os mais recentes, e os cartões de resumo contavam o recorte
 * como se fosse o total. Agora:
 *
 * - a lista vem de `TAMANHO_PAGINA_INCIDENTES` em `TAMANHO_PAGINA_INCIDENTES`,
 *   por cursor (`created_at desc, id desc`), sem repetir nem pular quando um
 *   incidente chega entre um "carregar mais" e outro;
 * - o total (`count=exact`) e as contagens por status (HEAD) são da loja
 *   inteira, com os mesmos filtros.
 *
 * Recorte pela LOJA GRAVADA NO INCIDENTE (`unidade_id`, Migration 43), não
 * pelos motoristas da loja nem pela rota: motorista que atende duas lojas
 * levava para esta loja os incidentes da outra.
 */
import { limitesEmInstante, type IntervaloDatas } from '@/lib/periodo';
import { filtroKeysetDesc } from '@/lib/queries/paginacao';
import { supabase } from '@/lib/supabase';

import type { FiltroCategoria, FiltroStatus } from './types';

export const TAMANHO_PAGINA_INCIDENTES = 50;

/** Status que ainda esperam o gestor (o filtro "Pendentes"). */
const STATUS_PENDENTES: string[] = ['aberto', 'em_analise'];

/** max-rows do PostgREST no Supabase: nenhuma resposta passa disso. */
const MAX_LINHAS_POR_REQUISICAO = 1000;

const SELECT_INCIDENTES = `
  id,
  categoria,
  descricao,
  endereco,
  status,
  foto_url,
  created_at,
  observacoes_gestao,
  motorista_id,
  motorista:usuarios!motorista_id (nome),
  rota:rotas (id, data),
  parada:paradas (endereco)`;

/** Timestamp como o PostgREST devolve (`2026-10-24T10:00:00.123+00:00`). */
const FORMATO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}[T ][\d:.]+(Z|[+-]\d{2}(:?\d{2})?)?$/;

export interface FiltrosIncidentes {
  unidadeId: string;
  status: FiltroStatus;
  categoria: FiltroCategoria;
  /** Período do `created_at` (datas locais; `de`/`ate` nulos = sem limite). */
  periodo: IntervaloDatas;
}

export interface CursorIncidentes {
  created_at: string;
  id: string;
}

export interface LinhaIncidente {
  id: string;
  categoria: string;
  descricao: string;
  endereco: string;
  status: string;
  foto_url: string | null;
  created_at: string;
  observacoes_gestao: string | null;
  // NULL desde a Migration 56: motorista excluído (incidente anonimizado).
  motorista_id: string | null;
  motorista: { nome: string } | null;
  rota: { id: string; data: string } | null;
  parada: { endereco: string } | null;
}

function consultaDeIncidentes(
  colunas: string,
  opcoes: { count?: 'exact'; head?: boolean },
) {
  return supabase.from('incidentes').select(colunas, opcoes);
}
type ConsultaIncidentes = ReturnType<typeof consultaDeIncidentes>;

function aplicarFiltros(
  consulta: ConsultaIncidentes,
  filtros: FiltrosIncidentes,
): ConsultaIncidentes {
  let q = consulta.eq('unidade_id', filtros.unidadeId);
  if (filtros.status === 'pendentes') q = q.in('status', STATUS_PENDENTES);
  else if (filtros.status !== 'todos') q = q.eq('status', filtros.status);
  if (filtros.categoria !== 'todos') q = q.eq('categoria', filtros.categoria);
  const { desde, antesDe } = limitesEmInstante(filtros.periodo);
  if (desde) q = q.gte('created_at', desde);
  if (antesDe) q = q.lt('created_at', antesDe);
  return q;
}

/**
 * Incidentes pendentes (aberto ou em análise) criados ANTES do período, que
 * a lista do período não mostra. `de` é a data local do início do período.
 */
export async function contarPendentesAntesDoPeriodo(
  unidadeId: string,
  categoria: string | null,
  de: string,
): Promise<number> {
  const { desde } = limitesEmInstante({ de, ate: null });
  if (!desde) return 0;
  let q = consultaDeIncidentes('id', { count: 'exact', head: true })
    .eq('unidade_id', unidadeId)
    .in('status', STATUS_PENDENTES)
    .lt('created_at', desde);
  if (categoria) q = q.eq('categoria', categoria);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

/**
 * Até `quantidade` incidentes, dos mais recentes para os mais antigos,
 * começando depois de `cursor`. `contar` pede o total na 1ª requisição.
 */
export async function buscarIncidentes({
  filtros,
  quantidade,
  cursor,
  contar = false,
}: {
  filtros: FiltrosIncidentes;
  quantidade: number;
  cursor?: CursorIncidentes;
  contar?: boolean;
}): Promise<{ linhas: LinhaIncidente[]; total: number | null }> {
  const linhas: LinhaIncidente[] = [];
  let total: number | null = null;
  let depoisDe = cursor;
  let primeira = true;

  while (linhas.length < quantidade) {
    const tamanho = Math.min(
      quantidade - linhas.length,
      MAX_LINHAS_POR_REQUISICAO,
    );
    let consulta = aplicarFiltros(
      consultaDeIncidentes(
        SELECT_INCIDENTES,
        contar && primeira ? { count: 'exact' } : {},
      ),
      filtros,
    );
    if (depoisDe) {
      consulta = consulta.or(
        filtroKeysetDesc(
          'created_at',
          depoisDe.created_at,
          depoisDe.id,
          FORMATO_TIMESTAMP,
        ),
      );
    }
    const { data, error, count } = await consulta
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(tamanho)
      // `select` com embeds renomeados: o tipo vem de `.returns<>()`.
      .returns<LinhaIncidente[]>();
    if (error) throw error;
    if (primeira) total = contar ? (count ?? null) : null;
    primeira = false;

    const pagina = data ?? [];
    linhas.push(...pagina);
    if (pagina.length < tamanho) break;
    const ultima = pagina[pagina.length - 1];
    depoisDe = { created_at: ultima.created_at, id: ultima.id };
  }

  return { linhas, total };
}

export interface ContagemIncidentesPorStatus {
  aberto: number;
  em_analise: number;
  resolvido: number;
  fechado: number;
}

const STATUS_CONTADOS = [
  'aberto',
  'em_analise',
  'resolvido',
  'fechado',
] as const;

/** Contagem por status da loja inteira, com os mesmos filtros (HEAD). */
export async function contarIncidentesPorStatus(
  filtros: FiltrosIncidentes,
): Promise<ContagemIncidentesPorStatus> {
  const contagens = await Promise.all(
    STATUS_CONTADOS.map(async (status) => {
      const fora =
        filtros.status === 'pendentes'
          ? !STATUS_PENDENTES.includes(status)
          : filtros.status !== 'todos' && filtros.status !== status;
      if (fora) return 0;
      const { count, error } = await aplicarFiltros(
        consultaDeIncidentes('id', { count: 'exact', head: true }),
        { ...filtros, status },
      );
      if (error) throw error;
      return count ?? 0;
    }),
  );
  return {
    aberto: contagens[0],
    em_analise: contagens[1],
    resolvido: contagens[2],
    fechado: contagens[3],
  };
}
