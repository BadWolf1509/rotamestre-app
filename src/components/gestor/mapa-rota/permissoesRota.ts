/**
 * O que o gestor pode fazer com a rota, conforme a situação dela. A regra mora
 * só aqui: o cabeçalho do desktop (`RouteInfoHeaderCompact`) e a barra do
 * celular/tablet (`AcoesRotaMobile`) leem desta função, para as duas telas não
 * divergirem.
 *
 * Esconder o botão é conforto: quem garante é a escrita condicionada à
 * situação viva em `useMapaRotaHandlers` (a tela pode estar velha).
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
