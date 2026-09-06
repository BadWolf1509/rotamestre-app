/**
 * useMapaRotaHandlers - Tests
 *
 * Foco: a fiação do scroll-ao-marcador no desktop, que a virtualização da
 * lista de paradas (FlatList) colocou em risco. handleMarkerPress deve:
 *   - selecionar a parada, e
 *   - rolar a FlatList até a POSIÇÃO da parada em `paradasReais` via scrollToIndex.
 *
 * O fallback `onScrollToIndexFailed` (item ainda não montado pela virtualização)
 * é definido no JSX da página e só exercita em browser real — fora deste teste.
 */

import { renderHook, act } from '@testing-library/react-native';

import { logger } from '@/lib/logger';
import { recalcularRota, reordenarParadas } from '@/lib/routeUtils';
import { supabase } from '@/lib/supabase';

import { useMapaRotaHandlers } from '../useMapaRotaHandlers';

import type { Parada, Rota } from '../../types';
import type { FlatList } from 'react-native';

const mockShowToast = jest.fn();
jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: { id: 'user-1', nome: 'Gestor' } }),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn() },
}));

jest.mock('@/lib/routeUtils', () => ({
  removerParadaERecalcular: jest.fn(),
  reordenarParadas: jest.fn(),
  recalcularRota: jest.fn(),
  notificarMotoristaRotaEditada: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => Promise.resolve({ error: null })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

const makeParada = (id: string, ordem: number): Parada => ({
  id,
  ordem,
  endereco: `Rua ${ordem}`,
  tipo: 'entrega',
  status: 'pendente',
  latitude: -23.5,
  longitude: -46.6,
});

const rota: Rota = { id: 'rota-1', data: '2026-06-22', status: 'em_andamento' };

const setup = (paradasReais: Parada[]) =>
  renderHook(() =>
    useMapaRotaHandlers({
      rotaId: 'rota-1',
      rota,
      paradas: paradasReais,
      paradasReais,
      enderecoUnidade: { latitude: -23.5, longitude: -46.6 },
      loadRotaEParadas: jest.fn().mockResolvedValue(undefined),
    }),
  );

/** Simula a FlatList já montada anexando um mock de scrollToIndex à ref. */
const mountFlatList = (ref: {
  current: FlatList<Parada> | null;
}): { scrollToIndex: jest.Mock } => {
  const flatList = { scrollToIndex: jest.fn() };
  ref.current = flatList as unknown as FlatList<Parada>;
  return flatList;
};

describe('useMapaRotaHandlers — scroll ao marcador', () => {
  it('seleciona a parada e rola até o índice dela em paradasReais', () => {
    const paradas = [
      makeParada('p1', 1),
      makeParada('p2', 2),
      makeParada('p3', 3),
    ];
    const { result } = setup(paradas);
    const flatList = mountFlatList(result.current.listaParadasRef);

    act(() => {
      result.current.handleMarkerPress('p3');
    });

    expect(result.current.selectedParadaId).toBe('p3');
    expect(flatList.scrollToIndex).toHaveBeenCalledTimes(1);
    expect(flatList.scrollToIndex).toHaveBeenCalledWith({
      index: 2,
      viewPosition: 0.3,
      animated: true,
    });
  });

  it('usa a posição no array (não o campo ordem) como índice', () => {
    // ordem (5/2/9) propositalmente desencontrada da posição no array (0/1/2)
    const paradas = [
      makeParada('p5', 5),
      makeParada('p2', 2),
      makeParada('p9', 9),
    ];
    const { result } = setup(paradas);
    const flatList = mountFlatList(result.current.listaParadasRef);

    act(() => {
      result.current.handleMarkerPress('p9');
    });

    expect(flatList.scrollToIndex).toHaveBeenCalledWith({
      index: 2,
      viewPosition: 0.3,
      animated: true,
    });
  });

  it('não rola quando a parada não está na lista', () => {
    const paradas = [makeParada('p1', 1), makeParada('p2', 2)];
    const { result } = setup(paradas);
    const flatList = mountFlatList(result.current.listaParadasRef);

    act(() => {
      result.current.handleMarkerPress('inexistente');
    });

    expect(result.current.selectedParadaId).toBe('inexistente');
    expect(flatList.scrollToIndex).not.toHaveBeenCalled();
  });

  it('não lança quando a FlatList ainda não montou (ref nula)', () => {
    const paradas = [makeParada('p1', 1)];
    const { result } = setup(paradas);
    // ref permanece null — virtualização pode ainda não ter montado a lista

    expect(() => {
      act(() => {
        result.current.handleMarkerPress('p1');
      });
    }).not.toThrow();
    expect(result.current.selectedParadaId).toBe('p1');
  });
});

describe('useMapaRotaHandlers — seleção sem scroll', () => {
  it('handleParadaPress seleciona o card sem rolar a lista', () => {
    const paradas = [makeParada('p1', 1), makeParada('p2', 2)];
    const { result } = setup(paradas);
    const flatList = mountFlatList(result.current.listaParadasRef);

    act(() => {
      result.current.handleParadaPress('p2');
    });

    expect(result.current.selectedParadaId).toBe('p2');
    expect(flatList.scrollToIndex).not.toHaveBeenCalled();
  });

  it('handleMapPress limpa a seleção', () => {
    const paradas = [makeParada('p1', 1)];
    const { result } = setup(paradas);
    mountFlatList(result.current.listaParadasRef);

    act(() => {
      result.current.handleMarkerPress('p1');
    });
    expect(result.current.selectedParadaId).toBe('p1');

    act(() => {
      result.current.handleMapPress();
    });
    expect(result.current.selectedParadaId).toBeNull();
  });
});

describe('useMapaRotaHandlers — reordenar paradas (auditoria de otimização)', () => {
  const rotaBase: Rota = {
    id: 'rota-1',
    data: '2026-06-22',
    status: 'em_andamento',
  };
  const newOrder = [makeParada('p2', 2), makeParada('p1', 1)];
  const baseOptions = {
    rotaId: 'rota-1',
    paradas: [makeParada('p1', 1), makeParada('p2', 2)],
    paradasReais: [makeParada('p1', 1), makeParada('p2', 2)],
    enderecoUnidade: { latitude: -23.5, longitude: -46.6 },
    loadRotaEParadas: jest.fn().mockResolvedValue(undefined),
  };

  let mockUpdate: jest.Mock;
  let mockLogInsert: jest.Mock;

  const setupReorder = (rota: Rota) =>
    renderHook(() => useMapaRotaHandlers({ ...baseOptions, rota }));

  beforeEach(() => {
    jest.clearAllMocks();
    // O UPDATE de otimizacao_estado agora encadeia `.select('id')` e passa
    // pelo mesmo `assertUpdateAfetouLinhas` das outras escritas desta tela
    // (revisão do PR #480, item 3) — sem isso, uma linha 0 (RLS) e `error:
    // null` era anunciada como sucesso na auditoria.
    mockUpdate = jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest
          .fn()
          .mockResolvedValue({ data: [{ id: 'rota-1' }], error: null }),
      })),
    }));
    mockLogInsert = jest.fn().mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockImplementation(() => ({
      update: mockUpdate,
      insert: mockLogInsert,
    }));
    (reordenarParadas as jest.Mock).mockResolvedValue({ success: true });
    (recalcularRota as jest.Mock).mockResolvedValue({ success: true });
  });

  it('marca otimizada_alterada quando reordena uma rota otimizada', async () => {
    const { result } = setupReorder({
      ...rotaBase,
      otimizacao_estado: 'otimizada',
    });

    await act(async () => {
      await result.current.handleReorderParadas(newOrder);
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ otimizacao_estado: 'otimizada_alterada' }),
    );
  });

  it('nao mexe no estado de uma rota sem registro', async () => {
    const { result } = setupReorder({ ...rotaBase, otimizacao_estado: null });

    await act(async () => {
      await result.current.handleReorderParadas(newOrder);
    });

    expect(mockUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ otimizacao_estado: expect.anything() }),
    );
  });

  it('nao promove uma rota ja marcada como manual', async () => {
    const { result } = setupReorder({
      ...rotaBase,
      otimizacao_estado: 'manual',
    });

    await act(async () => {
      await result.current.handleReorderParadas(newOrder);
    });

    expect(mockUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ otimizacao_estado: expect.anything() }),
    );
  });

  it('registra desfez_otimizacao no log quando desfaz a otimizacao', async () => {
    const { result } = setupReorder({
      ...rotaBase,
      otimizacao_estado: 'otimizada',
    });

    await act(async () => {
      await result.current.handleReorderParadas(newOrder);
    });

    expect(mockLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: 'paradas_reordenadas',
        detalhes: expect.objectContaining({ desfez_otimizacao: true }),
      }),
    );
  });

  it('registra desfez_otimizacao=false quando a rota nao estava otimizada', async () => {
    const { result } = setupReorder({ ...rotaBase, otimizacao_estado: null });

    await act(async () => {
      await result.current.handleReorderParadas(newOrder);
    });

    expect(mockLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        detalhes: expect.objectContaining({ desfez_otimizacao: false }),
      }),
    );
  });

  it('nao interrompe a reordenacao quando a marcacao de estado falha', async () => {
    const { result } = setupReorder({
      ...rotaBase,
      otimizacao_estado: 'otimizada',
    });
    mockUpdate.mockReturnValueOnce({
      eq: jest.fn(() => ({
        select: jest
          .fn()
          .mockResolvedValue({ data: null, error: { message: 'boom' } }),
      })),
    });

    await act(async () => {
      await expect(
        result.current.handleReorderParadas(newOrder),
      ).resolves.toBeUndefined();
    });

    // `error`, não `warn`: warn é __DEV__-only e sumiria em produção, deixando
    // a falha de auditoria sem rastro nenhum.
    expect(logger.error).toHaveBeenCalledWith(
      '[useMapaRotaHandlers] Falha ao marcar otimização desfeita',
      expect.anything(),
    );
    // A reordenação em si não pode ser derrubada pela falha de auditoria.
    expect(mockLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({ evento: 'paradas_reordenadas' }),
    );
  });

  it('registra desfez_otimizacao=false quando a marcacao de estado falha (a coluna nao mudou)', async () => {
    const { result } = setupReorder({
      ...rotaBase,
      otimizacao_estado: 'otimizada',
    });
    mockUpdate.mockReturnValueOnce({
      eq: jest.fn(() => ({
        select: jest
          .fn()
          .mockResolvedValue({ data: null, error: { message: 'boom' } }),
      })),
    });

    await act(async () => {
      await result.current.handleReorderParadas(newOrder);
    });

    // O UPDATE falhou: `rotas.otimizacao_estado` continua 'otimizada' no
    // banco. O log não pode afirmar `desfez_otimizacao: true` nesse caso —
    // isso mentiria sobre o que de fato aconteceu.
    expect(mockLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: 'paradas_reordenadas',
        detalhes: expect.objectContaining({ desfez_otimizacao: false }),
      }),
    );
  });

  // Revisão do PR #480, item 3: antes desta correção, este UPDATE não
  // encadeava `.select('id')` — um RLS barrando a escrita voltava 204 com
  // ZERO linhas e `error: null`, e a auditoria gravava `desfez_otimizacao:
  // true` para uma coluna que o banco nunca mudou. Sem `.select`, não havia
  // como distinguir este caso do sucesso: por isso o mock aqui, diferente do
  // 'boom' acima, não tem `error` nenhum.
  it('RLS barra o UPDATE de otimizacao_estado (zero linhas, error:null): não afirma desfez_otimizacao', async () => {
    const { result } = setupReorder({
      ...rotaBase,
      otimizacao_estado: 'otimizada',
    });
    mockUpdate.mockReturnValueOnce({
      eq: jest.fn(() => ({
        select: jest.fn().mockResolvedValue({ data: [], error: null }),
      })),
    });

    await act(async () => {
      await result.current.handleReorderParadas(newOrder);
    });

    expect(logger.error).toHaveBeenCalledWith(
      '[useMapaRotaHandlers] Falha ao marcar otimização desfeita',
      expect.anything(),
    );
    expect(mockLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: 'paradas_reordenadas',
        detalhes: expect.objectContaining({ desfez_otimizacao: false }),
      }),
    );
  });
});

// ============================================================================
// cancelar / reativar rota — revisão do PR #480: nenhum dos dois checava o
// resultado do UPDATE. `await supabase....update(...).eq(...)` sem
// desestruturar `error` resolve normalmente mesmo quando o servidor recusa a
// escrita (RLS, etc.) — nunca lança. E checar só `error` não basta: um UPDATE
// barrado por RLS pode devolver 204 com ZERO linhas e `error: null` (Prefer:
// return=minimal não distingue "0 linhas" de "N linhas" sem `.select()`
// encadeado). Por isso todo caso aqui verifica `data` devolvido, não só
// ausência de erro.
// ============================================================================

describe('useMapaRotaHandlers — cancelar rota', () => {
  const rotaAtiva: Rota = {
    id: 'rota-1',
    data: '2026-06-22',
    status: 'em_andamento',
  };

  let mockRotasSelect: jest.Mock;

  const setupCancelar = (
    loadRotaEParadas: jest.Mock = jest.fn().mockResolvedValue(undefined),
  ) => {
    const { result } = renderHook(() =>
      useMapaRotaHandlers({
        rotaId: 'rota-1',
        rota: rotaAtiva,
        paradas: [],
        paradasReais: [],
        enderecoUnidade: { latitude: -23.5, longitude: -46.6 },
        loadRotaEParadas,
      }),
    );
    return { result, loadRotaEParadas };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRotasSelect = jest.fn();
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'rotas') {
        return {
          update: jest.fn(() => ({
            eq: jest.fn(() => ({ select: mockRotasSelect })),
          })),
        };
      }
      return { insert: jest.fn().mockResolvedValue({ error: null }) };
    });
  });

  it('RLS barra o UPDATE (204, zero linhas, error:null): não anuncia sucesso nem recarrega', async () => {
    mockRotasSelect.mockResolvedValue({ data: [], error: null });
    const { result, loadRotaEParadas } = setupCancelar();

    await act(async () => {
      await result.current.handleConfirmCancel();
    });

    expect(mockShowToast).not.toHaveBeenCalledWith(
      'Rota cancelada com sucesso',
      'success',
    );
    expect(mockShowToast).toHaveBeenCalledWith(expect.any(String), 'error');
    // O gestor lia "cancelada" e via a rota ainda ativa: era exatamente por
    // isto — loadRotaEParadas redesenhando a rota que nunca foi cancelada.
    expect(loadRotaEParadas).not.toHaveBeenCalled();
  });

  it('erro explícito do Supabase: não anuncia sucesso', async () => {
    mockRotasSelect.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    });
    const { result, loadRotaEParadas } = setupCancelar();

    await act(async () => {
      await result.current.handleConfirmCancel();
    });

    expect(mockShowToast).not.toHaveBeenCalledWith(
      'Rota cancelada com sucesso',
      'success',
    );
    expect(loadRotaEParadas).not.toHaveBeenCalled();
  });

  it('UPDATE realmente afeta 1 linha: anuncia sucesso e recarrega', async () => {
    mockRotasSelect.mockResolvedValue({
      data: [{ id: 'rota-1' }],
      error: null,
    });
    const { result, loadRotaEParadas } = setupCancelar();

    await act(async () => {
      await result.current.handleConfirmCancel();
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      'Rota cancelada com sucesso',
      'success',
    );
    expect(loadRotaEParadas).toHaveBeenCalledTimes(1);
  });
});

describe('useMapaRotaHandlers — reativar rota', () => {
  const rotaConcluida: Rota = {
    id: 'rota-1',
    data: '2026-06-22',
    status: 'concluida',
  };

  let mockRotasSelect: jest.Mock;
  let mockParadasSelect: jest.Mock;
  let mockLogInsert: jest.Mock;

  const setupReativar = (
    paradasReais: Parada[],
    loadRotaEParadas: jest.Mock = jest.fn().mockResolvedValue(undefined),
  ) => {
    const { result } = renderHook(() =>
      useMapaRotaHandlers({
        rotaId: 'rota-1',
        rota: rotaConcluida,
        paradas: paradasReais,
        paradasReais,
        enderecoUnidade: { latitude: -23.5, longitude: -46.6 },
        loadRotaEParadas,
      }),
    );
    return { result, loadRotaEParadas };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRotasSelect = jest
      .fn()
      .mockResolvedValue({ data: [{ id: 'rota-1' }], error: null });
    mockParadasSelect = jest
      .fn()
      .mockResolvedValue({ data: [{ id: 'p1' }, { id: 'p2' }], error: null });
    mockLogInsert = jest.fn().mockResolvedValue({ error: null });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'rotas') {
        return {
          update: jest.fn(() => ({
            eq: jest.fn(() => ({ select: mockRotasSelect })),
          })),
        };
      }
      if (table === 'paradas') {
        return {
          update: jest.fn(() => ({
            eq: jest.fn(() => ({
              neq: jest.fn(() => ({ select: mockParadasSelect })),
            })),
          })),
        };
      }
      if (table === 'logs') {
        return { insert: mockLogInsert };
      }
      return {};
    });
  });

  it('RLS barra o UPDATE de rotas (zero linhas): nem tenta paradas, não anuncia sucesso', async () => {
    mockRotasSelect.mockResolvedValue({ data: [], error: null });
    const paradas = [makeParada('p1', 1), makeParada('p2', 2)];
    const { result, loadRotaEParadas } = setupReativar(paradas);

    await act(async () => {
      await result.current.handleConfirmReactivate();
    });

    expect(mockParadasSelect).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalledWith(
      'Rota reativada com sucesso',
      'success',
    );
    expect(loadRotaEParadas).not.toHaveBeenCalled();
  });

  // O bug descrito na revisão: rotas passa, paradas falha (erro de verdade) —
  // a rota volta a 'pendente' mas as paradas continuam 'concluida'. Estado
  // inconsistente não pode ser anunciado como sucesso.
  it('rotas OK mas paradas falham (erro de verdade): não anuncia sucesso', async () => {
    mockParadasSelect.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    });
    const paradas = [makeParada('p1', 1), makeParada('p2', 2)];
    const { result, loadRotaEParadas } = setupReativar(paradas);

    await act(async () => {
      await result.current.handleConfirmReactivate();
    });

    expect(mockShowToast).not.toHaveBeenCalledWith(
      'Rota reativada com sucesso',
      'success',
    );
    expect(loadRotaEParadas).not.toHaveBeenCalled();
  });

  // Caso sutil, diferente de "erro de verdade": RLS bloqueia o UPDATE de
  // paradas devolvendo 204 com MENOS linhas do que o esperado (zero, aqui) e
  // `error: null`. Diferente do cancelar, zero linhas não é SEMPRE falha
  // nesta tabela (ver o teste seguinte) — por isso a comparação é contra o
  // número de paradas não-concluídas em `paradasReais`, não contra `> 0`.
  it('RLS barra o UPDATE de paradas (0 linhas quando deveria haver 2): não anuncia sucesso', async () => {
    mockParadasSelect.mockResolvedValue({ data: [], error: null });
    const paradas = [makeParada('p1', 1), makeParada('p2', 2)];
    const { result, loadRotaEParadas } = setupReativar(paradas);

    await act(async () => {
      await result.current.handleConfirmReactivate();
    });

    expect(mockShowToast).not.toHaveBeenCalledWith(
      'Rota reativada com sucesso',
      'success',
    );
    expect(loadRotaEParadas).not.toHaveBeenCalled();
  });

  // Regressão do item 5 (fix-report-2.md, PR #480): `paradasReais` é um
  // snapshot do CLIENTE. Se outro gestor concluir uma parada entre o
  // carregamento da tela e este clique, `.neq('status', 'concluida')`
  // (corretamente) deixa de pegá-la, e o UPDATE afeta MENOS linhas do que
  // `paradasReais` fazia crer — sem que nada tenha dado errado. Antes desta
  // correção, comparar `afetado < esperado` (2 esperadas, 1 afetada) lançava
  // um falso "Erro ao reativar rota" numa reativação que na verdade
  // funcionou, e pulava o `loadRotaEParadas()` que traria a tela pro estado
  // real.
  it('outro gestor concluiu 1 parada nesse meio-tempo (1 afetada de 2 esperadas): ainda anuncia sucesso', async () => {
    mockParadasSelect.mockResolvedValue({ data: [{ id: 'p1' }], error: null });
    const paradas = [makeParada('p1', 1), makeParada('p2', 2)];
    const { result, loadRotaEParadas } = setupReativar(paradas);

    await act(async () => {
      await result.current.handleConfirmReactivate();
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      'Rota reativada com sucesso',
      'success',
    );
    expect(loadRotaEParadas).toHaveBeenCalledTimes(1);
  });

  // Prova de que a checagem não é ingênua (`data.length > 0` fixo): quando
  // TODAS as paradas já estavam concluídas, o filtro
  // `.neq('status', 'concluida')` legitimamente não bate em nenhuma linha —
  // zero é o resultado CORRETO aqui, não uma falha de RLS.
  it('todas as paradas já concluídas: zero linhas é esperado, ainda anuncia sucesso', async () => {
    mockParadasSelect.mockResolvedValue({ data: [], error: null });
    const paradas: Parada[] = [
      { ...makeParada('p1', 1), status: 'concluida' },
      { ...makeParada('p2', 2), status: 'concluida' },
    ];
    const { result, loadRotaEParadas } = setupReativar(paradas);

    await act(async () => {
      await result.current.handleConfirmReactivate();
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      'Rota reativada com sucesso',
      'success',
    );
    expect(loadRotaEParadas).toHaveBeenCalledTimes(1);
  });

  it('rotas e paradas OK: anuncia sucesso e recarrega', async () => {
    const paradas = [makeParada('p1', 1), makeParada('p2', 2)];
    const { result, loadRotaEParadas } = setupReativar(paradas);

    await act(async () => {
      await result.current.handleConfirmReactivate();
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      'Rota reativada com sucesso',
      'success',
    );
    expect(loadRotaEParadas).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// alterar motorista — revisão do PR #480, item 3: o comentário de
// `assertUpdateAfetouLinhas` afirmava que "todo UPDATE nesta tela encadeia
// `.select('id')` e passa o resultado por aqui", mas este UPDATE não fazia
// nem uma coisa nem outra — um RLS barrando a troca voltava 204 com ZERO
// linhas e `error: null`, e a auditoria (`logs`) gravava `motorista_alterado`
// para uma troca que o banco nunca fez.
// ============================================================================

describe('useMapaRotaHandlers — alterar motorista', () => {
  const rotaAtiva: Rota = {
    id: 'rota-1',
    data: '2026-06-22',
    status: 'em_andamento',
    motorista_id: 'motorista-antigo',
  };

  let mockRotasSelect: jest.Mock;
  let mockLogInsert: jest.Mock;

  const setupAlterarMotorista = (
    loadRotaEParadas: jest.Mock = jest.fn().mockResolvedValue(undefined),
  ) => {
    const { result } = renderHook(() =>
      useMapaRotaHandlers({
        rotaId: 'rota-1',
        rota: rotaAtiva,
        paradas: [],
        paradasReais: [],
        enderecoUnidade: { latitude: -23.5, longitude: -46.6 },
        loadRotaEParadas,
      }),
    );
    return { result, loadRotaEParadas };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRotasSelect = jest.fn();
    mockLogInsert = jest.fn().mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'rotas') {
        return {
          update: jest.fn(() => ({
            eq: jest.fn(() => ({ select: mockRotasSelect })),
          })),
        };
      }
      if (table === 'logs') {
        return { insert: mockLogInsert };
      }
      return {};
    });
  });

  it('RLS barra o UPDATE (204, zero linhas, error:null): não grava auditoria nem anuncia sucesso', async () => {
    mockRotasSelect.mockResolvedValue({ data: [], error: null });
    const { result, loadRotaEParadas } = setupAlterarMotorista();

    await act(async () => {
      await result.current.handleChangeDriver(
        'motorista-novo',
        'Novo Motorista',
      );
    });

    // A troca "aconteceu" para quem só olhasse o log — exatamente o efeito
    // que a revisão apontou: auditoria afirmando o que o banco contradiz.
    expect(mockLogInsert).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalledWith(
      'Motorista alterado com sucesso',
      'success',
    );
    expect(mockShowToast).toHaveBeenCalledWith(expect.any(String), 'error');
    expect(loadRotaEParadas).not.toHaveBeenCalled();
  });

  it('erro explícito do Supabase: não grava auditoria nem anuncia sucesso', async () => {
    mockRotasSelect.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    });
    const { result, loadRotaEParadas } = setupAlterarMotorista();

    await act(async () => {
      await result.current.handleChangeDriver(
        'motorista-novo',
        'Novo Motorista',
      );
    });

    expect(mockLogInsert).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalledWith(
      'Motorista alterado com sucesso',
      'success',
    );
    expect(loadRotaEParadas).not.toHaveBeenCalled();
  });

  it('UPDATE realmente afeta 1 linha: grava auditoria, anuncia sucesso e recarrega', async () => {
    mockRotasSelect.mockResolvedValue({
      data: [{ id: 'rota-1' }],
      error: null,
    });
    const { result, loadRotaEParadas } = setupAlterarMotorista();

    await act(async () => {
      await result.current.handleChangeDriver(
        'motorista-novo',
        'Novo Motorista',
      );
    });

    expect(mockLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: 'motorista_alterado',
        detalhes: expect.objectContaining({
          motorista_novo_id: 'motorista-novo',
          motorista_novo_nome: 'Novo Motorista',
        }),
      }),
    );
    expect(mockShowToast).toHaveBeenCalledWith(
      'Motorista alterado com sucesso',
      'success',
    );
    expect(loadRotaEParadas).toHaveBeenCalledTimes(1);
  });
});
