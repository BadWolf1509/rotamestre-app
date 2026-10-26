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
import {
  recalcularRota,
  removerParadaERecalcular,
  reordenarParadas,
} from '@/lib/routeUtils';
import { supabase } from '@/lib/supabase';

import {
  MENSAGEM_ROTA_MUDOU,
  useMapaRotaHandlers,
} from '../useMapaRotaHandlers';

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
      showToast: mockShowToast,
      rotaId: 'rota-1',
      rota,
      paradas: paradasReais,
      paradasReais,
      enderecoUnidade: { latitude: -23.5, longitude: -46.6 },
      loadRotaEParadas: jest.fn().mockResolvedValue(undefined),
    }),
  );

/**
 * Cadeia de filtros do PostgREST simulada: cada filtro (`eq`/`in`/`neq`)
 * devolve a própria cadeia e fica registrado; o `.select` final resolve. Assim
 * o teste confere QUAIS filtros o UPDATE levou, sem depender da ordem exata
 * da cadeia.
 */
interface CadeiaUpdate {
  eq: jest.Mock;
  in: jest.Mock;
  neq: jest.Mock;
  select: jest.Mock;
}
const criarCadeiaUpdate = (select: jest.Mock): CadeiaUpdate => {
  const cadeia: CadeiaUpdate = {
    eq: jest.fn(() => cadeia),
    in: jest.fn(() => cadeia),
    neq: jest.fn(() => cadeia),
    select,
  };
  return cadeia;
};

/** Promessa que o teste resolve na hora que quiser (ação "em voo"). */
const promessaAdiada = <T>() => {
  let resolver!: (valor: T) => void;
  const promessa = new Promise<T>((r) => {
    resolver = r;
  });
  return { promessa, resolver };
};

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
    showToast: mockShowToast,
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
  let cadeiaRotas: CadeiaUpdate;
  let mockRotasUpdate: jest.Mock;

  const setupCancelar = (
    loadRotaEParadas: jest.Mock = jest.fn().mockResolvedValue(undefined),
  ) => {
    const { result } = renderHook(() =>
      useMapaRotaHandlers({
        showToast: mockShowToast,
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
    cadeiaRotas = criarCadeiaUpdate(mockRotasSelect);
    mockRotasUpdate = jest.fn(() => cadeiaRotas);
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'rotas') {
        return { update: mockRotasUpdate };
      }
      return { insert: jest.fn().mockResolvedValue({ error: null }) };
    });
  });

  it('cancelar filtra por status aberto', async () => {
    mockRotasSelect.mockResolvedValue({
      data: [{ id: 'rota-1' }],
      error: null,
    });
    const { result } = setupCancelar();

    await act(async () => {
      await result.current.handleConfirmCancel();
    });

    expect(cadeiaRotas.eq).toHaveBeenCalledWith('id', 'rota-1');
    expect(cadeiaRotas.in).toHaveBeenCalledWith('status', [
      'pendente',
      'em_andamento',
    ]);
  });

  // Antes do GES-4 este teste exigia toast de erro e NENHUMA recarga para
  // zero linhas. Com o UPDATE condicionado ao status, zero linhas passou a
  // significar também "a rota mudou de situação" (concluída, cancelada por
  // outro gestor) — e o cliente não distingue isso de RLS. A tela então avisa
  // e recarrega, para mostrar o estado real; nunca anuncia sucesso.
  it('zero linhas (RLS ou rota mudou de situação): avisa, recarrega e não anuncia sucesso', async () => {
    mockRotasSelect.mockResolvedValue({ data: [], error: null });
    const { result, loadRotaEParadas } = setupCancelar();

    await act(async () => {
      await result.current.handleConfirmCancel();
    });

    expect(mockShowToast).not.toHaveBeenCalledWith(
      'Rota cancelada com sucesso',
      'success',
    );
    expect(mockShowToast).toHaveBeenCalledWith(MENSAGEM_ROTA_MUDOU, 'info');
    expect(loadRotaEParadas).toHaveBeenCalledTimes(1);
  });

  it('toque duplo executa uma vez e acaoEmVoo acompanha a ação', async () => {
    const adiada = promessaAdiada<{ data: { id: string }[]; error: null }>();
    mockRotasSelect.mockReturnValue(adiada.promessa);
    const { result } = setupCancelar();

    expect(result.current.acaoEmVoo).toBe(false);

    let primeira!: Promise<void>;
    let segunda!: Promise<void>;
    act(() => {
      primeira = result.current.handleConfirmCancel();
      segunda = result.current.handleConfirmCancel();
    });

    expect(result.current.acaoEmVoo).toBe(true);

    await act(async () => {
      adiada.resolver({ data: [{ id: 'rota-1' }], error: null });
      await primeira;
      await segunda;
    });

    expect(mockRotasUpdate).toHaveBeenCalledTimes(1);
    expect(result.current.acaoEmVoo).toBe(false);
  });

  it('acaoEmVoo volta a false quando a ação falha', async () => {
    mockRotasSelect.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    });
    const { result } = setupCancelar();

    await act(async () => {
      await result.current.handleConfirmCancel();
    });

    expect(result.current.acaoEmVoo).toBe(false);
    // Depois de terminar, a trava solta: uma nova tentativa executa.
    await act(async () => {
      await result.current.handleConfirmCancel();
    });
    expect(mockRotasUpdate).toHaveBeenCalledTimes(2);
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
    status: 'nao_executada',
  };

  let mockRotasSelect: jest.Mock;
  let mockParadasSelect: jest.Mock;
  let mockLogInsert: jest.Mock;
  let cadeiaRotas: CadeiaUpdate;
  let cadeiaParadas: CadeiaUpdate;

  const setupReativar = (
    paradasReais: Parada[],
    loadRotaEParadas: jest.Mock = jest.fn().mockResolvedValue(undefined),
  ) => {
    const { result } = renderHook(() =>
      useMapaRotaHandlers({
        showToast: mockShowToast,
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
    cadeiaRotas = criarCadeiaUpdate(mockRotasSelect);
    cadeiaParadas = criarCadeiaUpdate(mockParadasSelect);

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'rotas') {
        return { update: jest.fn(() => cadeiaRotas) };
      }
      if (table === 'paradas') {
        return { update: jest.fn(() => cadeiaParadas) };
      }
      if (table === 'logs') {
        return { insert: mockLogInsert };
      }
      return {};
    });
  });

  it('reativar exige rota não executada', async () => {
    const paradas = [makeParada('p1', 1), makeParada('p2', 2)];
    const { result } = setupReativar(paradas);

    await act(async () => {
      await result.current.handleConfirmReactivate();
    });

    expect(cadeiaRotas.eq).toHaveBeenCalledWith('id', 'rota-1');
    expect(cadeiaRotas.eq).toHaveBeenCalledWith('status', 'nao_executada');
    // O UPDATE das paradas continua como era (fora do escopo do GES-4).
    expect(cadeiaParadas.eq).toHaveBeenCalledWith('rota_id', 'rota-1');
    expect(cadeiaParadas.neq).toHaveBeenCalledWith('status', 'concluida');
  });

  // Antes do GES-4 este teste exigia que zero linhas não recarregasse. Agora
  // zero linhas também significa "a rota mudou de situação" (o cliente não
  // distingue de RLS): avisa e recarrega, sem tocar nas paradas.
  it('zero linhas no UPDATE de rotas: nem tenta paradas, avisa e recarrega, sem log', async () => {
    mockRotasSelect.mockResolvedValue({ data: [], error: null });
    const paradas = [makeParada('p1', 1), makeParada('p2', 2)];
    const { result, loadRotaEParadas } = setupReativar(paradas);

    await act(async () => {
      await result.current.handleConfirmReactivate();
    });

    expect(mockParadasSelect).not.toHaveBeenCalled();
    expect(mockLogInsert).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalledWith(
      'Rota reativada com sucesso',
      'success',
    );
    expect(mockShowToast).toHaveBeenCalledWith(MENSAGEM_ROTA_MUDOU, 'info');
    expect(loadRotaEParadas).toHaveBeenCalledTimes(1);
  });

  it('toque duplo executa uma vez (1 log)', async () => {
    const adiada = promessaAdiada<{ data: { id: string }[]; error: null }>();
    mockRotasSelect.mockReturnValue(adiada.promessa);
    const paradas = [makeParada('p1', 1), makeParada('p2', 2)];
    const { result } = setupReativar(paradas);

    let primeira!: Promise<void>;
    let segunda!: Promise<void>;
    act(() => {
      primeira = result.current.handleConfirmReactivate();
      segunda = result.current.handleConfirmReactivate();
    });
    expect(result.current.acaoEmVoo).toBe(true);

    await act(async () => {
      adiada.resolver({ data: [{ id: 'rota-1' }], error: null });
      await primeira;
      await segunda;
    });

    expect(mockLogInsert).toHaveBeenCalledTimes(1);
    expect(result.current.acaoEmVoo).toBe(false);
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
    status: 'pendente',
    motorista_id: 'motorista-antigo',
  };

  let mockRotasSelect: jest.Mock;
  let mockLogInsert: jest.Mock;
  let cadeiaRotas: CadeiaUpdate;
  let mockRotasUpdate: jest.Mock;

  const setupAlterarMotorista = (
    loadRotaEParadas: jest.Mock = jest.fn().mockResolvedValue(undefined),
  ) => {
    const { result } = renderHook(() =>
      useMapaRotaHandlers({
        showToast: mockShowToast,
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
    cadeiaRotas = criarCadeiaUpdate(mockRotasSelect);
    mockRotasUpdate = jest.fn(() => cadeiaRotas);
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'rotas') {
        return { update: mockRotasUpdate };
      }
      if (table === 'logs') {
        return { insert: mockLogInsert };
      }
      return {};
    });
  });

  it('trocar motorista exige rota pendente', async () => {
    mockRotasSelect.mockResolvedValue({
      data: [{ id: 'rota-1' }],
      error: null,
    });
    const { result } = setupAlterarMotorista();

    await act(async () => {
      await result.current.handleChangeDriver(
        'motorista-novo',
        'Novo Motorista',
      );
    });

    expect(cadeiaRotas.eq).toHaveBeenCalledWith('id', 'rota-1');
    expect(cadeiaRotas.eq).toHaveBeenCalledWith('status', 'pendente');
  });

  // Antes do GES-4 este teste exigia toast de erro e nenhuma recarga. Com o
  // filtro de status, zero linhas é o caso do motorista que iniciou a rota
  // enquanto o modal estava aberto (indistinguível de RLS no cliente): avisa
  // e recarrega. A auditoria continua sem registro — a troca não aconteceu.
  it('zero linhas → MENSAGEM_ROTA_MUDOU, recarrega, sem log', async () => {
    mockRotasSelect.mockResolvedValue({ data: [], error: null });
    const { result, loadRotaEParadas } = setupAlterarMotorista();

    await act(async () => {
      await result.current.handleChangeDriver(
        'motorista-novo',
        'Novo Motorista',
      );
    });

    expect(supabase.from).not.toHaveBeenCalledWith('logs');
    expect(mockLogInsert).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalledWith(
      'Motorista alterado com sucesso',
      'success',
    );
    expect(mockShowToast).toHaveBeenCalledWith(MENSAGEM_ROTA_MUDOU, 'info');
    expect(loadRotaEParadas).toHaveBeenCalledTimes(1);
  });

  it('toque duplo executa uma vez', async () => {
    const adiada = promessaAdiada<{ data: { id: string }[]; error: null }>();
    mockRotasSelect.mockReturnValue(adiada.promessa);
    const { result } = setupAlterarMotorista();

    let primeira!: Promise<void>;
    let segunda!: Promise<void>;
    act(() => {
      primeira = result.current.handleChangeDriver('m-novo', 'Novo');
      segunda = result.current.handleChangeDriver('m-novo', 'Novo');
    });
    expect(result.current.acaoEmVoo).toBe(true);

    await act(async () => {
      adiada.resolver({ data: [{ id: 'rota-1' }], error: null });
      await primeira;
      await segunda;
    });

    expect(mockRotasUpdate).toHaveBeenCalledTimes(1);
    expect(mockLogInsert).toHaveBeenCalledTimes(1);
    expect(result.current.acaoEmVoo).toBe(false);
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

describe('useMapaRotaHandlers — salvar edição de parada', () => {
  it('vínculo das entregas não desfeito: avisa o gestor em vez de mostrar só sucesso', async () => {
    mockShowToast.mockClear();
    const { result } = setup([makeParada('p1', 1)]);

    await act(async () => {
      await result.current.handleEditStopSave(false, true);
    });

    expect(mockShowToast).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith(
      'Parada atualizada, mas o vínculo das entregas dela não foi totalmente desfeito. Confira a ordem entre retirada e entregas.',
      'error',
      6000,
    );
  });

  it('sem problema de vínculo: o toast de sucesso de sempre', async () => {
    mockShowToast.mockClear();
    const { result } = setup([makeParada('p1', 1)]);

    await act(async () => {
      await result.current.handleEditStopSave(false);
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      'Parada atualizada com sucesso',
      'success',
    );
  });
});

describe('useMapaRotaHandlers — remover parada (toque duplo)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('toque duplo executa uma vez e acaoEmVoo acompanha a ação', async () => {
    const adiada = promessaAdiada<{ success: boolean }>();
    (removerParadaERecalcular as jest.Mock).mockReturnValue(adiada.promessa);
    const paradas = [makeParada('p1', 1), makeParada('p2', 2)];
    const { result } = setup(paradas);

    act(() => {
      result.current.handleRemoveStopRequest(paradas[0]);
    });
    expect(result.current.paradaToRemove?.id).toBe('p1');

    let primeira!: Promise<void>;
    let segunda!: Promise<void>;
    act(() => {
      primeira = result.current.handleConfirmRemoveStop();
      segunda = result.current.handleConfirmRemoveStop();
    });
    expect(result.current.acaoEmVoo).toBe(true);

    await act(async () => {
      adiada.resolver({ success: true });
      await primeira;
      await segunda;
    });

    expect(removerParadaERecalcular).toHaveBeenCalledTimes(1);
    expect(result.current.acaoEmVoo).toBe(false);
  });
});
