/**
 * Mensagem para o gestor quando `inserir_parada` ou `reordenar_paradas`
 * recusam (Migration 81: `{ success: false, code, error }`).
 *
 * A mensagem sai só do `code`. O `error` da resposta nunca vai para a tela:
 * até a Migration 81 ele era o SQLERRM cru do Postgres, e um servidor antigo
 * ainda pode mandá-lo. Código desconhecido, ausente ou de outro tipo cai no
 * genérico da ação — o app novo continua certo contra o banco de antes.
 *
 * Alternativa descartada: passar pelo `errorMapping` (regex sobre o texto da
 * mensagem). Com o código estruturado, um mapa explícito é mais simples de
 * testar e não confunde um texto do Postgres com um código.
 */
export type AcaoNaParada = 'inserir' | 'reordenar';

const GENERICO: Record<AcaoNaParada, string> = {
  inserir: 'Erro ao adicionar parada. Tente novamente.',
  reordenar: 'Erro ao reordenar paradas.',
};

const PARADAS_MUDARAM =
  'As paradas mudaram desde que a tela abriu. Recarregue a rota.';

const POR_CODIGO: Record<string, string> = {
  ROTA_ENCERRADA:
    'Esta rota já foi encerrada e não aceita mudanças. Recarregue a rota.',
  SEM_PERMISSAO: 'Você não tem permissão para alterar esta rota.',
  PARADAS_DE_OUTRA_ROTA: PARADAS_MUDARAM,
  PARADA_NAO_ENCONTRADA: PARADAS_MUDARAM,
  ORDEM_DUPLICADA:
    'Duas paradas ficaram na mesma posição. Recarregue a rota e tente de novo.',
};

export function mensagemDaRecusaDaParada(
  code: unknown,
  acao: AcaoNaParada,
): string {
  if (typeof code === 'string' && Object.hasOwn(POR_CODIGO, code)) {
    return POR_CODIGO[code];
  }
  return GENERICO[acao];
}
