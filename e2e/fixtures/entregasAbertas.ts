/**
 * Entregas ainda abertas de uma rota.
 *
 * Toda rota tem partida (ordem 0) e chegada (última), ambas com
 * `is_checkpoint=false` (ver CLAUDE.md); as ENTREGAS são `is_checkpoint=true`.
 * Contar tudo que está `pendente` fazia o fixture ler uma rota de entregas todas
 * concluídas como "tem pendente" (partida e chegada pendentes) e responder
 * `nada-a-fazer`, deixando vazias as telas que dependem de entrega aberta.
 */
export function contarEntregasAbertas(
  paradas: ReadonlyArray<{ status: string; is_checkpoint: boolean }>,
): number {
  return paradas.filter((p) => p.is_checkpoint && p.status === 'pendente')
    .length;
}
