/**
 * Gatilho de rebusca do resumo da linha do tempo (`TimelineCollapsible`).
 *
 * A tela da rota já recebe as mudanças pelo realtime do `useMapaRotaData`;
 * esta assinatura (status da rota + id:status:concluida_em de cada parada)
 * muda quando algo que entra no resumo muda, e fica igual numa recarga que
 * traz objetos novos com o mesmo conteúdo — assim o resumo não rebusca à toa.
 * Incidente novo não muda as paradas: esse caso segue para a próxima mudança
 * ou para a lista expandida, que tem realtime próprio.
 */
interface ParadaDoSinal {
  id: string;
  status: string;
  concluida_em?: string | null;
}

export function sinalLinhaDoTempo(
  statusRota: string | null | undefined,
  paradas: readonly ParadaDoSinal[],
): string {
  const partes = paradas.map(
    (p) => `${p.id}:${p.status}:${p.concluida_em ?? ''}`,
  );
  return `${statusRota ?? ''}|${partes.join(',')}`;
}
