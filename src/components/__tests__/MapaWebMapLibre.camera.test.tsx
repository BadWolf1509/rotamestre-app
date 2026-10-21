/**
 * MapaWebMapLibre – câmera estável entre renders
 *
 * O `useUnistyles()` real devolve um proxy NOVO de `theme` a cada render; com
 * `theme` nas dependências, o efeito dos marcadores rodava de novo em qualquer
 * re-render e o `fitBounds` devolvia o mapa à visão geral, perdendo o pan/zoom
 * do usuário (a mesma classe do PR #594 no nativo). O mock global do
 * Unistyles devolve um theme novo por chamada justamente para pegar isso.
 *
 * Aqui o mapa inicializa de verdade: o `createNodeMock` dá ao `<div>` um nó,
 * e o evento `load` do maplibre é disparado à mão.
 */

import { act, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/components/map/hooks/useMotoristaLocationMapLibre', () => ({
  useMotoristaLocationMapLibre: () => ({ location: null }),
}));

jest.mock('@/hooks/useRouteDirections', () => ({
  useRouteDirections: () => ({ routeCoordinates: [] }),
}));

jest.mock('@/lib/openFreeMapStyle', () => ({
  getOpenFreeMapStyle: jest.fn().mockResolvedValue('mock-style-url'),
  installOpenFreeMapMissingImageHandler: jest.fn(() => jest.fn()),
}));

type Handler = (...args: unknown[]) => void;

const mockMapa = {
  handlers: new Map<string, Handler>(),
  fitBounds: jest.fn(),
  flyTo: jest.fn(),
};
const mockPopup = jest.fn();

jest.mock('maplibre-gl', () => {
  const MockMap = jest.fn().mockImplementation(() => ({
    on: jest.fn((evento: string, ...resto: unknown[]) => {
      // on('load', fn) — handlers de camada (on('click', layer, fn)) não importam aqui
      if (resto.length === 1)
        mockMapa.handlers.set(evento, resto[0] as Handler);
    }),
    off: jest.fn(),
    addControl: jest.fn(),
    remove: jest.fn(),
    getLayer: jest.fn(() => undefined),
    getSource: jest.fn(() => undefined),
    addSource: jest.fn(),
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    removeSource: jest.fn(),
    setPaintProperty: jest.fn(),
    getCanvas: jest.fn(() => ({ style: {} })),
    fitBounds: mockMapa.fitBounds,
    flyTo: mockMapa.flyTo,
    style: {},
  }));
  const Popup = jest.fn().mockImplementation(() => {
    mockPopup();
    const popup = {
      setLngLat: jest.fn(() => popup),
      setHTML: jest.fn(() => popup),
      addTo: jest.fn(() => popup),
      remove: jest.fn(),
      getElement: jest.fn(() => null),
    };
    return popup;
  });
  const LngLatBounds = jest.fn((sw: unknown, ne: unknown) => ({ sw, ne }));
  const lib = {
    Map: MockMap,
    Marker: jest.fn(),
    NavigationControl: jest.fn(),
    LngLatBounds,
    Popup,
  };
  return { __esModule: true, default: lib, ...lib };
});

import MapaWebMapLibre from '../MapaWebMapLibre';

const paradasDaRota = () => [
  {
    id: 'partida',
    ordem: 0,
    endereco: 'Base',
    latitude: -23.5,
    longitude: -46.6,
    status: 'pendente' as const,
    tipo: 'entrega' as const,
    is_checkpoint: false,
  },
  {
    id: 'p1',
    ordem: 1,
    endereco: 'Rua A, 1',
    latitude: -23.55,
    longitude: -46.63,
    status: 'pendente' as const,
    tipo: 'entrega' as const,
    is_checkpoint: true,
  },
  {
    id: 'p2',
    ordem: 2,
    endereco: 'Rua B, 2',
    latitude: -23.6,
    longitude: -46.7,
    status: 'pendente' as const,
    tipo: 'entrega' as const,
    is_checkpoint: true,
  },
];

// O mesmo array em todo render: só o theme muda entre renders.
const PARADAS = paradasDaRota();

// Callbacks estáveis, como as telas passam (useCallback): o teste isola o theme.
const onMapPress = jest.fn();
const onMarkerPress = jest.fn();

type Props = Partial<React.ComponentProps<typeof MapaWebMapLibre>>;

function elemento(props: Props = {}) {
  return (
    <MapaWebMapLibre
      paradas={PARADAS}
      onMapPress={onMapPress}
      onMarkerPress={onMarkerPress}
      unidadeNome="Unidade"
      {...props}
    />
  );
}

async function renderizarCarregado(props: Props = {}) {
  const tela = render(elemento(props), { createNodeMock: () => ({}) });
  // getOpenFreeMapStyle resolve numa microtask; depois o 'load' do maplibre.
  await act(async () => {});
  act(() => {
    mockMapa.handlers.get('load')?.();
  });
  return tela;
}

describe('MapaWebMapLibre – câmera estável entre renders', () => {
  beforeEach(() => {
    mockMapa.handlers.clear();
    mockMapa.fitBounds.mockClear();
    mockMapa.flyTo.mockClear();
    mockPopup.mockClear();
  });

  it('enquadra as paradas uma vez quando o mapa carrega', async () => {
    await renderizarCarregado();
    expect(mockMapa.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('re-render sem mudança nas paradas não re-enquadra', async () => {
    const { rerender } = await renderizarCarregado();

    rerender(elemento());
    rerender(elemento());

    expect(mockMapa.fitBounds).toHaveBeenCalledTimes(1);
  });

  // Realtime e refetch entregam um array NOVO com as mesmas paradas.
  it('array novo com as mesmas paradas não re-enquadra', async () => {
    const { rerender } = await renderizarCarregado();

    rerender(elemento({ paradas: paradasDaRota() }));

    expect(mockMapa.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('array novo com as mesmas paradas não reabre o popup nem voa de novo', async () => {
    const { rerender } = await renderizarCarregado({ selectedParadaId: 'p1' });
    const popups = mockPopup.mock.calls.length;
    const voos = mockMapa.flyTo.mock.calls.length;

    rerender(elemento({ selectedParadaId: 'p1', paradas: paradasDaRota() }));

    expect(mockPopup).toHaveBeenCalledTimes(popups);
    expect(mockMapa.flyTo).toHaveBeenCalledTimes(voos);
  });

  it('selecionar uma parada não volta à visão geral', async () => {
    const { rerender } = await renderizarCarregado();

    rerender(elemento({ selectedParadaId: 'p1' }));

    expect(mockMapa.fitBounds).toHaveBeenCalledTimes(1);
    expect(mockMapa.flyTo).toHaveBeenCalledTimes(1);
  });

  it('re-render com seleção não reabre o popup nem voa de novo', async () => {
    const { rerender } = await renderizarCarregado({ selectedParadaId: 'p1' });
    const popups = mockPopup.mock.calls.length;
    const voos = mockMapa.flyTo.mock.calls.length;

    rerender(elemento({ selectedParadaId: 'p1' }));
    rerender(elemento({ selectedParadaId: 'p1' }));

    expect(mockPopup).toHaveBeenCalledTimes(popups);
    expect(mockMapa.flyTo).toHaveBeenCalledTimes(voos);
  });

  it('status da parada selecionada que muda atualiza o popup sem voar', async () => {
    const { rerender } = await renderizarCarregado({ selectedParadaId: 'p1' });
    const popups = mockPopup.mock.calls.length;
    const voos = mockMapa.flyTo.mock.calls.length;

    const concluida = paradasDaRota();
    concluida[1] = { ...concluida[1], status: 'concluida' as never };
    rerender(elemento({ selectedParadaId: 'p1', paradas: concluida }));

    expect(mockPopup).toHaveBeenCalledTimes(popups + 1);
    expect(mockMapa.flyTo).toHaveBeenCalledTimes(voos);
    expect(mockMapa.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('desmarcar e marcar de novo a mesma parada volta a centralizá-la', async () => {
    const { rerender } = await renderizarCarregado({ selectedParadaId: 'p1' });
    const voos = mockMapa.flyTo.mock.calls.length;

    rerender(elemento({ selectedParadaId: null }));
    rerender(elemento({ selectedParadaId: 'p1' }));

    expect(mockMapa.flyTo).toHaveBeenCalledTimes(voos + 1);
  });

  // Entrega e retirada no mesmo local dividem um pino: trocar a seleção entre
  // elas (pela lista) tem de recentralizar e reabrir o popup.
  it('selecionar outro serviço do mesmo pino volta a centralizar e abrir o popup', async () => {
    const comRetirada = [
      ...paradasDaRota(),
      {
        id: 'p3',
        ordem: 3,
        endereco: 'Rua B, 2',
        latitude: -23.6,
        longitude: -46.7,
        status: 'pendente' as const,
        tipo: 'retirada' as const,
        is_checkpoint: true,
      },
    ];
    const { rerender } = await renderizarCarregado({
      paradas: comRetirada,
      selectedParadaId: 'p2',
    });
    const popups = mockPopup.mock.calls.length;
    const voos = mockMapa.flyTo.mock.calls.length;

    rerender(elemento({ paradas: comRetirada, selectedParadaId: 'p3' }));

    expect(mockPopup).toHaveBeenCalledTimes(popups + 1);
    expect(mockMapa.flyTo).toHaveBeenCalledTimes(voos + 1);
  });

  it('reordenar com a parada selecionada atualiza o popup', async () => {
    const { rerender } = await renderizarCarregado({ selectedParadaId: 'p1' });
    const popups = mockPopup.mock.calls.length;

    const reordenadas = paradasDaRota();
    reordenadas[1] = { ...reordenadas[1], ordem: 2 };
    reordenadas[2] = { ...reordenadas[2], ordem: 1 };
    rerender(elemento({ selectedParadaId: 'p1', paradas: reordenadas }));

    expect(mockPopup).toHaveBeenCalledTimes(popups + 1);
  });

  it('paradas que mudam de verdade re-enquadram', async () => {
    const { rerender } = await renderizarCarregado();

    const outras = paradasDaRota();
    outras[2] = { ...outras[2], latitude: -23.9, longitude: -46.9 };
    rerender(elemento({ paradas: outras }));

    expect(mockMapa.fitBounds).toHaveBeenCalledTimes(2);
  });
});
