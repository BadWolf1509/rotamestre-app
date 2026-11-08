/**
 * iniciarRota — o motorista inicia a rota pela RPC `iniciar_rota` (Migration
 * 88). O cliente só repassa o resultado do conjunto fechado que o banco
 * devolve; qualquer outro valor é tratado como erro, para a tela nunca
 * anunciar início de uma resposta que não entende.
 */
import { supabase } from '@/lib/supabase';

import { iniciarRota } from '../iniciarRota';

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

const rpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  rpc.mockReset();
});

describe('iniciarRota', () => {
  it('chama a RPC com p_rota_id e devolve o resultado', async () => {
    rpc.mockResolvedValue({ data: 'iniciada', error: null });

    await expect(iniciarRota('r1')).resolves.toBe('iniciada');
    expect(rpc).toHaveBeenCalledWith('iniciar_rota', { p_rota_id: 'r1' });
  });

  it.each(['iniciada', 'ja_iniciada', 'situacao_mudou', 'sem_permissao'])(
    'aceita %s',
    async (resultado) => {
      rpc.mockResolvedValue({ data: resultado, error: null });
      await expect(iniciarRota('r1')).resolves.toBe(resultado);
    },
  );

  it.each([null, '', 'cancelada', 42])(
    'resposta fora do conjunto (%p) vira erro',
    async (data) => {
      rpc.mockResolvedValue({ data, error: null });
      await expect(iniciarRota('r1')).rejects.toThrow(
        'Resposta inesperada de iniciar_rota',
      );
    },
  );

  it('erro da RPC é relançado como veio', async () => {
    const erro = { message: 'falhou', code: '42501' };
    rpc.mockResolvedValue({ data: null, error: erro });

    await expect(iniciarRota('r1')).rejects.toBe(erro);
  });
});
