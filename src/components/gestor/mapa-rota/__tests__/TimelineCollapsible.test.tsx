import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { TimelineCollapsible } from '../TimelineCollapsible';

const mockFrom = jest.fn();
const mockUseTimelineLastSeen = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

jest.mock('@/hooks/useTimelineLastSeen', () => ({
  useTimelineLastSeen: (...args: any[]) => mockUseTimelineLastSeen(...args),
}));

jest.mock('@/components/RouteTimeline', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    RouteTimeline: ({ rotaId, onUnseenCountChange }: any) => {
      React.useEffect(() => {
        onUnseenCountChange?.(0);
      }, [onUnseenCountChange]);
      return <Text>RouteTimeline {rotaId}</Text>;
    },
  };
});

const createLogsQuery = (data: any[]) => {
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => ({ data })),
  };
  return query;
};

const createParadasQuery = (data: any[]) => {
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    not: jest.fn(() => ({ data })),
  };
  return query;
};

const createIncidentesQuery = (data: any[]) => {
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => ({ data })),
  };
  return query;
};

describe('TimelineCollapsible', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mostra preview com eventos e badge de novos', async () => {
    mockUseTimelineLastSeen.mockReturnValue({
      countNewEvents: jest.fn(() => 2),
      markAllAsSeen: jest.fn(),
      loading: false,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'logs') {
        return createLogsQuery([
          { id: '1', evento: 'motorista_iniciou_rota', timestamp: '2024-01-01T10:00:00.000Z' },
          { id: '2', evento: 'evento_desconhecido', timestamp: '2024-01-01T09:00:00.000Z' },
        ]);
      }
      if (table === 'paradas') {
        return createParadasQuery([
          { id: 'p1', ordem: 1, status: 'concluida', concluida_em: '2024-01-01T11:00:00.000Z' },
          { id: 'p2', ordem: 2, status: 'concluida', concluida_em: '2024-01-01T08:00:00.000Z', is_checkpoint: false },
        ]);
      }
      if (table === 'incidentes') {
        return createIncidentesQuery([
          { id: 'i1', categoria: 'accident', created_at: '2024-01-01T12:00:00.000Z' },
        ]);
      }
      return createLogsQuery([]);
    });

    const { getByText } = render(
      <TimelineCollapsible rotaId="rota-1" rotaCreatedAt="2024-01-01T00:00:00.000Z" />
    );

    await waitFor(() => {
      expect(getByText('Timeline')).toBeTruthy();
      expect(getByText('3')).toBeTruthy();
      expect(getByText('2 novos')).toBeTruthy();
      expect(getByText('Incidente registrado')).toBeTruthy();
    });
  });

  it('mostra estado vazio quando nao ha eventos', async () => {
    mockUseTimelineLastSeen.mockReturnValue({
      countNewEvents: jest.fn(() => 0),
      markAllAsSeen: jest.fn(),
      loading: true,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'logs') return createLogsQuery([]);
      if (table === 'paradas') return createParadasQuery([]);
      if (table === 'incidentes') return createIncidentesQuery([]);
      return createLogsQuery([]);
    });

    const { getByText } = render(<TimelineCollapsible rotaId="rota-2" />);

    await waitFor(() => {
      expect(getByText('Nenhum evento registrado')).toBeTruthy();
    });
  });

  it('expande ao tocar no header', async () => {
    mockUseTimelineLastSeen.mockReturnValue({
      countNewEvents: jest.fn(() => 1),
      markAllAsSeen: jest.fn(),
      loading: false,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'logs') return createLogsQuery([]);
      if (table === 'paradas') return createParadasQuery([]);
      if (table === 'incidentes') return createIncidentesQuery([]);
      return createLogsQuery([]);
    });

    const { getByText, queryByText } = render(
      <TimelineCollapsible rotaId="rota-3" />
    );

    await waitFor(() => {
      expect(getByText('Timeline')).toBeTruthy();
    });

    expect(queryByText('RouteTimeline rota-3')).toBeNull();

    fireEvent.press(getByText('Timeline'));

    await waitFor(() => {
      expect(getByText('RouteTimeline rota-3')).toBeTruthy();
    });
  });
});
