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

  // O resumo era buscado só na montagem: com a tela aberta, o motorista
  // concluía paradas (cartões e mapa atualizavam pelo realtime da tela) e o
  // resumo seguia "Parada #1 concluída" até recarregar a página.
  it('rebusca o resumo quando o sinal de atualização da tela muda', async () => {
    mockUseTimelineLastSeen.mockReturnValue({
      countNewEvents: jest.fn(() => 0),
      markAllAsSeen: jest.fn(),
      loading: false,
    });

    let paradas: any[] = [
      { id: 'p1', ordem: 1, status: 'concluida', concluida_em: '2024-01-01T10:00:00.000Z' },
    ];
    mockFrom.mockImplementation((table: string) => {
      if (table === 'logs') return createLogsQuery([]);
      if (table === 'paradas') return createParadasQuery(paradas);
      if (table === 'incidentes') return createIncidentesQuery([]);
      return createLogsQuery([]);
    });

    const { getByText, queryByText, rerender } = render(
      <TimelineCollapsible rotaId="rota-4" sinalAtualizacao="p1:concluida" />,
    );

    await waitFor(() => {
      expect(getByText('Parada #1 concluída')).toBeTruthy();
    });

    paradas = [
      ...paradas,
      { id: 'p2', ordem: 2, status: 'concluida', concluida_em: '2024-01-01T11:00:00.000Z' },
    ];
    rerender(
      <TimelineCollapsible
        rotaId="rota-4"
        sinalAtualizacao="p1:concluida|p2:concluida"
      />,
    );

    await waitFor(() => {
      expect(getByText('Parada #2 concluída')).toBeTruthy();
    });
    expect(queryByText('Parada #1 concluída')).toBeNull();
    expect(getByText('2')).toBeTruthy();
  });

  it('recalcula o selo de novos quando a rebusca traz evento novo', async () => {
    mockUseTimelineLastSeen.mockReturnValue({
      countNewEvents: jest.fn((eventos: unknown[]) => eventos.length),
      markAllAsSeen: jest.fn(),
      loading: false,
    });
    let paradas = [
      { id: 'p1', ordem: 1, status: 'concluida', concluida_em: '2024-01-01T10:00:00.000Z' },
    ];
    mockFrom.mockImplementation((table: string) => {
      if (table === 'logs') return createLogsQuery([]);
      if (table === 'paradas') return createParadasQuery(paradas);
      if (table === 'incidentes') return createIncidentesQuery([]);
      return createLogsQuery([]);
    });

    const { getByText, rerender } = render(
      <TimelineCollapsible rotaId="rota-6" sinalAtualizacao="p1:concluida" />,
    );
    await waitFor(() => expect(getByText('1 novo')).toBeTruthy());

    paradas = [
      ...paradas,
      { id: 'p2', ordem: 2, status: 'concluida', concluida_em: '2024-01-01T11:00:00.000Z' },
    ];
    rerender(
      <TimelineCollapsible
        rotaId="rota-6"
        sinalAtualizacao="p1:concluida|p2:concluida"
      />,
    );

    await waitFor(() => expect(getByText('2 novos')).toBeTruthy());
  });

  it('não rebusca quando o sinal não muda', async () => {
    mockUseTimelineLastSeen.mockReturnValue({
      countNewEvents: jest.fn(() => 0),
      markAllAsSeen: jest.fn(),
      loading: false,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'logs') return createLogsQuery([]);
      if (table === 'paradas') return createParadasQuery([]);
      if (table === 'incidentes') return createIncidentesQuery([]);
      return createLogsQuery([]);
    });

    const { getByText, rerender } = render(
      <TimelineCollapsible rotaId="rota-5" sinalAtualizacao="x" />,
    );
    await waitFor(() =>
      expect(getByText('Nenhum evento registrado')).toBeTruthy(),
    );
    const chamadas = mockFrom.mock.calls.length;

    rerender(<TimelineCollapsible rotaId="rota-5" sinalAtualizacao="x" />);
    await waitFor(() =>
      expect(getByText('Nenhum evento registrado')).toBeTruthy(),
    );
    expect(mockFrom.mock.calls.length).toBe(chamadas);
  });
});
