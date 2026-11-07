import { mensagemDaRecusaDaParada } from '../mensagemRecusaParada';

// As RPCs `inserir_parada` e `reordenar_paradas` devolvem, desde a Migration
// 81, `{ success: false, code, error }`. A mensagem do toast sai do `code`;
// o `error` da resposta nunca é mostrado (antes da 81 era o SQLERRM cru).
describe('mensagemDaRecusaDaParada', () => {
  it('rota encerrada pede para recarregar, nas duas ações', () => {
    expect(mensagemDaRecusaDaParada('ROTA_ENCERRADA', 'inserir')).toBe(
      'Esta rota já foi encerrada e não aceita mudanças. Recarregue a rota.',
    );
    expect(mensagemDaRecusaDaParada('ROTA_ENCERRADA', 'reordenar')).toBe(
      'Esta rota já foi encerrada e não aceita mudanças. Recarregue a rota.',
    );
  });

  it('sem permissão diz que a pessoa não pode alterar a rota', () => {
    expect(mensagemDaRecusaDaParada('SEM_PERMISSAO', 'inserir')).toBe(
      'Você não tem permissão para alterar esta rota.',
    );
  });

  it('paradas que mudaram desde que a tela abriu pedem para recarregar', () => {
    const esperado =
      'As paradas mudaram desde que a tela abriu. Recarregue a rota.';
    expect(mensagemDaRecusaDaParada('PARADAS_DE_OUTRA_ROTA', 'reordenar')).toBe(
      esperado,
    );
    expect(mensagemDaRecusaDaParada('PARADA_NAO_ENCONTRADA', 'reordenar')).toBe(
      esperado,
    );
  });

  it('ordem duplicada pede para recarregar e tentar de novo', () => {
    expect(mensagemDaRecusaDaParada('ORDEM_DUPLICADA', 'reordenar')).toBe(
      'Duas paradas ficaram na mesma posição. Recarregue a rota e tente de novo.',
    );
  });

  it('código desconhecido, ausente ou de outro tipo cai no genérico de cada ação', () => {
    for (const code of [
      'ERRO',
      'ENTRADA_INVALIDA',
      'XYZ',
      undefined,
      null,
      42,
    ]) {
      expect(mensagemDaRecusaDaParada(code, 'inserir')).toBe(
        'Erro ao adicionar parada. Tente novamente.',
      );
      expect(mensagemDaRecusaDaParada(code, 'reordenar')).toBe(
        'Erro ao reordenar paradas.',
      );
    }
  });

  it('nunca devolve o texto do Postgres, mesmo quando ele vem no lugar do código', () => {
    const cru =
      'duplicate key value violates unique constraint "paradas_rota_id_ordem_key"';
    expect(mensagemDaRecusaDaParada(cru, 'reordenar')).toBe(
      'Erro ao reordenar paradas.',
    );
  });
});
