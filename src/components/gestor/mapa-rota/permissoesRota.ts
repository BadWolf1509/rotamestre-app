/**
 * O que o gestor pode fazer com a rota, conforme a situação dela. A regra mora
 * só aqui: o cabeçalho do desktop (`RouteInfoHeaderCompact`) e a barra do
 * celular/tablet (`AcoesRotaMobile`) leem desta função, para as duas telas não
 * divergirem.
 *
 * Esconder o botão é conforto (a tela pode estar velha): quem garante é o
 * banco. Cancelar e reativar vão pelas RPCs `cancelar_rota`/`reativar_rota`
 * (`src/lib/gestor/acoesRota.ts`), que conferem a situação viva da rota e a
 * permissão de gestor; trocar motorista é um UPDATE condicionado à situação
 * viva em `useMapaRotaHandlers`.
 */
export interface PermissoesRota {
  cancelar: boolean;
  reativar: boolean;
  trocarMotorista: boolean;
  adicionarParada: boolean;
  reordenar: boolean;
}

export function permissoesRota(
  status: string | null | undefined,
): PermissoesRota {
  const aberta = status === 'pendente' || status === 'em_andamento';
  return {
    cancelar:
      status !== 'cancelada' &&
      status !== 'concluida' &&
      status !== 'nao_executada',
    reativar: status === 'nao_executada',
    trocarMotorista: status === 'pendente',
    adicionarParada: aberta,
    reordenar: aberta,
  };
}
