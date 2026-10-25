/**
 * Totais de desempenho do motorista: pela RPC da Migration 55 e, enquanto
 * ela não existir no banco, pelo caminho paginado no cliente.
 *
 * O fake do PostgREST abaixo aplica o corte de 1.000 linhas (max-rows do
 * Supabase): é ele que zerava contadores em silêncio nos hooks antigos.
 */
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import {
  buscarResumoDesempenho,
  RPC_RESUMO_DESEMPENHO,
} from '../resumoDesempenho';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));


const MAX_ROWS = 1000;

type Linha = Record<string, unknown>;

/** Builder "thenable" que filtra como o PostgREST e corta em 1.000 linhas. */
function consulta(todas: Linha[], registro: { gte: unknown[][] }) {
  const filtros: ((l: Linha) => boolean)[] = [];
  let faixa: [number, number] | null = null;
  const api = {
    select: () => api,
    eq: (col: string, v: unknown) => {
      filtros.push((l) => l[col] === v);
      return api;
    },
    gte: (col: string, v: string) => {
      registro.gte.push([col, v]);
      filtros.push((l) => String(l[col]) >= v);
      return api;
    },
    in: (col: string, vs: unknown[]) => {
      filtros.push((l) => vs.includes(l[col]));
      return api;
    },
    order: () => api,
    range: (a: number, b: number) => {
      faixa = [a, b];
      return api;
    },
    then: (resolve: (r: unknown) => unknown) => {
      const filtradas = todas.filter((l) => filtros.every((f) => f(l)));
      const [a, b] = faixa ?? [0, MAX_ROWS - 1];
      const fatia = filtradas.slice(a, Math.min(b + 1, a + MAX_ROWS));
      return Promise.resolve({ data: fatia, error: null }).then(resolve);
    },
  };
  return api;
}

/** 400 rotas, 6 paradas reais + partida e chegada em cada: 3.200 paradas. */
function cenarioGrande() {
  const rotas: Linha[] = [];
  const paradas: Linha[] = [];
  for (let i = 0; i < 400; i++) {
    const id = `r${String(i).padStart(4, '0')}`;
    const status = i < 390 ? 'concluida' : i < 395 ? 'cancelada' : 'pendente';
    rotas.push({
      id,
      motorista_id: 'm1',
      status,
      distancia_total: 10,
      data: '2026-10-01',
    });
    paradas.push({ id: `${id}-p0`, rota_id: id, status: 'concluida', is_checkpoint: false });
    paradas.push({ id: `${id}-p7`, rota_id: id, status: 'pendente', is_checkpoint: false });
    for (let j = 1; j <= 6; j++) {
      const st = status === 'concluida' ? (j === 6 ? 'pulada' : 'concluida') : 'pendente';
      paradas.push({
        id: `${id}-p${j}`,
        rota_id: id,
        status: st,
        is_checkpoint: j % 2 === 0 ? null : true,
      });
    }
  }
  return { rotas, paradas };
}

function montarFrom(rotas: Linha[], paradas: Linha[]) {
  const registro = { gte: [] as unknown[][] };
  (supabase.from as jest.Mock).mockImplementation((tabela: string) =>
    consulta(tabela === 'rotas' ? rotas : paradas, registro),
  );
  return registro;
}

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

describe('buscarResumoDesempenho sem a RPC no banco (app novo antes da migration)', () => {
  it.each(['PGRST202', '42883'])(
    'com %s cai no caminho paginado e acerta acima de 1.000 paradas',
    async (code) => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { code, message: 'function not found' },
      });
      const { rotas, paradas } = cenarioGrande();
      montarFrom(rotas, paradas);

      const resumo = await buscarResumoDesempenho('m1', null);

      expect(resumo).toEqual({
        totalRotas: 400,
        rotasConcluidas: 390,
        rotasCanceladas: 5,
        distanciaTotal: 4000,
        totalParadas: 2400,
        paradasConcluidas: 390 * 5,
        paradasPuladas: 390,
        entregasEmRotasConcluidas: 390 * 5,
      });
      expect(logger.warn).toHaveBeenCalled();
    },
  );

  it('pagina as rotas além de 1.000', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'x' },
    });
    const rotas = Array.from({ length: 1050 }, (_, i) => ({
      id: `r${i}`,
      motorista_id: 'm1',
      status: 'concluida',
      distancia_total: 1,
      data: '2026-10-01',
    }));
    montarFrom(rotas, []);
    const resumo = await buscarResumoDesempenho('m1', null);
    expect(resumo.totalRotas).toBe(1050);
    expect(resumo.distanciaTotal).toBe(1050);
  });

  it('com período filtra rotas.data a partir do dia local', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'x' },
    });
    const registro = montarFrom([], []);
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 24, 23, 30));
    try {
      await buscarResumoDesempenho('m1', 7);
    } finally {
      jest.useRealTimers();
    }
    // 24/10 às 23:30 locais menos 7 dias = 17/10 (nunca o dia em UTC).
    expect(registro.gte).toEqual([['data', '2026-10-17']]);
  });
});
