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
 *   rota); texto que é pedaço de "sem motorista" — o que a lista mostra na
 *   rota sem motorista — também traz essas rotas (ver `CONDICAO_SEM_MOTORISTA`); `dd/mm/aaaa`, `dd/mm`, `mm/aaaa` e `aaaa` viram filtro na coluna
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
import { buscarNomesForaDaLoja } from '@/lib/gestor/nomesMotoristasForaDaLoja';
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

/**
 * Nome exibido/exportado quando a rota tem `motorista_id`, a RLS esconde o
 * motorista e a RPC `nomes_motoristas_das_rotas` (Migration 72) não devolveu
 * o nome (pessoa sem vínculo com a loja, RPC indisponível ou ainda não
 * consultada). Com o nome, a tela mostra `"<Nome> (fora da loja)"`.
 */
export const ROTULO_MOTORISTA_OCULTO = 'Motorista removido da loja';

/**
 * Nome do motorista para exibir numa rota. Embed vazio com `motorista_id`
 * preenchido = a RLS escondeu o motorista (saiu da loja): "Sem motorista"
 * seria falso. `nomeForaDaLoja` é o nome que a RPC da Migration 72 devolveu
 * para essa rota (`buscarNomesForaDaLoja`); só vale quando o embed veio vazio.
 * Um helper só para as telas não divergirem — a regra inline em cada uma já
 * deixou quatro delas para trás.
 */
export function nomeMotoristaDaRota(
  nome: string | null | undefined,
  motoristaId: string | null | undefined,
  nomeForaDaLoja?: string | null,
): string {
  if (nome) return nome;
  if (!motoristaId) return 'Sem motorista';
  return nomeForaDaLoja
    ? `${nomeForaDaLoja} (fora da loja)`
    : ROTULO_MOTORISTA_OCULTO;
}

/** O que a lista mostra na rota sem motorista (em minúsculas). */
const ROTULO_SEM_MOTORISTA = 'sem motorista';

/**
 * Rota sem motorista OU cujo motorista casou com o nome buscado. Sem `!inner`,
 * o filtro no nome só anula o embed de quem não casa (a linha fica), e
 * `usuarios.not.is.null` separa os que casaram. Só texto fixo: nada digitado
 * entra no `or()`. Sintaxe conferida no PostgREST do projeto em 24/10/2026
 * (200; com embed inexistente no mesmo `or`, 400 — o nome é resolvido).
 */
const CONDICAO_SEM_MOTORISTA = 'motorista_id.is.null,usuarios.not.is.null';

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
  | {
      tipo: 'nome';
      padrao: string;
      /** O texto é pedaço de "sem motorista": traz também as sem motorista. */
      incluiSemMotorista: boolean;
    }
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

  return {
    tipo: 'nome',
    padrao: `%${escaparIlike(t)}%`,
    incluiSemMotorista: ROTULO_SEM_MOTORISTA.includes(t.toLowerCase()),
  };
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
  // outro motorista continua na lista. Com "sem motorista" no jogo o
  // `!inner` sairia com a rota sem motorista junto: quem recorta é o `or`.
  return busca.tipo === 'nome' && !busca.incluiSemMotorista
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
  cursor?: CursorRotas,
): ConsultaRotas {
  let q = consulta.eq('unidade_id', filtros.unidadeId);
  // Um `or` só: dois parâmetros `or` na mesma URL dependeriam de como o
  // PostgREST junta chaves repetidas. Com os dois, vira `and(or(..),or(..))`.
  const ous: string[] = [];
  if (busca.tipo === 'nome' && busca.incluiSemMotorista) {
    ous.push(CONDICAO_SEM_MOTORISTA);
  }
  if (cursor) ous.push(filtroDepoisDoCursor(cursor));
  if (ous.length === 1) q = q.or(ous[0]);
  if (ous.length > 1) q = q.or(`and(${ous.map((o) => `or(${o})`).join(',')})`);
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
    cursor,
  );
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

function motoristaDaLinha(rota: LinhaRota) {
  return Array.isArray(rota.usuarios) ? rota.usuarios[0] : rota.usuarios;
}

async function comParadas(
  linhas: LinhaRota[],
  signal?: AbortSignal,
): Promise<RotaHistorico[]> {
  // Em paralelo: a RPC dos nomes não lança (erro vira Map vazio) e não leva
  // o `signal` (`rpc` não é cancelada aqui); só é chamada se houver rota
  // com o motorista escondido.
  const [paradasPorRota, nomesForaDaLoja] = await Promise.all([
    contarParadasDasRotas(
      linhas.map((r) => r.id),
      signal,
    ),
    buscarNomesForaDaLoja(
      linhas.map((r) => ({
        id: r.id,
        motorista_id: r.motorista_id,
        nomeVisivel: motoristaDaLinha(r)?.nome,
      })),
    ),
  ]);
  return linhas.map((rota) => {
    const motorista = motoristaDaLinha(rota);
    const stats = paradasPorRota.get(rota.id);
    return {
      id: rota.id,
      data: rota.data,
      status: rota.status,
      distancia_total: rota.distancia_total,
      iniciada_em: rota.iniciada_em,
      concluida_em: rota.concluida_em,
      // O id vem da COLUNA da rota: o embed `usuarios` some quando a RLS
      // esconde o motorista (vínculo desativado/outra loja), e a rota não
      // pode virar "sem motorista" por isso. Alternativa descartada: manter
      // `motorista?.id` e marcar o oculto só pelo nome — perderia o id que
      // filtros e ações da tela usam.
      motorista_id: rota.motorista_id ?? undefined,
      motorista_nome: motorista
        ? motorista.nome
        : rota.motorista_id
          ? nomeMotoristaDaRota(
              undefined,
              rota.motorista_id,
              nomesForaDaLoja.get(rota.id),
            )
          : undefined,
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
