/**
 * useMapaRotaData - tela viva (G1/G15)
 *
 * O motorista conclui a parada 3 com a tela da rota aberta no gestor: a tela
 * tem de mostrar "concluída" sem recarregar, e nenhuma recarga (de evento ou
 * pedida por quem salvou) pode trocar a página por skeleton nem derrubar o
 * gestor da tela. O skeleton é só da primeira carga.
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { logger } from '@/lib/logger';

import { useMapaRotaData } from '../useMapaRotaData';

type Ouvinte = {
  tipo: string;
  filtro: { event: string; table: string; filter?: string };
  cb: (payload?: unknown) => void;
};

const mockOuvintes: Ouvinte[] = [];
let mockStatusCb: ((status: string) => void) | null = null;
let mockSubscribedNaHora = false;
const mockRemoveChannel = jest.fn();

const mockCanal: Record<string, unknown> = {};
mockCanal.on = jest.fn(
  (tipo: string, filtro: Ouvinte['filtro'], cb: Ouvinte['cb']) => {
    mockOuvintes.push({ tipo, filtro, cb });
    return mockCanal;
  },
);
mockCanal.subscribe = jest.fn((cb?: (status: string) => void) => {
  mockStatusCb = cb ?? null;
  if (mockSubscribedNaHora) cb?.('SUBSCRIBED');
  return mockCanal;
});

const mockSingle = jest.fn();
const mockParadasOrder = jest.fn();

const mockFrom = jest.fn((table: string) => {
  if (table === 'rotas') {
    return { select: () => ({ eq: () => ({ single: mockSingle }) }) };
  }
  if (table === 'paradas') {
    return { select: () => ({ eq: () => ({ order: mockParadasOrder }) }) };
  }
  throw new Error(`tabela inesperada "${table}"`);
});

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...(args as [string])),
    channel: jest.fn(() => mockCanal),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

const mockShowToast = jest.fn();
jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const rotaRow = {
  id: 'rota-1',
  data: '2026-10-24',
  status: 'em_andamento',
  motorista_id: 'm-1',
  unidade_id: 'u-1',
  usuarios: { nome: 'Motorista X' },
  unidades: { nome: 'Loja X' },
};

const parada = (id: string, ordem: number, status: string) => ({
  id,
  ordem,
  status,
  endereco: `Rua ${ordem}`,
  tipo: 'entrega',
  latitude: -7,
  longitude: -34,
  is_checkpoint: true,
});

const ouvinte = (tabela: string, evento: string) =>
  mockOuvintes.find(
    (o) => o.filtro.table === tabela && o.filtro.event === evento,
  );

describe('useMapaRotaData: tela viva', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOuvintes.length = 0;
    mockStatusCb = null;
    mockSubscribedNaHora = false;
    mockSingle.mockResolvedValue({ data: rotaRow, error: null });
    mockParadasOrder.mockResolvedValue({
      data: [parada('p1', 1, 'concluida'), parada('p2', 2, 'pendente')],
      error: null,
    });
  });

  it('assina paradas e rotas filtradas pela rota, e NÃO assina DELETE sem filtro', async () => {
    const { result } = renderHook(() => useMapaRotaData({ rotaId: 'rota-1' }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(ouvinte('paradas', '*')?.filtro.filter).toBe('rota_id=eq.rota-1');
    expect(ouvinte('rotas', 'UPDATE')?.filtro.filter).toBe('id=eq.rota-1');
    // O Realtime não aplica RLS em DELETE: sem filtro, a tela receberia a PK
    // de toda parada apagada em qualquer loja. Remoção chega pelos UPDATEs de
    // reordenação/rota que ela dispara (e a tela que remove recarrega).
    expect(
      mockOuvintes.filter((o) => o.filtro.event === 'DELETE'),
    ).toHaveLength(0);
  });

  it('o motorista conclui a parada 2: a tela passa a mostrar concluída sem skeleton', async () => {
    const historicoLoading: boolean[] = [];
    const { result } = renderHook(() => {
      const r = useMapaRotaData({ rotaId: 'rota-1' });
      historicoLoading.push(r.loading);
      return r;
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.resumoParadas.concluidas).toBe(1);

    mockParadasOrder.mockResolvedValue({
      data: [parada('p1', 1, 'concluida'), parada('p2', 2, 'concluida')],
      error: null,
    });
    const aposPrimeiraCarga = historicoLoading.length;

    act(() => {
      ouvinte('paradas', '*')!.cb({ eventType: 'UPDATE' });
    });

    await waitFor(() =>
      expect(result.current.resumoParadas.concluidas).toBe(2),
    );
    expect(
      historicoLoading.slice(aposPrimeiraCarga).every((l) => l === false),
    ).toBe(true);
  });

  it('uma rajada de eventos vira uma recarga só', async () => {
    const { result } = renderHook(() => useMapaRotaData({ rotaId: 'rota-1' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockParadasOrder.mockClear();

    act(() => {
      for (let i = 0; i < 5; i += 1) ouvinte('paradas', '*')!.cb({});
    });

    await waitFor(() => expect(mockParadasOrder).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 600));
    expect(mockParadasOrder).toHaveBeenCalledTimes(1);
  });

  it('mudança na rota (ex.: cancelada) também recarrega', async () => {
    const { result } = renderHook(() => useMapaRotaData({ rotaId: 'rota-1' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockSingle.mockResolvedValue({
      data: { ...rotaRow, status: 'cancelada' },
      error: null,
    });

    act(() => {
      ouvinte('rotas', 'UPDATE')!.cb({});
    });

    await waitFor(() => expect(result.current.rota?.status).toBe('cancelada'));
  });

  it('ao (re)conectar o canal revalida: cobre o intervalo sem eventos', async () => {
    const { result } = renderHook(() => useMapaRotaData({ rotaId: 'rota-1' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockParadasOrder.mockClear();

    act(() => {
      mockStatusCb!('SUBSCRIBED');
    });
    await waitFor(() => expect(mockParadasOrder).toHaveBeenCalledTimes(1));

    act(() => {
      mockStatusCb!('CHANNEL_ERROR');
    });
    expect(mockParadasOrder).toHaveBeenCalledTimes(1);

    act(() => {
      mockStatusCb!('SUBSCRIBED');
    });
    await waitFor(() => expect(mockParadasOrder).toHaveBeenCalledTimes(2));
  });

  it('desmontar remove o canal e cancela a recarga pendente', async () => {
    const { result, unmount } = renderHook(() =>
      useMapaRotaData({ rotaId: 'rota-1' }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockParadasOrder.mockClear();

    act(() => {
      ouvinte('paradas', '*')!.cb({});
    });
    unmount();

    expect(mockRemoveChannel).toHaveBeenCalledWith(mockCanal);
    await new Promise((r) => setTimeout(r, 600));
    expect(mockParadasOrder).not.toHaveBeenCalled();
  });

  it('recarregarSilencioso (para quem salva) não liga o skeleton', async () => {
    const historicoLoading: boolean[] = [];
    const { result } = renderHook(() => {
      const r = useMapaRotaData({ rotaId: 'rota-1' });
      historicoLoading.push(r.loading);
      return r;
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const aposPrimeiraCarga = historicoLoading.length;
    mockParadasOrder.mockResolvedValue({
      data: [parada('p1', 1, 'concluida')],
      error: null,
    });

    await act(async () => {
      await result.current.recarregarSilencioso();
    });

    expect(result.current.paradas).toHaveLength(1);
    expect(
      historicoLoading.slice(aposPrimeiraCarga).every((l) => l === false),
    ).toBe(true);
  });

  it('recarga silenciosa que falha mantém a tela: sem onError, sem toast', async () => {
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useMapaRotaData({ rotaId: 'rota-1', onError }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockParadasOrder.mockResolvedValue({
      data: null,
      error: new Error('rede'),
    });

    await act(async () => {
      await result.current.recarregarSilencioso();
    });

    expect(onError).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
    expect(result.current.paradas).toHaveLength(2);
    expect(result.current.loading).toBe(false);
  });

  it('falha na PRIMEIRA carga segue avisando e chamando onError', async () => {
    const onError = jest.fn();
    mockSingle.mockResolvedValue({ data: null, error: new Error('x') });
    const { result } = renderHook(() =>
      useMapaRotaData({ rotaId: 'rota-1', onError }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(onError).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith(
      'Não foi possível carregar os dados da rota',
      'error',
    );
  });

  it('resposta velha que chega depois da nova é descartada', async () => {
    const { result } = renderHook(() => useMapaRotaData({ rotaId: 'rota-1' }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let liberaVelha!: (v: unknown) => void;
    mockParadasOrder.mockReturnValueOnce(
      new Promise((resolve) => {
        liberaVelha = resolve;
      }),
    );
    mockParadasOrder.mockResolvedValueOnce({
      data: [parada('p1', 1, 'concluida'), parada('p2', 2, 'concluida')],
      error: null,
    });

    let velha!: Promise<void>;
    let nova!: Promise<void>;
    act(() => {
      velha = result.current.recarregarSilencioso();
      nova = result.current.recarregarSilencioso();
    });
    await act(async () => {
      await nova;
    });
    await act(async () => {
      liberaVelha({ data: [parada('p1', 1, 'pendente')], error: null });
      await velha;
    });

    expect(result.current.resumoParadas.concluidas).toBe(2);
  });

  describe('SUBSCRIBED durante a primeira carga (o skeleton não pode ficar preso)', () => {
    /** Primeira leitura de paradas fica pendente até `liberar`. */
    function primeiraCargaLenta() {
      let liberar!: (v: unknown) => void;
      mockParadasOrder.mockReturnValueOnce(
        new Promise((resolve) => {
          liberar = resolve;
        }),
      );
      return (v: unknown) => liberar(v);
    }
    const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

    it('a recarga do SUBSCRIBED vence a 1ª carga: loading desliga e os dados aparecem', async () => {
      mockSubscribedNaHora = true;
      const liberar = primeiraCargaLenta();
      mockParadasOrder.mockResolvedValue({
        data: [parada('p1', 1, 'concluida'), parada('p2', 2, 'concluida')],
        error: null,
      });

      const { result } = renderHook(() =>
        useMapaRotaData({ rotaId: 'rota-1' }),
      );
      expect(result.current.loading).toBe(true);

      // O debounce (300 ms) vence e a recarga termina antes da 1ª carga.
      await act(async () => {
        await esperar(500);
      });
      await act(async () => {
        liberar({ data: [parada('p1', 1, 'pendente')], error: null });
        await esperar(0);
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.resumoParadas.concluidas).toBe(2);
    });

    it('a recarga que venceu falha antes de qualquer sucesso: vale como falha da 1ª carga (toast e onError)', async () => {
      mockSubscribedNaHora = true;
      const onError = jest.fn();
      const liberar = primeiraCargaLenta();
      mockParadasOrder.mockResolvedValue({
        data: null,
        error: new Error('rede'),
      });

      const { result } = renderHook(() =>
        useMapaRotaData({ rotaId: 'rota-1', onError }),
      );

      await act(async () => {
        await esperar(500);
      });
      await act(async () => {
        liberar({ data: [parada('p1', 1, 'pendente')], error: null });
        await esperar(0);
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(onError).toHaveBeenCalledTimes(1);
      expect(mockShowToast).toHaveBeenCalledWith(
        'Não foi possível carregar os dados da rota',
        'error',
      );
    });
  });
});
