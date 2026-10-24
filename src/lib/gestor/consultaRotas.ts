/**
 * Consulta da Gestão de Rotas no servidor.
 *
 * Por que existe: a tela buscava `.limit(100)` e filtrava/buscava/exportava
 * no cliente — numa loja com mais de 100 rotas, a busca não achava rota
 * antiga, o filtro mentia a contagem e o CSV/XLSX saía com só 100 linhas,
 * tudo sem aviso. Agora:
 *
 * - **Busca e filtro vão ao servidor** (`interpretarBusca`): texto busca o
 *   nome do motorista (`ilike` escapado, embed com `!inner` para recortar a
 *   rota); `dd/mm/aaaa`, `dd/mm`, `mm/aaaa` e `aaaa` viram filtro na coluna
 *   `data` (`in`/intervalo). `rotas.data` é `date`: nada aqui passa por
 *   `new Date()`, as datas são montadas como texto `AAAA-MM-DD`.
 * - **Paginação estável por cursor**: `data desc, id desc`, e a página
 *   seguinte começa depois da última linha (keyset). OFFSET repetia ou pulava
 *   rota quando outra era criada ou excluída entre um clique e outro.
 * - **Total da loja** (`count=exact`) só na primeira página, para a tela dizer
 *   "mostrando 100 de 437".
 * - **Tudo em páginas** (`buscarRotas` com `quantidade` grande): o PostgREST
 *   do Supabase corta qualquer resposta em 1.000 linhas, sem erro; cada
 *   requisição pede no máximo isso e segue pelo cursor até acabar ou bater na
 *   quantidade pedida, avisando o progresso.
 */
import type { RotaHistorico } from '@/hooks/gestao-rotas/types';
import { formatarDecimal } from '@/lib/formatNumber';
import { contarParadasDasRotas } from '@/lib/gestor/contarParadasDasRotas';
import { escaparIlike, filtroKeysetDesc } from '@/lib/queries/paginacao';
import type { FiltroStatus, RotaStatus } from '@/lib/statusLabels';
import { supabase } from '@/lib/supabase';

export { escaparIlike };

/** Rotas por página da lista ("carregar mais"). */
export const TAMANHO_PAGINA_ROTAS = 100;

/** max-rows do PostgREST no Supabase: nenhuma resposta passa disso. */
const MAX_LINHAS_POR_REQUISICAO = 1000;

/**
 * Teto de segurança da exportação. Cada 1.000 rotas custam 1 requisição de
 * rotas e ~20 de contagem de paradas (lotes de 50 ids); 10.000 rotas são
 * ~210 requisições e alguns MB na memória do aparelho — o limite do que dá
 * para fazer num celular sem travar. A maior loja tinha poucas centenas de
 * rotas em 24/10/2026. Acima do teto exporta as mais recentes e avisa.
 */
export const TETO_EXPORTACAO_ROTAS = 10_000;

/** Primeiro ano procurado quando a busca é `dd/mm` sem ano. */
export const ANO_INICIAL_BUSCA = 2024;

const COLUNAS =
  'id, data, status, distancia_total, iniciada_em, concluida_em, motorista_id';
const EMBED_MOTORISTA = 'usuarios!rotas_motorista_id_fkey';
const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

export interface FiltrosRotas {
  unidadeId: string;
  status: FiltroStatus;
  /** Texto como o gestor digitou (já com debounce). */
  busca: string;
}

export interface CursorRotas {
  data: string;
  id: string;
}

export type BuscaRotas =
  | { tipo: 'nenhuma' }
  | { tipo: 'nome'; padrao: string }
  | { tipo: 'datas'; datas: string[] }
  /** `de` inclusivo, `ate` exclusivo. */
  | { tipo: 'intervalo'; de: string; ate: string }
  /** Data que não existe (31/02): nada a buscar. */
  | { tipo: 'impossivel' };

function bissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

function diasNoMes(ano: number, mes: number): number {
  if (mes === 2) return bissexto(ano) ? 29 : 28;
  return [4, 6, 9, 11].includes(mes) ? 30 : 31;
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');

function dataISO(ano: number, mes: number, dia: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasNoMes(ano, mes)) return null;
  return `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
}

function inicioDoMes(ano: number, mes: number): string {
  return `${ano}-${doisDigitos(mes)}-01`;
}

/**
 * O que o gestor digitou → filtro no servidor. `anoAtual` limita a janela do
 * `dd/mm` (de `ANO_INICIAL_BUSCA` até o ano que vem, para rota agendada).
 */
export function interpretarBusca(termo: string, anoAtual: number): BuscaRotas {
  const t = termo.trim();
  if (!t) return { tipo: 'nenhuma' };

  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const iso = dataISO(Number(m[3]), Number(m[2]), Number(m[1]));
    return iso ? { tipo: 'datas', datas: [iso] } : { tipo: 'impossivel' };
  }

  m = t.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mes = Number(m[1]);
    const ano = Number(m[2]);
    if (mes < 1 || mes > 12) return { tipo: 'impossivel' };
    return {
      tipo: 'intervalo',
      de: inicioDoMes(ano, mes),
      ate: mes === 12 ? inicioDoMes(ano + 1, 1) : inicioDoMes(ano, mes + 1),
    };
  }

  m = t.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    const datas: string[] = [];
    for (let ano = ANO_INICIAL_BUSCA; ano <= anoAtual + 1; ano++) {
      const iso = dataISO(ano, Number(m[2]), Number(m[1]));
      if (iso) datas.push(iso);
    }
    return datas.length ? { tipo: 'datas', datas } : { tipo: 'impossivel' };
  }

  if (/^\d{4}$/.test(t)) {
    const ano = Number(t);
    return {
      tipo: 'intervalo',
      de: inicioDoMes(ano, 1),
      ate: inicioDoMes(ano + 1, 1),
    };
  }

  return { tipo: 'nome', padrao: `%${escaparIlike(t)}%` };
}

/** Filtro da página seguinte (`data desc, id desc`). */
export function filtroDepoisDoCursor(cursor: CursorRotas): string {
  return filtroKeysetDesc('data', cursor.data, cursor.id, FORMATO_DATA);
}

function anoAtual(): number {
  // Só o ano, para a janela do `dd/mm`; o fuso não muda o resultado útil.
  return new Date().getFullYear();
}

function selectPara(busca: BuscaRotas, colunas: string): string {
  // `!inner`: sem ele, o filtro no nome só esvazia o embed e a rota de
  // outro motorista continua na lista.
  return busca.tipo === 'nome'
    ? `${colunas}, ${EMBED_MOTORISTA}!inner(id, nome)`
    : `${colunas}, ${EMBED_MOTORISTA}(id, nome)`;
}

function consultaDeRotas(
  colunas: string,
  opcoes: { count?: 'exact'; head?: boolean },
) {
  return supabase.from('rotas').select(colunas, opcoes);
}
type ConsultaRotas = ReturnType<typeof consultaDeRotas>;

function aplicarFiltros(
  consulta: ConsultaRotas,
  filtros: FiltrosRotas,
  busca: BuscaRotas,
): ConsultaRotas {
  let q = consulta.eq('unidade_id', filtros.unidadeId);
  if (filtros.status !== 'todas') q = q.eq('status', filtros.status);
  switch (busca.tipo) {
    case 'nome':
      q = q.ilike('usuarios.nome', busca.padrao);
      break;
    case 'datas':
      q = q.in('data', busca.datas);
      break;
    case 'intervalo':
      q = q.gte('data', busca.de).lt('data', busca.ate);
      break;
    default:
      break;
  }
  return q;
}

interface LinhaRota {
  id: string;
  data: string;
  status: RotaStatus;
  distancia_total?: number;
  iniciada_em?: string;
  concluida_em?: string;
  motorista_id?: string;
  usuarios?: { id: string; nome: string } | { id: string; nome: string }[];
}

async function buscarLinhas({
  filtros,
  busca,
  cursor,
  tamanho,
  contar,
  signal,
}: {
  filtros: FiltrosRotas;
  busca: BuscaRotas;
  cursor?: CursorRotas;
  tamanho: number;
  contar: boolean;
  signal?: AbortSignal;
}): Promise<{ linhas: LinhaRota[]; total: number | null }> {
  let consulta = aplicarFiltros(
    consultaDeRotas(
      selectPara(busca, COLUNAS),
      contar ? { count: 'exact' } : {},
    ),
    filtros,
    busca,
  );
  if (cursor) consulta = consulta.or(filtroDepoisDoCursor(cursor));
  consulta = consulta
    .order('data', { ascending: false })
    .order('id', { ascending: false })
    .limit(Math.min(tamanho, MAX_LINHAS_POR_REQUISICAO));
  if (signal) consulta = consulta.abortSignal(signal);

  // `select` montado em tempo de execução: o tipo da linha vem de
  // `.returns<>()` (a inferência pelo texto do select não se aplica).
  const { data, error, count } = await consulta.returns<LinhaRota[]>();
  if (error) throw error;
  return {
    linhas: data ?? [],
    total: contar ? (count ?? null) : null,
  };
}

async function comParadas(
  linhas: LinhaRota[],
  signal?: AbortSignal,
): Promise<RotaHistorico[]> {
  const paradasPorRota = await contarParadasDasRotas(
    linhas.map((r) => r.id),
    signal,
  );
  return linhas.map((rota) => {
    const motorista = Array.isArray(rota.usuarios)
      ? rota.usuarios[0]
      : rota.usuarios;
    const stats = paradasPorRota.get(rota.id);
    return {
      id: rota.id,
      data: rota.data,
      status: rota.status,
      distancia_total: rota.distancia_total,
      iniciada_em: rota.iniciada_em,
      concluida_em: rota.concluida_em,
      motorista_id: motorista?.id,
      motorista_nome: motorista?.nome,
      paradas_count: stats?.total ?? 0,
      paradas_concluidas: stats?.concluidas ?? 0,
    };
  });
}

/**
 * Até `quantidade` rotas que casam com os filtros, das mais recentes para as
 * mais antigas, começando depois de `cursor` (se houver), com as paradas
 * contadas. `contar` pede o total da loja na primeira requisição.
 * `aoProgredir(carregadas, total)` é chamado depois de cada requisição.
 */
export async function buscarRotas({
  filtros,
  quantidade,
  cursor,
  contar = false,
  signal,
  aoProgredir,
}: {
  filtros: FiltrosRotas;
  quantidade: number;
  cursor?: CursorRotas;
  contar?: boolean;
  signal?: AbortSignal;
  aoProgredir?: (carregadas: number, total: number | null) => void;
}): Promise<{ rotas: RotaHistorico[]; total: number | null }> {
  const busca = interpretarBusca(filtros.busca, anoAtual());
  if (busca.tipo === 'impossivel') {
    return { rotas: [], total: contar ? 0 : null };
  }

  const rotas: RotaHistorico[] = [];
  let total: number | null = null;
  let depoisDe = cursor;
  let primeira = true;

  while (rotas.length < quantidade) {
    const tamanho = Math.min(
      quantidade - rotas.length,
      MAX_LINHAS_POR_REQUISICAO,
    );
    const pagina = await buscarLinhas({
      filtros,
      busca,
      cursor: depoisDe,
      tamanho,
      contar: contar && primeira,
      signal,
    });
    if (primeira) total = pagina.total;
    primeira = false;

    rotas.push(...(await comParadas(pagina.linhas, signal)));
    aoProgredir?.(rotas.length, total);

    // Página incompleta: acabou (o corte de 1.000 do servidor nunca é
    // atingido, porque nenhuma requisição pede mais do que isso).
    if (pagina.linhas.length < tamanho) break;
    const ultima = pagina.linhas[pagina.linhas.length - 1];
    depoisDe = { data: ultima.data, id: ultima.id };
  }

  return { rotas, total };
}

export interface ContagemPorStatus {
  concluidas: number;
  pendentes: number;
}

/**
 * Concluídas e pendentes de TODAS as rotas que casam com a busca (os
 * números do cabeçalho), por `HEAD` com `count=exact`: contar só as rotas
 * carregadas na lista mostraria 100 como se fosse a loja inteira.
 */
export async function contarRotasPorStatus(
  filtros: FiltrosRotas,
  signal?: AbortSignal,
): Promise<ContagemPorStatus> {
  const busca = interpretarBusca(filtros.busca, anoAtual());

  const contar = async (status: RotaStatus): Promise<number> => {
    if (busca.tipo === 'impossivel') return 0;
    if (filtros.status !== 'todas' && filtros.status !== status) return 0;
    let consulta = aplicarFiltros(
      consultaDeRotas(selectPara(busca, 'id'), { count: 'exact', head: true }),
      { ...filtros, status },
      busca,
    );
    if (signal) consulta = consulta.abortSignal(signal);
    const { count, error } = await consulta;
    if (error) throw error;
    return count ?? 0;
  };

  const [concluidas, pendentes] = await Promise.all([
    contar('concluida'),
    contar('pendente'),
  ]);
  return { concluidas, pendentes };
}

/** "Mostrando 100 de 437 rotas" (inteiros, sem casa decimal). */
export function textoMostrando(carregadas: number, total: number): string {
  return `Mostrando ${formatarDecimal(carregadas, 0)} de ${formatarDecimal(
    total,
    0,
  )} rotas`;
}
