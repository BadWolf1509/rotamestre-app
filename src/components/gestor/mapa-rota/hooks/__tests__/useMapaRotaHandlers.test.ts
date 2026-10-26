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

import {
  cancelarRota,
  MENSAGEM_MOTORISTA_INDISPONIVEL_REATIVAR,
  MENSAGEM_ROTA_JA_CANCELADA,
  MENSAGEM_SEM_PERMISSAO_ROTA,
  reativarRota,
} from '@/lib/gestor/acoesRota';
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

// Só as chamadas às RPCs viram mock; as mensagens ficam as reais.
jest.mock('@/lib/gestor/acoesRota', () => ({
  ...jest.requireActual('@/lib/gestor/acoesRota'),
  cancelarRota: jest.fn(),
  reativarRota: jest.fn(),
}));
const mockCancelarRota = cancelarRota as jest.Mock;
const mockReativarRota = reativarRota as jest.Mock;

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
// cancelar / reativar rota — pelas RPCs `cancelar_rota` (Migration 70) e
// `reativar_rota` (Migration 71). Quem confere a situação viva da rota e a
// permissão é o banco, numa transação só; o hook escolhe o aviso e a recarga
// para cada resultado do conjunto fechado. Os testes antigos de UPDATE direto
// (filtro de status, contagem de linhas de paradas, log no cliente) exigiam o
// caminho de duas escritas independentes e saíram com ele.
// ============================================================================

describe('useMapaRotaHandlers — cancelar rota', () => {
  const rotaAtiva: Rota = {
    id: 'rota-1',
    data: '2026-06-22',
    status: 'em_andamento',
  };

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
  });

  it("'cancelada': toast de sucesso e recarrega", async () => {
    mockCancelarRota.mockResolvedValue('cancelada');
    const { result, loadRotaEParadas } = setupCancelar();

    await act(async () => {
      await result.current.handleConfirmCancel();
    });

    expect(mockCancelarRota).toHaveBeenCalledWith('rota-1');
    expect(mockShowToast).toHaveBeenCalledWith(
      'Rota cancelada com sucesso',
      'success',
    );
    expect(loadRotaEParadas).toHaveBeenCalledTimes(1);
  });

  // Resposta perdida ou toque duplo atravessando a trava (outra aba): a 2ª
  // chamada encontra a rota já cancelada. Não é "situação mudou" nem erro.
  it("'ja_cancelada': aviso informativo, recarrega, sem toast de sucesso", async () => {
    mockCancelarRota.mockResolvedValue('ja_cancelada');
    const { result, loadRotaEParadas } = setupCancelar();

    await act(async () => {
      await result.current.handleConfirmCancel();
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      MENSAGEM_ROTA_JA_CANCELADA,
      'info',
    );
    expect(mockShowToast).not.toHaveBeenCalledWith(
      'Rota cancelada com sucesso',
      'success',
    );
    expect(loadRotaEParadas).toHaveBeenCalledTimes(1);
  });

  it("'situacao_mudou': MENSAGEM_ROTA_MUDOU e recarrega", async () => {
    mockCancelarRota.mockResolvedValue('situacao_mudou');
    const { result, loadRotaEParadas } = setupCancelar();

    await act(async () => {
      await result.current.handleConfirmCancel();
    });

    expect(mockShowToast).toHaveBeenCalledWith(MENSAGEM_ROTA_MUDOU, 'info');
    expect(mockShowToast).toHaveBeenCalledTimes(1);
    expect(loadRotaEParadas).toHaveBeenCalledTimes(1);
  });

  it("'sem_permissao': MENSAGEM_SEM_PERMISSAO_ROTA como erro e recarrega", async () => {
    mockCancelarRota.mockResolvedValue('sem_permissao');
    const { result, loadRotaEParadas } = setupCancelar();

    await act(async () => {
      await result.current.handleConfirmCancel();
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      MENSAGEM_SEM_PERMISSAO_ROTA,
      'error',
    );
    expect(mockShowToast).toHaveBeenCalledTimes(1);
    expect(loadRotaEParadas).toHaveBeenCalledTimes(1);
  });

  it("erro lançado: 'Erro ao cancelar rota', logger.error, sem recarregar", async () => {
    const erro = new Error('rede');
    mockCancelarRota.mockRejectedValue(erro);
    const { result, loadRotaEParadas } = setupCancelar();

    await act(async () => {
      await result.current.handleConfirmCancel();
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      'Erro ao cancelar rota',
      'error',
    );
    expect(mockShowToast).not.toHaveBeenCalledWith(
      'Rota cancelada com sucesso',
      'success',
    );
    expect(logger.error).toHaveBeenCalledWith(
      '[useMapaRotaHandlers] Erro ao cancelar rota',
      erro,
    );
    expect(loadRotaEParadas).not.toHaveBeenCalled();
    // A trava solta depois da falha: uma nova tentativa executa.
    expect(result.current.acaoEmVoo).toBe(false);
  });

  it('toque duplo chama cancelarRota uma vez e acaoEmVoo acompanha', async () => {
    const adiada = promessaAdiada<'cancelada'>();
    mockCancelarRota.mockReturnValue(adiada.promessa);
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
      adiada.resolver('cancelada');
      await primeira;
      await segunda;
    });

    expect(mockCancelarRota).toHaveBeenCalledTimes(1);
    expect(result.current.acaoEmVoo).toBe(false);
  });

  it('não faz UPDATE direto em rotas nem em paradas', async () => {
    mockCancelarRota.mockResolvedValue('cancelada');
    const { result } = setupCancelar();

    await act(async () => {
      await result.current.handleConfirmCancel();
    });

    expect(supabase.from).not.toHaveBeenCalledWith('rotas');
    expect(supabase.from).not.toHaveBeenCalledWith('paradas');
  });
});

describe('useMapaRotaHandlers — reativar rota', () => {
  const rotaNaoExecutada: Rota = {
    id: 'rota-1',
    data: '2026-06-22',
    status: 'nao_executada',
  };

  const setupReativar = (
    loadRotaEParadas: jest.Mock = jest.fn().mockResolvedValue(undefined),
  ) => {
    const paradas = [makeParada('p1', 1), makeParada('p2', 2)];
    const { result } = renderHook(() =>
      useMapaRotaHandlers({
        showToast: mockShowToast,
        rotaId: 'rota-1',
        rota: rotaNaoExecutada,
        paradas,
        paradasReais: paradas,
        enderecoUnidade: { latitude: -23.5, longitude: -46.6 },
        loadRotaEParadas,
      }),
    );
    return { result, loadRotaEParadas };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("'reativada': toast de sucesso e recarrega; não insere log no cliente", async () => {
    mockReativarRota.mockResolvedValue('reativada');
    const { result, loadRotaEParadas } = setupReativar();

    await act(async () => {
      await result.current.handleConfirmReactivate();
    });

    expect(mockReativarRota).toHaveBeenCalledWith('rota-1');
    expect(mockShowToast).toHaveBeenCalledWith(
      'Rota reativada com sucesso',
      'success',
    );
    expect(loadRotaEParadas).toHaveBeenCalledTimes(1);
    // O log `rota_reativada` é gravado pela RPC, na mesma transação.
    expect(supabase.from).not.toHaveBeenCalledWith('logs');
    expect(supabase.from).not.toHaveBeenCalledWith('rotas');
    expect(supabase.from).not.toHaveBeenCalledWith('paradas');
  });

  it.each([
    ['situacao_mudou', MENSAGEM_ROTA_MUDOU, 'info'],
    ['sem_permissao', MENSAGEM_SEM_PERMISSAO_ROTA, 'error'],
    [
      'motorista_indisponivel',
      MENSAGEM_MOTORISTA_INDISPONIVEL_REATIVAR,
      'error',
    ],
  ] as const)(
    "'%s': aviso próprio e recarrega, sem toast de sucesso",
    async (resultado, mensagem, tipo) => {
      mockReativarRota.mockResolvedValue(resultado);
      const { result, loadRotaEParadas } = setupReativar();

      await act(async () => {
        await result.current.handleConfirmReactivate();
      });

      expect(mockShowToast).toHaveBeenCalledWith(mensagem, tipo);
      expect(mockShowToast).toHaveBeenCalledTimes(1);
      expect(loadRotaEParadas).toHaveBeenCalledTimes(1);
    },
  );

  it("erro lançado: 'Erro ao reativar rota', sem recarregar", async () => {
    const erro = new Error('rede');
    mockReativarRota.mockRejectedValue(erro);
    const { result, loadRotaEParadas } = setupReativar();

    await act(async () => {
      await result.current.handleConfirmReactivate();
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      'Erro ao reativar rota',
      'error',
    );
    expect(logger.error).toHaveBeenCalledWith(
      '[useMapaRotaHandlers] Erro ao reativar rota',
      erro,
    );
    expect(loadRotaEParadas).not.toHaveBeenCalled();
  });

  it('toque duplo chama reativarRota uma vez', async () => {
    const adiada = promessaAdiada<'reativada'>();
    mockReativarRota.mockReturnValue(adiada.promessa);
    const { result } = setupReativar();

    let primeira!: Promise<void>;
    let segunda!: Promise<void>;
    act(() => {
      primeira = result.current.handleConfirmReactivate();
      segunda = result.current.handleConfirmReactivate();
    });
    expect(result.current.acaoEmVoo).toBe(true);

    await act(async () => {
      adiada.resolver('reativada');
      await primeira;
      await segunda;
    });

    expect(mockReativarRota).toHaveBeenCalledTimes(1);
    expect(result.current.acaoEmVoo).toBe(false);
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
