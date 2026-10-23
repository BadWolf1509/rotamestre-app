/**
 * Performance do motorista no perfil (gestor).
 *
 * A `vw_performance_motoristas` filtra `usuarios.ativo = true`: motorista
 * inativo não tem linha. Com `.single()` isso era 406 (PGRST116) e o
 * fallback inventava "100%" de taxa de execução. Sem linha, a taxa é nula.
 */
import { tabelasFalsas } from '@/__tests__/helpers/consultaFalsa';

import { buscarPerformanceMotorista } from '../performanceMotorista';

jest.mock(
  '@/lib/supabase',
  () => require('@/__tests__/helpers/consultaFalsa').moduloConsultaFalsa,
);
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

beforeEach(() => {
  tabelasFalsas.vw_performance_motoristas = [
    {
      id: 'ativo',
      nome: 'Ana',
      unidade_id: 'u1',
      unidade_nome: 'Loja',
      total_rotas: 4,
      rotas_concluidas: 3,
      rotas_em_andamento: 0,
      rotas_nao_executadas: 1,
      rotas_canceladas: 0,
      taxa_execucao: 75,
      distancia_total_km: 10,
      tempo_medio_minutos: 30,
    },
  ];
});

describe('buscarPerformanceMotorista', () => {
  it('motorista com linha na view: devolve a linha', async () => {
    const perf = await buscarPerformanceMotorista('ativo', 'Ana');
    expect(perf.taxa_execucao).toBe(75);
    expect(perf.total_rotas).toBe(4);
  });

  it('motorista inativo (sem linha): taxa nula, não 100%', async () => {
    const perf = await buscarPerformanceMotorista('inativo', 'Bia');
    expect(perf).toMatchObject({
      id: 'inativo',
      nome: 'Bia',
      total_rotas: 0,
      taxa_execucao: null,
    });
  });
});
