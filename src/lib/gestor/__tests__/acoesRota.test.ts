/**
 * acoesRota — cancelar e reativar rota pelas RPCs `cancelar_rota` (Migration
 * 70) e `reativar_rota` (Migration 71). O cliente só repassa o resultado do
 * conjunto fechado que o banco devolve; qualquer outro valor é tratado como
 * erro, para a tela nunca anunciar sucesso de uma resposta que não entende.
 */
import { supabase } from '@/lib/supabase';

import {
  cancelarRota,
  MENSAGEM_MOTORISTA_INDISPONIVEL_REATIVAR,
  reativarRota,
} from '../acoesRota';

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

const rpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  rpc.mockReset();
});

describe('cancelarRota', () => {
  it('chama a RPC com p_rota_id e devolve o resultado', async () => {
    rpc.mockResolvedValue({ data: 'ja_cancelada', error: null });

    await expect(cancelarRota('r1')).resolves.toBe('ja_cancelada');
    expect(rpc).toHaveBeenCalledWith('cancelar_rota', { p_rota_id: 'r1' });
  });

  it.each(['cancelada', 'ja_cancelada', 'situacao_mudou', 'sem_permissao'])(
    'aceita %s',
    async (resultado) => {
      rpc.mockResolvedValue({ data: resultado, error: null });
      await expect(cancelarRota('r1')).resolves.toBe(resultado);
    },
  );

  it('lança o erro do Supabase', async () => {
    const erro = { code: '42883', message: 'function does not exist' };
    rpc.mockResolvedValue({ data: null, error: erro });

    await expect(cancelarRota('r1')).rejects.toBe(erro);
  });

  it('lança em resposta fora do conjunto', async () => {
    rpc.mockResolvedValue({ data: 'ok', error: null });

    await expect(cancelarRota('r1')).rejects.toThrow(
      /Resposta inesperada de cancelar_rota/,
    );
  });

  it('lança quando a resposta vem vazia', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(cancelarRota('r1')).rejects.toThrow(
      /Resposta inesperada de cancelar_rota/,
    );
  });
});

describe('reativarRota', () => {
  it('chama reativar_rota e devolve o resultado', async () => {
    rpc.mockResolvedValue({ data: 'reativada', error: null });

    await expect(reativarRota('r1')).resolves.toBe('reativada');
    expect(rpc).toHaveBeenCalledWith('reativar_rota', { p_rota_id: 'r1' });
  });

  it.each([
    'reativada',
    'situacao_mudou',
    'sem_permissao',
    // Motorista sem vínculo ativo na loja ou com cadastro inativo: nada muda.
    'motorista_indisponivel',
  ])('aceita %s', async (resultado) => {
    rpc.mockResolvedValue({ data: resultado, error: null });
    await expect(reativarRota('r1')).resolves.toBe(resultado);
  });

  it('lança o erro do Supabase', async () => {
    const erro = { code: '42501', message: 'permission denied' };
    rpc.mockResolvedValue({ data: null, error: erro });

    await expect(reativarRota('r1')).rejects.toBe(erro);
  });

  it('lança em resposta fora do conjunto', async () => {
    // `ja_cancelada` é do conjunto do cancelar, não do reativar.
    rpc.mockResolvedValue({ data: 'ja_cancelada', error: null });

    await expect(reativarRota('r1')).rejects.toThrow(
      /Resposta inesperada de reativar_rota/,
    );
  });

  it('a mensagem do motorista indisponível orienta a criar rota nova', () => {
    expect(MENSAGEM_MOTORISTA_INDISPONIVEL_REATIVAR).toMatch(/nova rota/i);
  });
});
