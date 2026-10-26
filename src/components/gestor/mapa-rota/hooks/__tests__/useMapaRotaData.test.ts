/**
 * useMapaRotaData - Tests
 *
 * Foco: a rota carregada precisa trazer `otimizacao_estado` do banco. O
 * select de `rotas` usa uma lista explícita de colunas — se `otimizacao_estado`
 * sumir dessa lista, `rota.otimizacao_estado` fica sempre `undefined` em
 * runtime (o campo é opcional no tipo `Rota`, então o TypeScript não acusa
 * nada), e toda a lógica de auditoria de otimização em `useMapaRotaHandlers`
 * (detectar rota otimizada pra marcar 'otimizada_alterada' ao reordenar)
 * fica morta. Ver FIX 1 do review final de feat/auditoria-otimizacao-rotas.
 */

import { renderHook, waitFor } from '@testing-library/react-native';

import { useMapaRotaData } from '../useMapaRotaData';

// Mock supabase query builder — duas tabelas (rotas, paradas), cada uma com
// sua própria cadeia de mocks, como em useResumoRota.test.ts.
const mockSingle = jest.fn();
const mockEq = jest.fn(() => ({ single: mockSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));

const mockParadasOrder = jest.fn();
const mockParadasEq = jest.fn(() => ({ order: mockParadasOrder }));
const mockParadasSelect = jest.fn(() => ({ eq: mockParadasEq }));

const mockFrom = jest.fn((table: string) => {
  if (table === 'rotas') return { select: mockSelect };
  if (table === 'paradas') return { select: mockParadasSelect };
  throw new Error(`useMapaRotaData.test: tabela inesperada "${table}"`);
});

// Realtime inerte (coberto em useMapaRotaData.realtime.test.ts).
const canalInerte: Record<string, unknown> = {};
canalInerte.on = () => canalInerte;
canalInerte.subscribe = () => canalInerte;

// RPC nomes_motoristas_das_rotas (Migration 72).
const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    channel: () => canalInerte,
    removeChannel: () => undefined,
  },
}));

// showToast precisa ser a MESMA referência entre renders (a implementação
// real memoiza com useCallback(..., []) — ver src/hooks/useToast.ts). Uma
// factory que devolve um jest.fn() novo a cada chamada muda a identidade de
// `showToast` a cada render, o que muda a identidade de `loadRotaEParadas`
// (useCallback com `showToast` na dep list) e realimenta o useEffect que o
// chama — loop infinito de fetch só no teste, não no hook real.
const mockShowToast = jest.fn();
jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const rotaRow = {
  id: 'rota-1',
  data: '2026-08-05',
  status: 'em_andamento',
  distancia_total: 12.3,
  tempo_total: 40,
  polyline: 'enc',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
  motorista_id: 'motorista-1',
  unidade_id: 'unidade-1',
  otimizacao_estado: 'otimizada',
  usuarios: { nome: 'Motorista X' },
  unidades: { nome: 'Unidade X' },
};

describe('useMapaRotaData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSingle.mockResolvedValue({ data: rotaRow, error: null });
    mockParadasOrder.mockResolvedValue({ data: [], error: null });
  });

  it('inclui otimizacao_estado no select de rotas (regressão: sem isso o campo nunca chega do banco)', async () => {
    const { result } = renderHook(() => useMapaRotaData({ rotaId: 'rota-1', showToast: mockShowToast }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockSelect).toHaveBeenCalledWith(
      expect.stringContaining('otimizacao_estado'),
    );
  });

  it('popula rota.otimizacao_estado com o valor retornado pelo banco', async () => {
    const { result } = renderHook(() => useMapaRotaData({ rotaId: 'rota-1', showToast: mockShowToast }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rota?.otimizacao_estado).toBe('otimizada');
  });

  it('motorista com embed visível: não chama a RPC de nomes', async () => {
    const { result } = renderHook(() =>
      useMapaRotaData({ rotaId: 'rota-1', showToast: mockShowToast }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result.current.rota?.motorista_fora_da_loja_nome ?? null).toBeNull();
  });

  it('motorista escondido pela RLS: grava o nome da RPC em motorista_fora_da_loja_nome', async () => {
    mockSingle.mockResolvedValue({
      data: { ...rotaRow, usuarios: null },
      error: null,
    });
    mockRpc.mockResolvedValue({
      data: [{ rota_id: 'rota-1', nome: 'Bia' }],
      error: null,
    });

    const { result } = renderHook(() =>
      useMapaRotaData({ rotaId: 'rota-1', showToast: mockShowToast }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockRpc).toHaveBeenCalledWith('nomes_motoristas_das_rotas', {
      p_rota_ids: ['rota-1'],
    });
    expect(result.current.rota?.motorista).toBeNull();
    expect(result.current.rota?.motorista_fora_da_loja_nome).toBe('Bia');
  });

  it('erro da RPC de nomes não impede a carga da rota', async () => {
    mockSingle.mockResolvedValue({
      data: { ...rotaRow, usuarios: null },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: null, error: { message: 'x' } });

    const { result } = renderHook(() =>
      useMapaRotaData({ rotaId: 'rota-1', showToast: mockShowToast }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rota?.id).toBe('rota-1');
    expect(result.current.rota?.motorista_fora_da_loja_nome).toBeNull();
    expect(mockShowToast).not.toHaveBeenCalled();
  });
});
