/**
 * Totais de desempenho do motorista: pela RPC da Migration 55.
 *
 * R-DB-1: o caminho de reserva (soma paginada no cliente quando a RPC não
 * existia no banco) saiu — a Migration 55 está aplicada, o banco é único, e a
 * reserva não acompanhava a regra da RPC (a view foi reescrita na Migration
 * 80). Função ausente agora sobe como qualquer outro erro.
 */
import { supabase } from '@/lib/supabase';

import {
  buscarResumoDesempenho,
  RPC_RESUMO_DESEMPENHO,
} from '../resumoDesempenho';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('buscarResumoDesempenho pela RPC', () => {
  it('chama a RPC com o motorista e o período e converte a linha', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: [
        {
          desde: '2026-09-24',
          total_rotas: 393,
          rotas_concluidas: 390,
          rotas_canceladas: 2,
          distancia_total: '1234.5',
          total_paradas: 1449,
          paradas_concluidas: 1400,
          paradas_puladas: 30,
          entregas_em_rotas_concluidas: 1398,
        },
      ],
      error: null,
    });

    const resumo = await buscarResumoDesempenho('m1', 30);

    expect(supabase.rpc).toHaveBeenCalledWith(RPC_RESUMO_DESEMPENHO, {
      p_motorista_id: 'm1',
      p_dias: 30,
    });
    expect(resumo).toEqual({
      totalRotas: 393,
      rotasConcluidas: 390,
      rotasCanceladas: 2,
      distanciaTotal: 1234.5,
      totalParadas: 1449,
      paradasConcluidas: 1400,
      paradasPuladas: 30,
      entregasEmRotasConcluidas: 1398,
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('sem período manda p_dias null', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: [], error: null });
    const resumo = await buscarResumoDesempenho('m1', null);
    expect(supabase.rpc).toHaveBeenCalledWith(RPC_RESUMO_DESEMPENHO, {
      p_motorista_id: 'm1',
      p_dias: null,
    });
    // Linha ausente vira zeros, não erro.
    expect(resumo.totalRotas).toBe(0);
    expect(resumo.distanciaTotal).toBe(0);
  });

  it('erro que não é "função ausente" sobe (sem cair no cliente)', async () => {
    const erro = { code: '42501', message: 'Sem permissão' };
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: erro });
    await expect(buscarResumoDesempenho('m1', 7)).rejects.toBe(erro);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe('buscarResumoDesempenho sem a RPC no banco', () => {
  it.each(['PGRST202', '42883'])(
    'com %s o erro sobe, sem somar no cliente',
    async (code) => {
      const erro = { code, message: 'function not found' };
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: erro,
      });

      await expect(buscarResumoDesempenho('m1', null)).rejects.toBe(erro);
      expect(supabase.from).not.toHaveBeenCalled();
    },
  );
});
