import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';

import { useTimelineData } from '../useTimelineData';

jest.mock('@/lib/cache', () => ({
  getCache: jest.fn(async () => null),
  setCache: jest.fn(async () => {}),
  clearCache: jest.fn(async () => {}),
  CACHE_TTL: { SHORT: 60000, USER_DATA: 300000 },
}));

jest.mock('@/lib/utils', () => ({
  mapLogToTimelineEvent: (log: any) =>
    log.evento === 'skip'
      ? null
      : {
          id: `log-${log.id}`,
          type: 'status_change',
          timestamp: log.timestamp,
          title: 'L',
          description: '',
          icon: 'flag',
          colorKey: 'info',
        },
  mapParadaToTimelineEvent: (p: any) => ({
    id: `parada-${p.id}`,
    type: 'parada_update',
    timestamp: p.concluida_em,
    title: 'P',
    description: '',
    icon: 'location',
    colorKey: 'success',
  }),
  mapIncidenteToTimelineEvent: (i: any) => ({
    id: `incidente-${i.id}`,
    type: 'incidente',
    timestamp: i.created_at,
    title: 'I',
    description: '',
    icon: 'alert-circle',
    colorKey: 'error',
    isCritical: true,
  }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn(),
    removeChannel: jest.fn(),
    from: jest.fn(),
  },
}));

const chain = (resolveData: any[]) => {
  const m: any = {};
  m.select = jest.fn(() => m);
  m.eq = jest.fn(() => m);
  m.order = jest.fn(() => m);
  m.not = jest.fn(() => m);
  m.limit = jest.fn(() => Promise.resolve({ data: resolveData, error: null }));
  m.range = jest.fn(() => Promise.resolve({ data: [], error: null }));
  m.then = (resolve: any) =>
    Promise.resolve({ data: resolveData, error: null }).then(resolve);
  return m;
};

beforeEach(() => {
  jest.clearAllMocks();
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    if (table === 'logs') {
      return chain([
        { id: '1', evento: 'x', timestamp: '2023-01-01T10:00:00Z' },
      ]);
    }
    if (table === 'paradas') {
      const m = chain([]);
      m.not = jest.fn(() =>
        Promise.resolve({
          data: [{ id: 'p1', concluida_em: '2023-01-01T10:30:00Z' }],
          error: null,
        }),
      );
      return m;
    }
    if (table === 'incidentes') {
      const m = chain([]);
      m.eq = jest.fn(() =>
        Promise.resolve({
          data: [{ id: 'i1', created_at: '2023-01-01T10:15:00Z' }],
          error: null,
        }),
      );
      return m;
    }
    return chain([]);
  });
});

describe('useTimelineData — carga inicial', () => {
  it('busca, mapeia e ordena desc por timestamp', async () => {
    const { result } = renderHook(() =>
      useTimelineData('123', { realtime: false }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.events.map((e) => e.id)).toEqual([
      'parada-p1', // 10:30
      'incidente-i1', // 10:15
      'log-1', // 10:00
    ]);
    expect(result.current.hasMore).toBe(false); // 1 log < PAGE_SIZE
  });
});

describe('useTimelineData — loadMore', () => {
  it('anexa logs antigos, deduplica e atualiza hasMore', async () => {
    const fullPage = Array.from({ length: 50 }, (_, i) => ({
      id: `${i}`,
      evento: 'x',
      timestamp: `2023-01-02T${String(i % 24).padStart(2, '0')}:00:00Z`,
    }));
    const olderPage = [
      { id: 'old', evento: 'x', timestamp: '2022-12-01T10:00:00Z' },
    ];

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'logs') {
        const m = chain(fullPage); // page 1 via limit()
        m.range = jest.fn(() =>
          Promise.resolve({ data: olderPage, error: null }),
        ); // page 2 via range()
        return m;
      }
      if (table === 'paradas') {
        const m = chain([]);
        m.not = jest.fn(() => Promise.resolve({ data: [], error: null }));
        return m;
      }
      if (table === 'incidentes') {
        const m = chain([]);
        m.eq = jest.fn(() => Promise.resolve({ data: [], error: null }));
        return m;
      }
      return chain([]);
    });

    const { result } = renderHook(() =>
      useTimelineData('123', { realtime: false }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasMore).toBe(true); // 50 logs == PAGE_SIZE
    const countBefore = result.current.events.length;

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.events.some((e) => e.id === 'log-old')).toBe(true);
    expect(result.current.events.length).toBe(countBefore + 1);
    expect(result.current.hasMore).toBe(false); // older page had 1 < PAGE_SIZE
  });

  it('loadMore é no-op quando hasMore é false', async () => {
    const { result } = renderHook(() =>
      useTimelineData('123', { realtime: false }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasMore).toBe(false);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.loadingMore).toBe(false);
  });
});

describe('useTimelineData — realtime', () => {
  it('assina o canal quando realtime=true e remove no unmount', async () => {
    const { unmount } = renderHook(() =>
      useTimelineData('123', { realtime: true }),
    );
    await waitFor(() =>
      expect(supabase.channel).toHaveBeenCalledWith(
        expect.stringMatching(/^route-timeline-123#\d+$/),
      ),
    );
    expect((supabase.channel('') as any).subscribe).toHaveBeenCalled();
    unmount();
    expect(supabase.removeChannel).toHaveBeenCalled();
  });

  it('NÃO assina quando realtime=false', async () => {
    renderHook(() => useTimelineData('123', { realtime: false }));
    await waitFor(() => {});
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  // `logs` e `incidentes` não estão na publicação do Realtime: assinatura
  // neles entra em SUBSCRIBED e nunca dispara. A linha do tempo escuta a rota e
  // as paradas (publicadas) e recarrega — o log do gatilho já está gravado.
  it('assina só tabelas publicadas: rota (UPDATE) e paradas (INSERT/UPDATE) da rota', async () => {
    const assinaturas: { event: string; table: string; filter: string }[] = [];
    (supabase.on as jest.Mock).mockImplementation((_evt: string, cfg: any) => {
      assinaturas.push({
        event: cfg.event,
        table: cfg.table,
        filter: cfg.filter,
      });
      return supabase;
    });

    renderHook(() => useTimelineData('123', { realtime: true }));
    await waitFor(() => expect(assinaturas.length).toBeGreaterThan(0));

    expect(assinaturas).toEqual(
      expect.arrayContaining([
        { event: 'UPDATE', table: 'rotas', filter: 'id=eq.123' },
        { event: 'INSERT', table: 'paradas', filter: 'rota_id=eq.123' },
        { event: 'UPDATE', table: 'paradas', filter: 'rota_id=eq.123' },
      ]),
    );
    expect(assinaturas).toHaveLength(3);
  });

  it.each([
    ['rotas', 'UPDATE'],
    ['paradas', 'INSERT'],
    ['paradas', 'UPDATE'],
  ])('evento %s %s recarrega a linha do tempo', async (tabela, evento) => {
    const handlers: Record<string, () => void> = {};
    (supabase.on as jest.Mock).mockImplementation(
      (_evt: string, cfg: any, cb: () => void) => {
        handlers[`${cfg.table}:${cfg.event}`] = cb;
        return supabase;
      },
    );

    const { result } = renderHook(() =>
      useTimelineData('123', { realtime: true }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    (supabase.from as jest.Mock).mockClear();

    await act(async () => {
      handlers[`${tabela}:${evento}`]();
    });

    await waitFor(() => expect(supabase.from).toHaveBeenCalledWith('logs'));
  });
});

// DP-2: o canal da timeline não revalidava na reconexão nem na volta do app
// ao primeiro plano — evento perdido com o socket caído nunca aparecia.
describe('useTimelineData — revalidação', () => {
  const cargasDaPagina1 = () =>
    (supabase.from as jest.Mock).mock.calls.filter(([t]) => t === 'logs')
      .length;

  function espiarAppState() {
    const ouvintes: ((estado: string) => void)[] = [];
    Object.defineProperty(AppState, 'currentState', {
      value: 'active',
      configurable: true,
    });
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_e: string, cb: (estado: string) => void) => {
        ouvintes.push(cb);
        return { remove: jest.fn() } as never;
      });
    return (estado: string) => ouvintes.forEach((cb) => cb(estado));
  }

  afterEach(() => jest.restoreAllMocks());

  it('recarrega na volta a SUBSCRIBED, não no primeiro', async () => {
    const { result } = renderHook(() =>
      useTimelineData('123', { realtime: true }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const status = (supabase.subscribe as jest.Mock).mock.calls[0][0] as (
      s: string,
    ) => void;
    const antes = cargasDaPagina1();

    await act(async () => status('SUBSCRIBED'));
    expect(cargasDaPagina1()).toBe(antes);

    await act(async () => {
      status('TIMED_OUT');
      status('SUBSCRIBED');
    });
    await waitFor(() => expect(cargasDaPagina1()).toBe(antes + 1));
  });

  it('recarrega quando o app volta ao primeiro plano', async () => {
    const disparar = espiarAppState();
    const { result } = renderHook(() =>
      useTimelineData('123', { realtime: true }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const antes = cargasDaPagina1();

    await act(async () => {
      disparar('background');
      disparar('active');
    });
    await waitFor(() => expect(cargasDaPagina1()).toBe(antes + 1));
  });

  // Revisão, M2: na volta ao app a reconexão e o primeiro plano costumam
  // disparar juntos, e cada um recarregava (refresh ignora a deduplicação).
  it('reconexão e volta ao primeiro plano juntas: uma recarga só', async () => {
    const disparar = espiarAppState();
    const { result } = renderHook(() =>
      useTimelineData('123', { realtime: true }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const status = (supabase.subscribe as jest.Mock).mock.calls[0][0] as (
      s: string,
    ) => void;
    await act(async () => status('SUBSCRIBED'));
    const antes = cargasDaPagina1();

    await act(async () => {
      status('CHANNEL_ERROR');
      disparar('background');
      disparar('active');
      status('SUBSCRIBED');
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 800));
    });

    expect(cargasDaPagina1()).toBe(antes + 1);
  });

  it('reconexão com o app em segundo plano não recarrega ali', async () => {
    espiarAppState();
    const { result } = renderHook(() =>
      useTimelineData('123', { realtime: true }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const status = (supabase.subscribe as jest.Mock).mock.calls[0][0] as (
      s: string,
    ) => void;
    await act(async () => status('SUBSCRIBED'));
    const antes = cargasDaPagina1();

    Object.defineProperty(AppState, 'currentState', {
      value: 'background',
      configurable: true,
    });
    try {
      await act(async () => {
        status('TIMED_OUT');
        status('SUBSCRIBED');
        await new Promise((r) => setTimeout(r, 800));
      });
      expect(cargasDaPagina1()).toBe(antes);
    } finally {
      Object.defineProperty(AppState, 'currentState', {
        value: 'active',
        configurable: true,
      });
    }
  });

  it('sem realtime, voltar ao primeiro plano não recarrega', async () => {
    const disparar = espiarAppState();
    const { result } = renderHook(() =>
      useTimelineData('123', { realtime: false }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const antes = cargasDaPagina1();

    await act(async () => {
      disparar('background');
      disparar('active');
    });
    expect(cargasDaPagina1()).toBe(antes);
  });
});

// DAT-1: evento ao vivo recarregava a 1ª página, zerava as páginas de
// "Carregar mais" e (com `loading`) trocava a lista por skeleton.
describe('useTimelineData — recarga com "Carregar mais" aberto', () => {
  const fullPage = Array.from({ length: 50 }, (_, i) => ({
    id: `${i}`,
    evento: 'x',
    timestamp: `2023-01-02T${String(i % 24).padStart(2, '0')}:00:00Z`,
  }));
  const olderPage = [
    { id: 'old', evento: 'x', timestamp: '2022-12-01T10:00:00Z' },
  ];

  it('mantém as páginas abertas, não liga loading e preserva hasMore', async () => {
    const limites: number[] = [];
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'logs') {
        const m = chain(fullPage);
        m.limit = jest.fn((n: number) => {
          limites.push(n);
          return Promise.resolve({
            data: n > 50 ? [...fullPage, ...olderPage] : fullPage,
            error: null,
          });
        });
        m.range = jest.fn(() =>
          Promise.resolve({ data: olderPage, error: null }),
        );
        return m;
      }
      if (table === 'paradas') {
        const m = chain([]);
        m.not = jest.fn(() => Promise.resolve({ data: [], error: null }));
        return m;
      }
      if (table === 'incidentes') {
        const m = chain([]);
        m.eq = jest.fn(() => Promise.resolve({ data: [], error: null }));
        return m;
      }
      return chain([]);
    });
    const handlers: Record<string, () => void> = {};
    (supabase.on as jest.Mock).mockImplementation(
      (_evt: string, cfg: any, cb: () => void) => {
        if (cfg.table === 'paradas') handlers.parada = cb;
        return supabase;
      },
    );

    const { result } = renderHook(() =>
      useTimelineData('123', { realtime: true }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.events.some((e) => e.id === 'log-old')).toBe(true);
    expect(result.current.hasMore).toBe(false);

    const loadings: boolean[] = [];
    await act(async () => {
      handlers.parada();
      loadings.push(result.current.loading);
    });
    await waitFor(() => expect(limites).toContain(100));

    expect(loadings).not.toContain(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.events.some((e) => e.id === 'log-old')).toBe(true);
    expect(result.current.hasMore).toBe(false);
  });
});
