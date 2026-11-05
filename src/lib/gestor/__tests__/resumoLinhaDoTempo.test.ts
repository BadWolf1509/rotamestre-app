import { criarCadeia } from '@/__tests__/helpers/cadeiaSupabase';

import {
  buscarResumoDaLinhaDoTempo,
  LIMITE_LOGS_DO_RESUMO,
} from '../resumoLinhaDoTempo';

const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));

function tabelas(dados: Record<string, { data: unknown; error?: unknown }>) {
  const cadeias: Record<string, ReturnType<typeof criarCadeia>> = {};
  mockFrom.mockImplementation((tabela: string) => {
    const r = dados[tabela] ?? { data: [] };
    cadeias[tabela] = criarCadeia({ data: r.data, error: r.error ?? null });
    return cadeias[tabela];
  });
  return cadeias;
}

beforeEach(() => jest.clearAllMocks());

describe('buscarResumoDaLinhaDoTempo (B-GES-9 / R-GES-6)', () => {
  it('conta eventos de log, paradas reais e incidentes; o último é o mais recente', async () => {
    tabelas({
      logs: {
        data: [
          {
            id: '1',
            evento: 'motorista_iniciou_rota',
            timestamp: '2024-01-01T10:00:00.000Z',
          },
          {
            id: '2',
            evento: 'evento_desconhecido',
            timestamp: '2024-01-01T09:00:00.000Z',
          },
        ],
      },
      paradas: {
        data: [
          {
            id: 'p1',
            ordem: 1,
            status: 'concluida',
            concluida_em: '2024-01-01T11:00:00.000Z',
            is_checkpoint: true,
          },
          {
            id: 'p2',
            ordem: 2,
            status: 'concluida',
            concluida_em: '2024-01-01T08:00:00.000Z',
            is_checkpoint: false,
          },
        ],
      },
      incidentes: {
        data: [
          {
            id: 'i1',
            categoria: 'accident',
            created_at: '2024-01-01T12:00:00.000Z',
          },
        ],
      },
    });

    const r = await buscarResumoDaLinhaDoTempo('rota-1');

    expect(r.eventCount).toBe(3);
    expect(r.lastEvent?.title).toBe('Incidente registrado');
  });

  it('o último evento não some quando os logs mais novos são de outro tipo', async () => {
    // 6 logs recentes sem texto na linha do tempo e um evento de início antigo:
    // cortar em 5 ANTES de filtrar perdia o único evento mostrável.
    const recentes = Array.from({ length: 6 }, (_, i) => ({
      id: `r${i}`,
      evento: 'gps_ping',
      timestamp: `2024-01-02T10:0${i}:00.000Z`,
    }));
    tabelas({
      logs: {
        data: [
          ...recentes,
          {
            id: 'x',
            evento: 'motorista_iniciou_rota',
            timestamp: '2024-01-01T10:00:00.000Z',
          },
        ],
      },
    });

    const r = await buscarResumoDaLinhaDoTempo('rota-1');

    expect(r.lastEvent?.title).toBe('Rota iniciada');
  });

  it('lê os logs com teto', async () => {
    const cadeias = tabelas({});
    await buscarResumoDaLinhaDoTempo('rota-1');
    expect(cadeias.logs.limit).toHaveBeenCalledWith(LIMITE_LOGS_DO_RESUMO);
  });

  it.each(['logs', 'paradas', 'incidentes'])(
    'erro da consulta de %s lança (não vira "0 eventos")',
    async (tabela) => {
      tabelas({ [tabela]: { data: null, error: new Error('rls') } });
      await expect(buscarResumoDaLinhaDoTempo('rota-1')).rejects.toThrow('rls');
    },
  );
});
