/**
 * MapaMobile – balão sobreposto ao mapa (nativo).
 *
 * POR QUE EXISTE. No Android, cada <Marker> vira uma view filha do MapView
 * na ordem de criação: o último é desenhado por cima, mas o hit-test
 * (`findMarkerAtPoint`) devolve o PRIMEIRO da lista. Com o balão dentro do
 * Marker, o balão do pino 3 ficava por baixo do pino 4, e nenhuma ordem
 * resolve desenho e toque juntos. O balão saiu do Marker: é uma View comum,
 * irmã do <Map>, posicionada por `mapRef.project()` — e por isso recebe
 * toque de verdade (Ligar, Copiar endereço, abrir as ações).
 */

import { act, fireEvent, render, within } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';

const mockProject = jest.fn();
const mockEaseTo = jest.fn();
let mapProps: Record<string, (...a: unknown[]) => void> = {};

jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const createView =
    (testID: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(View, { testID, ...props }, children);

  const Map = React.forwardRef(
    (
      { children, ...props }: { children?: React.ReactNode },
      ref: React.Ref<unknown>,
    ) => {
      mapProps = props as typeof mapProps;
      React.useImperativeHandle(ref, () => ({ project: mockProject }));
      return React.createElement(View, { testID: 'map-view' }, children);
    },
  );
  const Camera = React.forwardRef((_: unknown, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({
      easeTo: mockEaseTo,
      fitBounds: jest.fn(),
      flyTo: jest.fn(),
      jumpTo: jest.fn(),
      setStop: jest.fn(),
      zoomTo: jest.fn(),
    }));
    return null;
  });
  return {
    __esModule: true,
    Map,
    Camera,
    Marker: createView('marker'),
    GeoJSONSource: createView('shape-source'),
    Layer: createView('line-layer'),
  };
});

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

const mockSetString = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-clipboard', () => ({
  setStringAsync: (...a: unknown[]) => mockSetString(...a),
}));

jest.mock('@/hooks/useRouteDirections', () => ({
  useRouteDirections: () => ({
    routeCoordinates: [],
    routeInfo: null,
    isLoading: false,
  }),
}));

jest.mock('@/components/MotoristaMarker', () => ({
  MotoristaMarker: () => null,
}));

import { MapaMobile } from '../MapaMobile';

const partida = {
  id: 'cp0',
  ordem: 0,
  endereco: 'Base, 1',
  latitude: -25.42,
  longitude: -49.27,
  status: 'pendente' as const,
  is_checkpoint: false,
};

const parada = {
  id: 'p1',
  ordem: 1,
  endereco: 'Rua Teste, 100',
  latitude: -25.43,
  longitude: -49.28,
  status: 'pendente' as const,
  is_checkpoint: true,
  tipo: 'entrega' as const,
  telefone: '83999990000',
};

/** Área do mapa medida (dp), como o onLayout entregaria. */
async function medirMapa(
  utils: ReturnType<typeof render>,
  largura = 400,
  altura = 700,
) {
  await act(async () => {
    fireEvent(utils.getByTestId('mapa-camada-balao'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: largura, height: altura } },
    });
  });
}

/** O balão mede o próprio tamanho antes de se posicionar. */
async function medirBalao(utils: ReturnType<typeof render>) {
  await act(async () => {
    fireEvent(utils.getByTestId('mapa-balao'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 120 } },
    });
  });
}

/** Fim da animação da câmera. */
async function cameraParou() {
  await act(async () => {
    mapProps.onRegionDidChange?.({ nativeEvent: {} });
  });
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockProject.mockResolvedValue([200, 500]);
});

describe('MapaMobile – balão sobreposto', () => {
  it('selecionar centraliza o pino deixando espaço para o balão acima', async () => {
    render(<MapaMobile paradas={[partida, parada]} selectedParadaId="p1" />);
    await act(async () => {});

    expect(mockEaseTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [parada.longitude, parada.latitude],
        padding: expect.objectContaining({ top: expect.any(Number) }),
      }),
    );
    expect(mockEaseTo.mock.calls[0][0].padding.top).toBeGreaterThan(0);
  });

  it('o balão não é filho do Marker: fica sobre o mapa, na posição projetada', async () => {
    const utils = render(
      <MapaMobile paradas={[partida, parada]} selectedParadaId="p1" />,
    );
    await medirMapa(utils);
    await cameraParou();
    await medirBalao(utils);

    for (const marker of utils.getAllByTestId('marker')) {
      expect(within(marker).queryByText('Rua Teste, 100')).toBeNull();
    }
    const balao = utils.getByTestId('mapa-balao');
    expect(within(balao).getByText('Rua Teste, 100')).toBeTruthy();
    expect(mockProject).toHaveBeenCalledWith([
      parada.longitude,
      parada.latitude,
    ]);
    // Centralizado no x do pino e todo acima dele.
    const estilo = Object.assign({}, ...[balao.props.style].flat(3));
    expect(estilo.left).toBe(200 - 100);
    expect(estilo.top + 120).toBeLessThanOrEqual(500);
  });

  it('tocar no balão abre as ações da parada', async () => {
    const onSelectedMarkerPress = jest.fn();
    const utils = render(
      <MapaMobile
        paradas={[partida, parada]}
        selectedParadaId="p1"
        onSelectedMarkerPress={onSelectedMarkerPress}
      />,
    );
    await medirMapa(utils);
    await cameraParou();
    await medirBalao(utils);

    fireEvent.press(utils.getByText(/Toque para ver ações/));

    expect(onSelectedMarkerPress).toHaveBeenCalledWith('p1');
  });

  it('o Ligar do balão abre o discador', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const utils = render(
      <MapaMobile paradas={[partida, parada]} selectedParadaId="p1" />,
    );
    await medirMapa(utils);
    await cameraParou();
    await medirBalao(utils);

    fireEvent.press(utils.getByLabelText('Ligar para 83999990000'));

    expect(openURL).toHaveBeenCalledWith('tel:83999990000');
  });

  it('some enquanto o mapa se move e reaparece reprojetado', async () => {
    const utils = render(
      <MapaMobile paradas={[partida, parada]} selectedParadaId="p1" />,
    );
    await medirMapa(utils);
    await cameraParou();
    await medirBalao(utils);
    expect(utils.queryByTestId('mapa-balao')).toBeTruthy();

    await act(async () => {
      mapProps.onRegionWillChange?.({ nativeEvent: {} });
    });
    expect(utils.queryByTestId('mapa-balao')).toBeNull();

    mockProject.mockResolvedValue([150, 400]);
    await cameraParou();
    await medirBalao(utils);
    const estilo = Object.assign(
      {},
      ...[utils.getByTestId('mapa-balao').props.style].flat(3),
    );
    expect(estilo.left).toBe(150 - 100);
  });

  it('pino fora da área visível: sem balão', async () => {
    mockProject.mockResolvedValue([900, 500]);
    const utils = render(
      <MapaMobile paradas={[partida, parada]} selectedParadaId="p1" />,
    );
    await medirMapa(utils);
    await cameraParou();

    expect(utils.queryByTestId('mapa-balao')).toBeNull();
  });

  it('sem onSelectedMarkerPress (gestor): balão sem a dica de ações', async () => {
    const utils = render(
      <MapaMobile paradas={[partida, parada]} selectedParadaId="p1" />,
    );
    await medirMapa(utils);
    await cameraParou();
    await medirBalao(utils);

    expect(utils.getByText('Rua Teste, 100')).toBeTruthy();
    expect(utils.queryByText(/Toque para ver ações/)).toBeNull();
  });

  it('PARTIDA: o balão aparece sobre o mapa e o "Copiar endereço" funciona', async () => {
    const utils = render(<MapaMobile paradas={[partida, parada]} />);
    await medirMapa(utils);

    await act(async () => {
      fireEvent(utils.getAllByTestId('marker')[0], 'press', {
        stopPropagation: jest.fn(),
      });
    });
    expect(mockEaseTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [partida.longitude, partida.latitude],
      }),
    );
    await cameraParou();
    await medirBalao(utils);

    const balao = utils.getByTestId('mapa-balao');
    fireEvent.press(within(balao).getByText('Copiar endereço'));
    await act(async () => {});

    expect(mockSetString).toHaveBeenCalledWith('Base, 1');
  });

  // Câmera que já está no lugar não emite onRegionDidChange: o balão tem de
  // aparecer pelo fim nominal da animação.
  it('sem nenhum evento de região, o balão aparece ao fim da animação', async () => {
    jest.useFakeTimers();
    const utils = render(
      <MapaMobile paradas={[partida, parada]} selectedParadaId="p1" />,
    );
    await medirMapa(utils);
    expect(utils.queryByTestId('mapa-balao')).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await medirBalao(utils);

    expect(utils.getByTestId('mapa-balao')).toBeTruthy();
  });

  it('se a câmera começou a se mover, o fim nominal não traz o balão no meio do movimento', async () => {
    jest.useFakeTimers();
    const utils = render(
      <MapaMobile paradas={[partida, parada]} selectedParadaId="p1" />,
    );
    await medirMapa(utils);
    await act(async () => {
      mapProps.onRegionWillChange?.({ nativeEvent: {} });
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(utils.queryByTestId('mapa-balao')).toBeNull();
    await cameraParou();
    await medirBalao(utils);
    expect(utils.getByTestId('mapa-balao')).toBeTruthy();
  });

  it('resposta atrasada do project() de uma seleção antiga é descartada', async () => {
    let resolverAntiga: (p: [number, number]) => void = () => {};
    mockProject.mockImplementationOnce(
      () => new Promise((r) => (resolverAntiga = r)),
    );
    const outra = {
      ...parada,
      id: 'p2',
      ordem: 2,
      endereco: 'Rua Outra, 2',
      latitude: -25.5,
      longitude: -49.3,
    };
    const utils = render(
      <MapaMobile paradas={[partida, parada, outra]} selectedParadaId="p1" />,
    );
    await medirMapa(utils);
    await cameraParou(); // project(p1) fica pendente

    mockProject.mockResolvedValue([120, 450]);
    utils.rerender(
      <MapaMobile paradas={[partida, parada, outra]} selectedParadaId="p2" />,
    );
    await cameraParou();
    await act(async () => {
      resolverAntiga([380, 600]); // chega depois: não pode mover o balão
    });
    await medirBalao(utils);

    const estilo = Object.assign(
      {},
      ...[utils.getByTestId('mapa-balao').props.style].flat(3),
    );
    expect(estilo.left).toBe(120 - 100);
  });

  it('balão que sairia pelo topo do mapa fica escondido', async () => {
    mockProject.mockResolvedValue([200, 100]); // pino perto do topo
    const utils = render(
      <MapaMobile paradas={[partida, parada]} selectedParadaId="p1" />,
    );
    await medirMapa(utils);
    await cameraParou();
    await medirBalao(utils); // 120 de altura + pino: não cabe acima de y=100

    const balao = utils.queryByTestId('mapa-balao');
    const estilo = balao
      ? Object.assign({}, ...[balao.props.style].flat(3))
      : null;
    expect(estilo?.opacity).toBe(0);
  });

  it('tocar no pino da parada selecionada fecha o balão da PARTIDA', async () => {
    const onSelectedMarkerPress = jest.fn();
    const utils = render(
      <MapaMobile
        paradas={[partida, parada]}
        selectedParadaId="p1"
        onSelectedMarkerPress={onSelectedMarkerPress}
      />,
    );
    await medirMapa(utils);
    await act(async () => {
      fireEvent(utils.getAllByTestId('marker')[0], 'press', {
        stopPropagation: jest.fn(),
      });
    });
    await cameraParou();
    await medirBalao(utils);
    expect(utils.getByText('Copiar endereço')).toBeTruthy();

    await act(async () => {
      fireEvent(utils.getAllByTestId('marker')[1], 'press', {
        stopPropagation: jest.fn(),
      });
    });

    expect(onSelectedMarkerPress).toHaveBeenCalledWith('p1');
    expect(utils.queryByText('Copiar endereço')).toBeNull();
  });

  it('o espaço reservado para o balão cabe em mapa baixo (gestor no celular)', async () => {
    const utils = render(<MapaMobile paradas={[partida, parada]} />);
    await medirMapa(utils, 360, 400);
    utils.rerender(
      <MapaMobile paradas={[partida, parada]} selectedParadaId="p1" />,
    );
    await act(async () => {});

    const topo = mockEaseTo.mock.calls.at(-1)?.[0].padding.top;
    expect(topo).toBeGreaterThan(0);
    expect(topo).toBeLessThanOrEqual(400 * 0.45);
  });
});
