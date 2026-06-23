import { renderHook, waitFor } from '@testing-library/react-native';

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
