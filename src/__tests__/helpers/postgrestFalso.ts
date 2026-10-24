/**
 * PostgREST FALSO atrás do `PostgrestClient` DE VERDADE.
 *
 * Diferente de `consultaFalsa.ts` (que substitui o construtor de consulta),
 * aqui a biblioteca real monta a URL, e um `fetch` falso a interpreta sobre
 * linhas em memória. Um teste que passa aqui prova o que a consulta pede ao
 * servidor de fato: o filtro escapado, o `or` do cursor, a ordem, o
 * `limit`/`offset`, o `count=exact` e o corte de 1.000 linhas (max-rows do
 * Supabase), não a sequência de métodos chamados.
 *
 * Modela só o que as listas do gestor usam:
 * - filtros `eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `in`, `is`, `ilike`;
 * - `or=(...)` com `and(...)` aninhado e valores entre aspas;
 * - filtro em coluna de tabela embutida (`usuarios.nome`): como no PostgREST,
 *   só recorta a linha-mãe quando o `select` pede o embed com `!inner`;
 * - `order` com várias colunas, `limit`, `offset`, `Prefer: count=exact`
 *   (vira `content-range`), `HEAD` e `POST` (registrado, não grava);
 * - falha por tabela: `falhas.paradas = { message, code }` faz toda consulta
 *   a `paradas` responder 500 com esse corpo.
 *
 * Não modela RLS nem a projeção de colunas do `select`: a linha já vem com os
 * objetos embutidos que a consulta pediria. Comparações são de texto (datas
 * ISO e ids com o mesmo comprimento ordenam certo).
 */
import { PostgrestClient } from '@supabase/postgrest-js';

export type LinhaFalsa = Record<string, unknown>;

export interface RequisicaoFalsa {
  metodo: string;
  tabela: string;
  url: URL;
  prefer: string | null;
}

type Condicao = (linha: LinhaFalsa) => boolean;

function valor(linha: LinhaFalsa, coluna: string): unknown {
  return coluna
    .split('.')
    .reduce<unknown>((o, k) => (o as LinhaFalsa | null)?.[k], linha);
}

/** Separa por vírgula de nível zero (fora de parênteses e de aspas). */
function separarNoNivelZero(texto: string): string[] {
  const partes: string[] = [];
  let nivel = 0;
  let aspas = false;
  let atual = '';
  for (const c of texto) {
    if (c === '"') aspas = !aspas;
    if (!aspas && c === '(') nivel++;
    if (!aspas && c === ')') nivel--;
    if (!aspas && nivel === 0 && c === ',') {
      partes.push(atual);
      atual = '';
      continue;
    }
    atual += c;
  }
  partes.push(atual);
  return partes;
}

function semAspas(v: string): string {
  return v.length >= 2 && v.startsWith('"') && v.endsWith('"')
    ? v.slice(1, -1)
    : v;
}

/** Padrão de LIKE do PostgREST (`*` = `%`, `\` escapa) para RegExp. */
function likeParaRegExp(padrao: string): RegExp {
  let fonte = '';
  for (let i = 0; i < padrao.length; i++) {
    const c = padrao[i];
    if (c === '\\' && i + 1 < padrao.length) {
      fonte += padrao[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } else if (c === '%' || c === '*') {
      fonte += '.*';
    } else if (c === '_') {
      fonte += '.';
    } else {
      fonte += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${fonte}$`, 'is');
}

function condicaoSimples(coluna: string, expressao: string): Condicao {
  const ponto = expressao.indexOf('.');
  const operador = expressao.slice(0, ponto);
  const bruto = expressao.slice(ponto + 1);
  const comparar = (l: LinhaFalsa) => {
    const v = valor(l, coluna);
    return v === null || v === undefined ? null : String(v);
  };
  switch (operador) {
    case 'eq':
      return (l) => comparar(l) === semAspas(bruto);
    case 'neq':
      return (l) => comparar(l) !== semAspas(bruto);
    case 'lt':
      return (l) => comparar(l) !== null && comparar(l)! < semAspas(bruto);
    case 'lte':
      return (l) => comparar(l) !== null && comparar(l)! <= semAspas(bruto);
    case 'gt':
      return (l) => comparar(l) !== null && comparar(l)! > semAspas(bruto);
    case 'gte':
      return (l) => comparar(l) !== null && comparar(l)! >= semAspas(bruto);
    case 'is':
      return (l) => (bruto === 'null' ? comparar(l) === null : false);
    case 'in': {
      const lista = separarNoNivelZero(bruto.slice(1, -1)).map(semAspas);
      return (l) => lista.includes(comparar(l) ?? '\u0000');
    }
    case 'ilike': {
      const re = likeParaRegExp(semAspas(bruto));
      return (l) => re.test(comparar(l) ?? '');
    }
    default:
      throw new Error(`postgrestFalso: operador não modelado: ${operador}`);
  }
}

/** `a.lt.1,and(a.eq.1,b.lt.2)` → condição (OU entre as partes). */
function arvoreLogica(corpo: string, juncao: 'or' | 'and'): Condicao {
  const partes = separarNoNivelZero(corpo).map((parte): Condicao => {
    const aninhada = parte.match(/^(and|or)\((.*)\)$/s);
    if (aninhada) return arvoreLogica(aninhada[2], aninhada[1] as 'or' | 'and');
    const ponto = parte.indexOf('.');
    return condicaoSimples(parte.slice(0, ponto), parte.slice(ponto + 1));
  });
  return juncao === 'or'
    ? (l) => partes.some((p) => p(l))
    : (l) => partes.every((p) => p(l));
}

const PARAMETROS_DE_CONTROLE = new Set(['select', 'order', 'limit', 'offset']);

export function criarPostgrestFalso(
  tabelas: Record<string, LinhaFalsa[]>,
  { maxLinhas = 1000 }: { maxLinhas?: number } = {},
) {
  const requisicoes: RequisicaoFalsa[] = [];
  const falhas: Record<string, { message: string; code: string }> = {};

  const fetchFalso = (async (
    entrada: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => {
    const url = new URL(String(entrada));
    const metodo = init?.method ?? 'GET';
    const tabela = url.pathname.split('/').pop() ?? '';
    const cabecalhos = new Headers(init?.headers);
    const prefer = cabecalhos.get('Prefer');
    requisicoes.push({ metodo, tabela, url, prefer });

    // Cada resposta chega numa macrotarefa, como na rede: sem isso, uma
    // sequência de requisições terminaria inteira antes de o React renderizar
    // qualquer estado intermediário (progresso) e de um unmount acontecer.
    await new Promise((resolver) => setTimeout(resolver, 0));

    if (init?.signal?.aborted) {
      const erro = new Error('The operation was aborted.');
      erro.name = 'AbortError';
      throw erro;
    }

    if (falhas[tabela]) {
      return new Response(JSON.stringify(falhas[tabela]), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (metodo === 'POST') {
      return new Response('', { status: 201 });
    }

    const select = url.searchParams.get('select') ?? '*';
    const condicoes: Condicao[] = [];
    for (const [chave, expressao] of url.searchParams.entries()) {
      if (PARAMETROS_DE_CONTROLE.has(chave)) continue;
      if (chave === 'or' || chave === 'and') {
        condicoes.push(arvoreLogica(expressao.slice(1, -1), chave));
        continue;
      }
      if (chave.includes('.')) {
        const embed = chave.split('.')[0];
        const interno = new RegExp(`\\b${embed}(![\\w]+)*!inner\\(`).test(
          select,
        );
        // Sem `!inner` o PostgREST só esvazia o embed; a linha-mãe fica.
        if (!interno) continue;
      }
      condicoes.push(condicaoSimples(chave, expressao));
    }

    let linhas = (tabelas[tabela] ?? []).filter((l) =>
      condicoes.every((c) => c(l)),
    );

    const ordem = url.searchParams.get('order');
    if (ordem) {
      const criterios = ordem.split(',').map((o) => {
        const [coluna, direcao] = o.split('.');
        return { coluna, desc: direcao === 'desc' };
      });
      linhas = [...linhas].sort((a, b) => {
        for (const { coluna, desc } of criterios) {
          const x = String(valor(a, coluna) ?? '');
          const y = String(valor(b, coluna) ?? '');
          if (x !== y) return (x < y ? -1 : 1) * (desc ? -1 : 1);
        }
        return 0;
      });
    }

    const total = linhas.length;
    const inicio = Number(url.searchParams.get('offset') ?? 0);
    const limite = url.searchParams.get('limit');
    const tamanho = Math.min(
      limite === null ? Infinity : Number(limite),
      maxLinhas,
    );
    const pagina = linhas.slice(inicio, inicio + tamanho);

    const fim = pagina.length ? inicio + pagina.length - 1 : inicio;
    const contar = /count=exact/.test(prefer ?? '');
    const headers = new Headers({
      'content-type': 'application/json',
      'content-range': `${pagina.length ? `${inicio}-${fim}` : '*'}/${
        contar ? total : '*'
      }`,
    });
    return new Response(metodo === 'HEAD' ? null : JSON.stringify(pagina), {
      status: 200,
      headers,
    });
  }) as typeof fetch;

  const cliente = new PostgrestClient('http://postgrest.falso/rest/v1', {
    fetch: fetchFalso,
  });

  return { cliente, requisicoes, falhas };
}
