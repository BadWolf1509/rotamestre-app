/**
 * Regras do modo navegação (tela cheia) da Início.
 *
 * Alternativas para a saída do modo ao fim da rota:
 *  (a) efeito que desliga o estado quando a rota/parada some (escolhida);
 *  (b) só exigir rota em andamento no render. Descartada: o estado ficaria
 *      ligado e o modo reabriria sozinho na próxima rota em andamento, com o
 *      serviço "Navegação Ativa" e a gravação de posições.
 */

/** Só o necessário da rota e da parada, para a regra ser testável sem contexto. */
export function deveSairDoModoNavegacao(
  route: { status: string } | null | undefined,
  currentStop: unknown,
): boolean {
  return !currentStop || route?.status !== 'em_andamento';
}

/** Texto do diálogo de finalizar: com puladas, "concluídas" seria mentira. */
export function mensagemFinalizarRota(puladas: number): string {
  if (puladas > 0) {
    const rotulo = puladas === 1 ? 'pulada' : 'puladas';
    return `Todas as paradas foram resolvidas (${puladas} ${rotulo}). Deseja finalizar a rota?`;
  }
  return 'Todas as paradas foram concluídas. Deseja finalizar a rota?';
}
