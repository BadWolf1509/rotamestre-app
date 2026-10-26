/**
 * Recusas de mudança de status vindas dos gatilhos do banco (P0001):
 * - `PARADA_DE_ROTA_ENCERRADA` (Migration 77): status de parada de rota
 *   concluída, cancelada ou não executada;
 * - `ROTA_TRANSICAO_RECUSADA` (Migration 76): o motorista só leva a rota de
 *   pendente a em andamento e de em andamento a concluída;
 * - `ROTA_ENCERRADA` (Migration 75): rota encerrada não muda de status.
 * Sem entrada aqui, o motorista lia "Algo deu errado" (ou o código cru).
 */
jest.mock('../logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { getErrorMessage } from '../errorMapping';

const doPostgrest = (message: string) => ({
  code: 'P0001',
  message,
  details: null,
  hint: null,
});

describe('errorMapping — recusas de status do banco', () => {
  it('PARADA_DE_ROTA_ENCERRADA: a rota foi encerrada, a parada não muda mais', () => {
    const r = getErrorMessage(doPostgrest('PARADA_DE_ROTA_ENCERRADA'));
    expect(r.code).toBe('STOP_OF_CLOSED_ROUTE');
    expect(r.title).toBe('Rota encerrada');
    expect(r.message).toMatch(/encerrada/);
    expect(r.type).toBe('warning');
  });

  it('ROTA_TRANSICAO_RECUSADA: a rota não pode ir para esse estado pelo app', () => {
    const r = getErrorMessage(doPostgrest('ROTA_TRANSICAO_RECUSADA'));
    expect(r.code).toBe('ROUTE_TRANSITION_REFUSED');
    expect(r.message).toMatch(/atualizar/);
    expect(r.type).toBe('warning');
  });

  it('ROTA_ENCERRADA (Migration 75) também tem mensagem própria', () => {
    expect(getErrorMessage(doPostgrest('ROTA_ENCERRADA')).code).toBe(
      'ROUTE_CLOSED',
    );
  });

  it('casa também dentro de Error e da forma classificada', () => {
    expect(getErrorMessage(new Error('PARADA_DE_ROTA_ENCERRADA')).code).toBe(
      'STOP_OF_CLOSED_ROUTE',
    );
    expect(
      getErrorMessage({ type: 'unknown', message: 'ROTA_TRANSICAO_RECUSADA' })
        .code,
    ).toBe('ROUTE_TRANSITION_REFUSED');
  });
});
