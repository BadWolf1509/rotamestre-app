/**
 * MapaWebMapLibre – erro do mapa (U-1)
 *
 * Um tile, sprite ou glifo que falha não pode trocar o mapa inteiro pela
 * mensagem de erro (e sem volta): só erro de estilo/worker ANTES do `load`
 * derruba. E trocar o `onMapPress` não pode recriar o mapa.
 */

import { act, render } from '@testing-library/react-native';
import React from 'react';

import { logger } from '@/lib/logger';

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
  remove: jest.fn(),
};
const mockCriarMapa = jest.fn();

jest.mock('maplibre-gl', () => {
  const MockMap = jest.fn().mockImplementation(() => {
    mockCriarMapa();
    return {
      on: jest.fn((evento: string, ...resto: unknown[]) => {
        if (resto.length === 1)
          mockMapa.handlers.set(evento, resto[0] as Handler);
      }),
      off: jest.fn(),
      addControl: jest.fn(),
      remove: mockMapa.remove,
      getLayer: jest.fn(() => undefined),
      getSource: jest.fn(() => undefined),
      addSource: jest.fn(),
      addLayer: jest.fn(),
      removeLayer: jest.fn(),
      removeSource: jest.fn(),
      setPaintProperty: jest.fn(),
      getCanvas: jest.fn(() => ({ style: {} })),
      fitBounds: jest.fn(),
      flyTo: jest.fn(),
      style: {},
    };
  });
  const lib = {
    Map: MockMap,
    Marker: jest.fn(),
    NavigationControl: jest.fn(),
    LngLatBounds: jest.fn((sw: unknown, ne: unknown) => ({ sw, ne })),
    Popup: jest.fn(),
  };
  return { __esModule: true, default: lib, ...lib };
});

import MapaWebMapLibre from '../MapaWebMapLibre';

const PARADAS = [
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
];

type Props = Partial<React.ComponentProps<typeof MapaWebMapLibre>>;

function elemento(props: Props = {}) {
  return (
    <MapaWebMapLibre
      paradas={PARADAS}
      onMapPress={jest.fn()}
      onMarkerPress={jest.fn()}
      unidadeNome="Unidade"
      {...props}
    />
  );
}

async function renderizar(props: Props = {}) {
  const tela = render(elemento(props), { createNodeMock: () => ({}) });
  await act(async () => {});
  return tela;
}

const disparar = (evento: string, ...args: unknown[]) =>
  act(() => {
    mockMapa.handlers.get(evento)?.(...args);
  });

const MENSAGEM = 'Erro ao carregar o mapa';

describe('MapaWebMapLibre – erro do mapa', () => {
  beforeEach(() => {
    mockMapa.handlers.clear();
    mockMapa.remove.mockClear();
    mockCriarMapa.mockClear();
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('erro de tile depois do load mantém o mapa', async () => {
    const { queryByText } = await renderizar();
    disparar('load');

    disparar('error', {
      sourceId: 'openmaptiles',
      tile: {},
      error: new Error('404'),
    });

    expect(queryByText(MENSAGEM)).toBeNull();
    expect(mockMapa.remove).not.toHaveBeenCalled();
  });

  it('erro qualquer depois do load não derruba o mapa', async () => {
    const { queryByText } = await renderizar();
    disparar('load');

    disparar('error', { error: new Error('qualquer coisa') });

    expect(queryByText(MENSAGEM)).toBeNull();
  });

  it.each([
    ['tile', { sourceId: 'openmaptiles', tile: {}, error: new Error('404') }],
    ['sprite', { error: new Error('Could not load sprite.json') }],
    ['glifo', { error: new Error('glyphs 0-255.pbf failed') }],
  ])('erro de %s antes do load não mostra a mensagem', async (_t, evento) => {
    const { queryByText } = await renderizar();

    disparar('error', evento);

    expect(queryByText(MENSAGEM)).toBeNull();
  });

  it('erro de estilo antes do load mostra a mensagem', async () => {
    const { getByText } = await renderizar();

    disparar('error', { error: new Error('style') });

    expect(getByText(MENSAGEM)).toBeTruthy();
  });

  it('trocar o onMapPress não recria o mapa e o clique usa o mais novo', async () => {
    const primeiro = jest.fn();
    const segundo = jest.fn();
    const { rerender } = await renderizar({ onMapPress: primeiro });

    rerender(elemento({ onMapPress: segundo }));
    await act(async () => {});

    expect(mockCriarMapa).toHaveBeenCalledTimes(1);
    expect(mockMapa.remove).not.toHaveBeenCalled();

    disparar('click');
    expect(primeiro).not.toHaveBeenCalled();
    expect(segundo).toHaveBeenCalledTimes(1);
  });
});
