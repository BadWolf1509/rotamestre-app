/**
 * Abrir a rota não escreve no banco.
 *
 * Antes: com a chegada fora do lugar (ordem ≠ nº de paradas reais + 1), o
 * carregamento chamava `normalizarOrdemParadas` (apagada junto: não tinha
 * outro chamador), que fazia UPDATE em duas
 * etapas nas paradas — só por o gestor ter ABERTO a tela — e ignorava o
 * resultado. Agora só registra `logger.warn`; quem reescreve a ordem é a
 * ação explícita de reordenar (RPC `reordenar_paradas`).
 *
 * Banco falso (`consultaFalsa`) com `routeUtils` REAL: qualquer escrita
 * pedida fica registrada em `escritasFalsas`.
 */
import { renderHook, waitFor } from '@testing-library/react-native';

import {
  escritasFalsas,
  tabelasFalsas,
} from '@/__tests__/helpers/consultaFalsa';
import { logger } from '@/lib/logger';

import { useMapaRotaData } from '../useMapaRotaData';

jest.mock(
  '@/lib/supabase',
  () => require('@/__tests__/helpers/consultaFalsa').moduloConsultaFalsa,
);
const mockShowToast = jest.fn();
jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}));

beforeEach(() => {
  escritasFalsas.length = 0;
  tabelasFalsas.rotas = [
    {
      id: 'rota-1',
      data: '2026-10-22',
      status: 'pendente',
      usuarios: { nome: 'Ana' },
      unidades: { nome: 'Loja' },
    },
  ];
  tabelasFalsas.paradas = [
    {
      id: 'partida',
      rota_id: 'rota-1',
      ordem: 0,
      is_checkpoint: false,
      status: 'pendente',
    },
    {
      id: 'p1',
      rota_id: 'rota-1',
      ordem: 1,
      is_checkpoint: true,
      status: 'pendente',
    },
    {
      id: 'p2',
      rota_id: 'rota-1',
      ordem: 2,
      is_checkpoint: true,
      status: 'pendente',
    },
    // chegada deveria ser 3
    {
      id: 'chegada',
      rota_id: 'rota-1',
      ordem: 5,
      is_checkpoint: false,
      status: 'pendente',
    },
  ];
});

describe('useMapaRotaData — abrir a rota', () => {
  it('com a ordem inconsistente, não escreve no banco e só registra aviso', async () => {
    const { result } = renderHook(() => useMapaRotaData({ rotaId: 'rota-1' }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(escritasFalsas).toEqual([]);
    expect(result.current.paradas.map((p) => p.id)).toEqual([
      'partida',
      'p1',
      'p2',
      'chegada',
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('ordem'),
      expect.objectContaining({ rotaId: 'rota-1' }),
    );
  });
});
