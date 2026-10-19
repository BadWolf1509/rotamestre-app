/**
 * Agrupa paradas em VISITAS antes do TSP.
 *
 * Uma visita é uma sequência de paradas que sai inteira e consecutiva na rota;
 * só a primeira parada dela entra na matriz OSRM/TSP. Duas regras formam uma
 * visita:
 *
 * 1. **Mesmo local** — paradas a até `RAIO_MESMO_LOCAL_METROS` umas das outras
 *    (ex.: entrega + retirada para o mesmo cliente, numa locação). O TSP não
 *    garante que dois pontos idênticos fiquem lado a lado (a força bruta usa `<`
 *    estrito e o 2-opt supõe simetria), então o agrupamento acontece aqui.
 *    Dentro do local, entrega antes da retirada (decisão de produto) e, entre
 *    paradas do mesmo tipo, a ordem de entrada.
 * 2. **Dependência** — retirada + entregas vinculadas a ela
 *    (`vinculo_parada_id`), como fazia o antigo `agruparPorDependencia`: a
 *    retirada vem antes, e é o que a RPC `criar_rota_com_paradas` exige.
 *
 * As duas se combinam: se uma entrega vinculada à retirada Y divide o ponto com
 * a retirada X, a visita sai Y … entrega → X.
 *
 * Sem ponto repetido, o resultado é idêntico ao do agrupamento antigo: visitas
 * com dependência primeiro, depois as paradas avulsas na ordem de entrada.
 */

import { calculateHaversineDistance } from '../osrm/fallback';

import type { ParadaParaOtimizar } from './types';

/**
 * Raio em que duas paradas contam como o mesmo local. Cobre a variação do
 * geocoding para o mesmo endereço e fica abaixo da distância entre vizinhos de
 * porta em rua comum, que o otimizador ainda deve poder separar.
 */
export const RAIO_MESMO_LOCAL_METROS = 30;

function distanciaMetros(a: ParadaParaOtimizar, b: ParadaParaOtimizar): number {
  return calculateHaversineDistance(
    a.latitude,
    a.longitude,
    b.latitude,
    b.longitude,
  );
}

/**
 * Locais por ponto-âncora: a parada entra no primeiro local cuja PRIMEIRA
 * parada está no raio. Medir da âncora, e não do vizinho mais próximo, impede
 * que uma fileira de casas a 25 m uma da outra vire um local só.
 */
function agruparPorLocal(
  paradas: ParadaParaOtimizar[],
  raioMetros: number,
): number[][] {
  const locais: number[][] = [];
  paradas.forEach((parada, i) => {
    const local = locais.find(
      (l) => distanciaMetros(paradas[l[0]], parada) <= raioMetros,
    );
    if (local) local.push(i);
    else locais.push([i]);
  });
  return locais;
}

/**
 * Ordenação topológica estável: a cada passo sai, entre os disponíveis, o de
 * menor `prioridade` (empate pela ordem de entrada). Devolve null se sobrar
 * ciclo.
 */
function ordenarTopologicamente(
  itens: number[],
  antecessores: Map<number, Set<number>>,
  prioridade: (item: number) => number,
): number[] | null {
  const pendentes = new Set(itens);
  const ordem: number[] = [];
  while (pendentes.size > 0) {
    let escolhido: number | null = null;
    for (const item of pendentes) {
      const bloqueado = [...(antecessores.get(item) ?? [])].some((a) =>
        pendentes.has(a),
      );
      if (bloqueado) continue;
      if (
        escolhido === null ||
        prioridade(item) < prioridade(escolhido) ||
        (prioridade(item) === prioridade(escolhido) && item < escolhido)
      ) {
        escolhido = item;
      }
    }
    if (escolhido === null) return null;
    ordem.push(escolhido);
    pendentes.delete(escolhido);
  }
  return ordem;
}

function adicionarAresta(
  antecessores: Map<number, Set<number>>,
  antes: number,
  depois: number,
) {
  const set = antecessores.get(depois) ?? new Set<number>();
  set.add(antes);
  antecessores.set(depois, set);
}

/**
 * Divide as paradas em visitas, já na ordem interna em que devem ser feitas.
 * A primeira parada de cada visita é o representante que vai para o TSP.
 */
export function agruparParadasEmVisitas(
  paradas: ParadaParaOtimizar[],
  raioMetros: number = RAIO_MESMO_LOCAL_METROS,
): ParadaParaOtimizar[][] {
  const indicePorId = new Map(paradas.map((p, i) => [p.id, i]));

  // Dependências: índice da retirada → índice da entrega vinculada.
  const dependencias: Array<[number, number]> = [];
  paradas.forEach((parada, i) => {
    if (!parada.vinculo_parada_id) return;
    const r = indicePorId.get(parada.vinculo_parada_id);
    if (r !== undefined && r !== i) dependencias.push([r, i]);
  });
  const ehRetiradaVinculada = new Set(dependencias.map(([r]) => r));

  const locais = agruparPorLocal(paradas, raioMetros);
  const localDe = new Array<number>(paradas.length);
  locais.forEach((local, l) => local.forEach((i) => (localDe[i] = l)));

  // Visitas = componentes conexos de locais ligados por dependência.
  const raiz = locais.map((_, l) => l);
  const acharRaiz = (l: number): number =>
    raiz[l] === l ? l : (raiz[l] = acharRaiz(raiz[l]));
  dependencias.forEach(([r, e]) => {
    const a = acharRaiz(localDe[r]);
    const b = acharRaiz(localDe[e]);
    if (a !== b) raiz[Math.max(a, b)] = Math.min(a, b);
  });
  const locaisPorVisita = new Map<number, number[]>();
  locais.forEach((_, l) => {
    const v = acharRaiz(l);
    locaisPorVisita.set(v, [...(locaisPorVisita.get(v) ?? []), l]);
  });

  // Dentro do local: dependência primeiro; depois entrega, retirada que
  // libera entrega, e por fim as demais retiradas.
  const prioridadeParada = (i: number) =>
    paradas[i].tipo === 'entrega' ? 0 : ehRetiradaVinculada.has(i) ? 1 : 2;

  const ordenarParadas = (indices: number[]) => {
    const membros = new Set(indices);
    const antecessores = new Map<number, Set<number>>();
    dependencias.forEach(([r, e]) => {
      if (membros.has(r) && membros.has(e)) adicionarAresta(antecessores, r, e);
    });
    // Sem ciclo de dependência (a validação recusa antes); se houver, fica a
    // ordem de entrada para não perder parada.
    return (
      ordenarTopologicamente(indices, antecessores, prioridadeParada) ?? indices
    );
  };

  const visitas: Array<{ indices: number[]; temDependencia: boolean }> = [];
  locaisPorVisita.forEach((locaisDaVisita) => {
    const membrosLocais = new Set(locaisDaVisita);
    const antecessores = new Map<number, Set<number>>();
    let temDependencia = false;
    dependencias.forEach(([r, e]) => {
      if (!membrosLocais.has(localDe[r])) return;
      temDependencia = true;
      if (localDe[r] !== localDe[e]) {
        adicionarAresta(antecessores, localDe[r], localDe[e]);
      }
    });

    const ordemLocais = ordenarTopologicamente(
      locaisDaVisita,
      antecessores,
      () => 0,
    );
    const indices = ordemLocais
      ? ordemLocais.flatMap((l) => ordenarParadas(locais[l]))
      : // Locais que dependem um do outro nos dois sentidos (A tem retirada de
        // entrega em B e vice-versa): não há como manter cada local contíguo.
        // A visita continua inteira, ordenada só pela dependência.
        ordenarParadas(
          locaisDaVisita.flatMap((l) => locais[l]).sort((a, b) => a - b),
        );

    visitas.push({ indices, temDependencia });
  });

  // Mesma ordem de visitas do agrupamento antigo: com dependência primeiro.
  // Dentro de cada classe, pela primeira aparição de quem a abre na entrada
  // (a retirada, nas visitas com dependência).
  const chave = (v: { indices: number[]; temDependencia: boolean }) =>
    v.temDependencia
      ? Math.min(...v.indices.filter((i) => ehRetiradaVinculada.has(i)))
      : Math.min(...v.indices);
  visitas.sort(
    (a, b) =>
      Number(b.temDependencia) - Number(a.temDependencia) ||
      chave(a) - chave(b),
  );

  return visitas.map((v) => v.indices.map((i) => paradas[i]));
}

/**
 * Converte a ordem das visitas devolvida pelo TSP em índices de `paradas`.
 * Se a ordem não cobre todas as visitas (OSRM sem `ordem_otimizada`), usa a
 * ordem natural das visitas — que continua mantendo cada uma inteira.
 */
export function expandirOrdemDasVisitas(
  visitas: ParadaParaOtimizar[][],
  paradas: ParadaParaOtimizar[],
  ordemVisitas: number[] | undefined,
): number[] {
  const completa =
    ordemVisitas !== undefined &&
    ordemVisitas.length === visitas.length &&
    new Set(ordemVisitas).size === visitas.length &&
    ordemVisitas.every((v) => v >= 0 && v < visitas.length);
  const ordem = completa ? ordemVisitas : visitas.map((_, i) => i);
  const indicePorId = new Map(paradas.map((p, i) => [p.id, i]));
  return ordem.flatMap((v) =>
    visitas[v].map((p) => indicePorId.get(p.id) as number),
  );
}
