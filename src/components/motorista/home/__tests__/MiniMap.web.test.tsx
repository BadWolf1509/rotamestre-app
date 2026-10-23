/**
 * @jest-environment jsdom
 */

/**
 * MiniMap.web — ciclo de vida do mapa maplibre-gl.
 *
 * O `createNodeMock` dá ao `<div>` um nó, e os eventos `load`/`error` do
 * maplibre são disparados à mão.
 */

import { act, render } from '@testing-library/react-native';
import * as maplibregl from 'maplibre-gl';
import React from 'react';
import { StyleSheet } from 'react-native';

import { logger } from '@/lib/logger';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('@/hooks/useRouteDirections', () => ({
  useRouteDirections: () => ({
    routeCoordinates: [],
    routeInfo: null,
    isLoading: false,
    error: null,
  }),
}));

jest.mock('@/lib/maplibreWorker', () => ({
  configureMaplibreWorker: jest.fn(),
}));

jest.mock('@/lib/openFreeMapStyle', () => ({
  getOpenFreeMapStyle: jest.fn().mockResolvedValue('mock-style-url'),
  installOpenFreeMapMissingImageHandler: jest.fn(() => jest.fn()),
}));

type Handler = (...args: unknown[]) => void;

const mockMapa = {
  handlers: new Map<string, Handler>(),
  instancias: [] as Array<Record<string, jest.Mock>>,
  marcadores: [] as Array<Record<string, jest.Mock>>,
};

jest.mock('maplibre-gl', () => {
  const MockMap = jest.fn().mockImplementation(() => {
    const mapa = {
      on: jest.fn((evento: string, handler: Handler) => {
        mockMapa.handlers.set(evento, handler);
      }),
      remove: jest.fn(),
      fitBounds: jest.fn(),
      setCenter: jest.fn(),
      setZoom: jest.fn(),
      getLayer: jest.fn(() => undefined),
      getSource: jest.fn(() => undefined),
      addSource: jest.fn(),
      addLayer: jest.fn(),
      removeLayer: jest.fn(),
      removeSource: jest.fn(),
    };
    mockMapa.instancias.push(mapa);
    return mapa;
  });
  const Marker = jest.fn().mockImplementation((opcoes: unknown) => {
    const marker = {
      opcoes,
      setLngLat: jest.fn(() => marker),
      addTo: jest.fn(() => marker),
      remove: jest.fn(),
    };
    mockMapa.marcadores.push(marker as never);
    return marker;
  });
  const LngLatBounds = jest.fn().mockImplementation(() => {
    const bounds = { extend: jest.fn(() => bounds) };
    return bounds;
  });
  const lib = { Map: MockMap, Marker, LngLatBounds };
  return { __esModule: true, default: lib, ...lib };
});

import { MiniMap } from '../MiniMap.web';

const MockMap = maplibregl.Map as unknown as jest.Mock;
const MockMarker = maplibregl.Marker as unknown as jest.Mock;

type Parada = React.ComponentProps<typeof MiniMap>['paradas'][number];

const paradas = (statusP1 = 'pendente'): Parada[] => [
  {
    id: 'partida',
    ordem: 0,
    endereco: 'Base',
    latitude: -23.5,
    longitude: -46.6,
    status: 'concluida',
    is_checkpoint: false,
  },
  {
    id: 'p1',
    ordem: 1,
    endereco: 'Rua A',
    latitude: -23.55,
    longitude: -46.63,
    status: statusP1,
  },
  {
    id: 'p2',
    ordem: 2,
    endereco: 'Rua B',
    latitude: -23.6,
    longitude: -46.7,
    status: 'pendente',
  },
];

// O mesmo array em todo render, como a tela passa entre leituras do GPS.
const PARADAS = paradas();
const onOpenFullMap = jest.fn();

type Props = Partial<React.ComponentProps<typeof MiniMap>>;

function elemento(props: Props = {}) {
  return <MiniMap paradas={PARADAS} onOpenFullMap={onOpenFullMap} {...props} />;
}

async function renderizar(props: Props = {}) {
  const tela = render(elemento(props), { createNodeMock: () => ({}) });
  // getOpenFreeMapStyle resolve numa microtask.
  await act(async () => {});
  return tela;
}

async function renderizarCarregado(props: Props = {}) {
  const tela = await renderizar(props);
  act(() => {
    mockMapa.handlers.get('load')?.();
  });
  return tela;
}

const mapa = () => mockMapa.instancias[mockMapa.instancias.length - 1];

// O mock global não é __esModule: requireMock devolve o objeto que o
// componente usa, para o spy pegar.
const estilos = jest.requireMock<{
  useUnistyles: () => { theme: { colors: Record<string, string> } };
}>('@/utils/styles');
const base = estilos.useUnistyles();

describe('MiniMap.web', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    mockMapa.handlers.clear();
    mockMapa.instancias = [];
    mockMapa.marcadores = [];
  });

  describe('mapa criado uma vez', () => {
    it('parada concluída não recria o mapa, só move a câmera', async () => {
      const { rerender } = await renderizarCarregado();
      expect(MockMap).toHaveBeenCalledTimes(1);
      const camera =
        mapa().fitBounds.mock.calls.length + mapa().setCenter.mock.calls.length;

      rerender(elemento({ paradas: paradas('concluida') }));
      await act(async () => {});

      expect(MockMap).toHaveBeenCalledTimes(1);
      expect(mapa().remove).not.toHaveBeenCalled();
      expect(
        mapa().fitBounds.mock.calls.length + mapa().setCenter.mock.calls.length,
      ).toBeGreaterThan(camera);
    });

    it('remove o mapa ao desmontar', async () => {
      const { unmount } = await renderizarCarregado();
      unmount();
      expect(mapa().remove).toHaveBeenCalledTimes(1);
    });
  });

  describe('erro do mapa', () => {
    it('erro depois do load (tile, glifo) mantém o mapa e só avisa', async () => {
      const aviso = jest.spyOn(logger, 'warn');
      const { queryByText, getByTestId } = await renderizarCarregado({
        testID: 'mini',
      });

      act(() => {
        mockMapa.handlers.get('error')?.({ error: new Error('tile 404') });
      });

      expect(queryByText('Ver rota no Google Maps')).toBeNull();
      expect(getByTestId('mini')).toBeTruthy();
      expect(mapa().remove).not.toHaveBeenCalled();
      expect(aviso).toHaveBeenCalled();
    });

    it('erro antes do load (estilo, worker) mostra o fallback', async () => {
      const { getByText } = await renderizar();

      act(() => {
        mockMapa.handlers.get('error')?.({ error: new Error('style') });
      });

      expect(getByText('Ver rota no Google Maps')).toBeTruthy();
    });

    it('fallback sem parada pendente não oferece rota, só a mensagem', async () => {
      const todasFeitas = paradas('concluida').map((p) => ({
        ...p,
        status: 'concluida',
      }));
      const { queryByText, getByText } = await renderizar({
        paradas: todasFeitas,
      });

      act(() => {
        mockMapa.handlers.get('error')?.({ error: new Error('style') });
      });

      expect(queryByText('Ver rota no Google Maps')).toBeNull();
      expect(queryByText(/Abrir rota no Google Maps/)).toBeNull();
      expect(getByText('Mapa indisponível')).toBeTruthy();
    });
  });

  describe('marcadores', () => {
    it('nova localização move o marcador do motorista sem refazer os das paradas', async () => {
      const { rerender } = await renderizarCarregado({
        userLocation: { latitude: -23.5, longitude: -46.6 },
      });
      const criados = MockMarker.mock.calls.length;
      const marcadores = [...mockMapa.marcadores];
      expect(criados).toBeGreaterThan(1);

      rerender(
        elemento({ userLocation: { latitude: -23.51, longitude: -46.61 } }),
      );

      expect(MockMarker).toHaveBeenCalledTimes(criados);
      marcadores.forEach((m) => expect(m.remove).not.toHaveBeenCalled());
      const doUsuario = marcadores.find((m) =>
        m.setLngLat.mock.calls.some(
          ([lngLat]) => (lngLat as number[])[1] === -23.51,
        ),
      );
      expect(doUsuario).toBeTruthy();
    });

    it('não põe marcador em coordenada inválida, mas aceita zero', async () => {
      await renderizarCarregado({
        paradas: [
          { ...PARADAS[0], latitude: 0, longitude: 0 },
          { ...PARADAS[1], latitude: NaN },
          PARADAS[2],
        ],
      });

      const posicoes = mockMapa.marcadores.flatMap((m) =>
        m.setLngLat.mock.calls.map(([lngLat]) => lngLat as number[]),
      );
      expect(posicoes).toContainEqual([0, 0]);
      expect(posicoes).toContainEqual([-46.7, -23.6]);
      expect(posicoes.flat().every(Number.isFinite)).toBe(true);
    });

    it('no tema escuro, borda e número dos pinos seguem brancos', async () => {
      const escuro = {
        ...base.theme,
        colors: { ...base.theme.colors, white: '#1a2029', black: '#f9fafb' },
      };
      jest
        .spyOn(estilos, 'useUnistyles')
        .mockImplementation(() => ({ ...base, theme: escuro }) as never);

      await renderizarCarregado();

      const pino = (
        MockMarker.mock.calls.find(
          ([opcoes]) =>
            (opcoes as { element: HTMLElement }).element.textContent === '1',
        )?.[0] as { element: HTMLElement }
      ).element;
      expect(['#ffffff', 'rgb(255, 255, 255)']).toContain(
        pino.style.borderColor,
      );
      expect(['#ffffff', 'rgb(255, 255, 255)']).toContain(pino.style.color);
      // Largura mínima, para caber "10+11"
      expect(pino.style.width).toBe('');
      expect(pino.style.minWidth).not.toBe('');
    });
  });

  describe('chip e acessibilidade', () => {
    it('chip no singular/plural, numa linha e com fonte limitada', async () => {
      const { getByText } = await renderizarCarregado();

      const chip = getByText('2 paradas restantes');
      expect(chip.props.numberOfLines).toBe(1);
      expect(chip.props.maxFontSizeMultiplier).toBe(1.3);
    });

    it('o toque abre o mapa completo, e o rótulo diz isso', async () => {
      const { getByLabelText } = await renderizarCarregado();

      const area = getByLabelText('Abrir mapa completo');
      expect(area.props.accessibilityHint).toMatch(/2 paradas restantes/);
    });

    it('botão de expandir tem 44×44', async () => {
      const { getByLabelText } = await renderizarCarregado({
        onToggleExpand: jest.fn(),
      });

      const estilo = StyleSheet.flatten(
        getByLabelText('Expandir mapa').props.style,
      );
      expect(estilo.width).toBeGreaterThanOrEqual(44);
      expect(estilo.height).toBeGreaterThanOrEqual(44);
    });
  });
});
