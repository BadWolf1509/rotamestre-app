/**
 * Vínculo retirada -> entrega (`paradas.vinculo_parada_id`).
 *
 * A entrega vinculada depende de uma retirada: não pode ficar antes dela na
 * ordem da rota. O banco guarda o vínculo com `ON DELETE SET NULL`, e o gatilho
 * de validação só roda ao gravar o próprio vínculo — então apagar a retirada ou
 * trocar o tipo de uma das duas desfaz o vínculo (ou o deixa incoerente) em
 * silêncio. Estas funções puras dão à tela de reordenar, ao modal de editar e
 * ao diálogo de remover a mesma leitura da regra, para avisar antes.
 */

export interface ParadaComVinculo {
  id: string;
  tipo: 'entrega' | 'retirada';
  endereco?: string | null;
  status?: string;
  vinculo_parada_id?: string | null;
}

export interface ViolacaoDeVinculo<P extends ParadaComVinculo> {
  entrega: P;
  retirada: P;
}

function descrever(parada: ParadaComVinculo): string {
  const nome = parada.endereco?.trim() || 'sem endereço';
  return `${parada.tipo === 'retirada' ? 'Retirada' : 'Entrega'} ${nome}`;
}

/**
 * Entregas que estão antes da retirada de que dependem, na ordem dada. O
 * vínculo para uma parada que não está na lista (já concluída em outra visão,
 * apagada) não é violação: não há o que comparar.
 */
export function violacoesDeVinculo<P extends ParadaComVinculo>(
  ordenadas: P[],
): ViolacaoDeVinculo<P>[] {
  const posicao = new Map(ordenadas.map((p, i) => [p.id, i]));
  const violacoes: ViolacaoDeVinculo<P>[] = [];
  ordenadas.forEach((parada, i) => {
    if (parada.tipo !== 'entrega' || !parada.vinculo_parada_id) return;
    const j = posicao.get(parada.vinculo_parada_id);
    if (j === undefined || j < i) return;
    violacoes.push({ entrega: parada, retirada: ordenadas[j] });
  });
  return violacoes;
}

/**
 * Primeira violação que a ordem `depois` criou e a `antes` não tinha.
 *
 * Comparar só o que é novo evita travar o gestor numa rota que já veio
 * quebrada (o banco nunca impediu): ele ainda consegue mexer nas outras
 * paradas, e não consegue piorar o que está certo.
 */
export function primeiraViolacaoNova<P extends ParadaComVinculo>(
  antes: P[],
  depois: P[],
): ViolacaoDeVinculo<P> | null {
  const jaExistiam = new Set(violacoesDeVinculo(antes).map((v) => v.entrega.id));
  return (
    violacoesDeVinculo(depois).find((v) => !jaExistiam.has(v.entrega.id)) ??
    null
  );
}

export function mensagemEntregaAntesDaRetirada<P extends ParadaComVinculo>(
  violacao: ViolacaoDeVinculo<P>,
): string {
  return `${descrever(violacao.entrega)} depende de ${descrever(violacao.retirada)} e não pode ficar antes dela.`;
}

/**
 * Entregas ainda abertas vinculadas a esta retirada. Entrega concluída ou
 * pulada já foi feita: o vínculo dela não pesa mais, e a trava da Migration 53
 * nem deixaria mexer na parada.
 */
export function entregasQueDependemDe<P extends ParadaComVinculo>(
  paradas: P[],
  retiradaId: string,
): P[] {
  return paradas.filter(
    (p) =>
      p.tipo === 'entrega' &&
      p.vinculo_parada_id === retiradaId &&
      p.status !== 'concluida' &&
      p.status !== 'pulada',
  );
}

function listar(paradas: ParadaComVinculo[]): string {
  return paradas.map((p) => `• ${descrever(p)}`).join('\n');
}

/** Texto de aviso ao remover, ou null quando nada depende da parada. */
export function avisoPerdaDeVinculoAoRemover<P extends ParadaComVinculo>(
  paradas: P[],
  removida: P,
): string | null {
  if (removida.tipo !== 'retirada') return null;
  const dependentes = entregasQueDependemDe(paradas, removida.id);
  if (dependentes.length === 0) return null;
  return `Esta retirada tem ${dependentes.length === 1 ? 'uma entrega vinculada' : `${dependentes.length} entregas vinculadas`}:\n${listar(dependentes)}\nSem a retirada, ${dependentes.length === 1 ? 'ela perde o vínculo e deixa' : 'elas perdem o vínculo e deixam'} de ser obrigada${dependentes.length === 1 ? '' : 's'} a vir depois dela.`;
}

/**
 * Texto de aviso ao trocar o tipo, ou null quando o vínculo não é afetado:
 * - retirada que vira entrega: as entregas vinculadas a ela perdem o vínculo;
 * - entrega vinculada que vira retirada: ela mesma perde o vínculo.
 */
export function avisoPerdaDeVinculoAoEditarTipo<P extends ParadaComVinculo>(
  paradas: P[],
  parada: P,
  novoTipo: 'entrega' | 'retirada',
): string | null {
  if (novoTipo === parada.tipo) return null;

  if (parada.tipo === 'retirada') {
    const dependentes = entregasQueDependemDe(paradas, parada.id);
    if (dependentes.length === 0) return null;
    return `Esta retirada tem ${dependentes.length === 1 ? 'uma entrega vinculada' : `${dependentes.length} entregas vinculadas`}:\n${listar(dependentes)}\nComo entrega, ela deixa de ser retirada e ${dependentes.length === 1 ? 'essa entrega perde o vínculo' : 'essas entregas perdem o vínculo'}.`;
  }

  if (!parada.vinculo_parada_id) return null;
  const retirada = paradas.find((p) => p.id === parada.vinculo_parada_id);
  const alvo = retirada ? descrever(retirada) : 'uma retirada';
  return `Esta entrega está vinculada a ${alvo}. Como retirada, ela perde esse vínculo.`;
}

/** Texto do diálogo de confirmação ao remover, com o aviso do vínculo quando houver. */
export function mensagemConfirmarRemocaoParada<P extends ParadaComVinculo>(
  paradas: P[],
  removida: P,
): string {
  const aviso = avisoPerdaDeVinculoAoRemover(paradas, removida);
  return [
    'Tem certeza que deseja remover esta parada?',
    removida.endereco || '',
    ...(aviso ? [aviso] : []),
    'A rota será recalculada automaticamente.',
  ].join('\n\n');
}
