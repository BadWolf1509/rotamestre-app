/**
 * @jest-environment jsdom
 */

/**
 * NavigationMode.web – o mapa inicializa
 *
 * O efeito que cria o maplibre roda uma vez, no mount, e sai cedo sem
 * `mapContainerRef.current`. Se o `<div>` do mapa só renderiza depois de
 * `mapLoaded`, e `mapLoaded` só vira true no `load` do mapa, o mapa nunca é
 * criado e a tela fica em "Carregando mapa..." para sempre.
 *
 * Aqui o mapa inicializa de verdade: o `createNodeMock` dá ao `<div>` um nó,
 * e o evento `load` do maplibre é disparado à mão (o modelo é o
 * MapaWebMapLibre.camera.test.tsx).
 */

import { act, render } from '@testing-library/react-native';
import * as maplibregl from 'maplibre-gl';
import React from 'react';

jest.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6 },
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock('@/lib/permissoes', () => ({
  // Sem permissão: o efeito de localização para cedo e não mexe no estado.
  pedirPermissao: jest.fn(() => new Promise(() => {})),
  oferecerSaidaParaConfiguracoes: jest.fn(),
}));

jest.mock('@/hooks/useLocationWatcher', () => ({
  useLocationWatcher: jest.fn(),
}));

jest.mock('@/hooks/useRevalidarPermissaoDeLocalizacao', () => ({
  useRevalidarPermissaoDeLocalizacao: jest.fn(),
}));

jest.mock('@/lib/navigation', () => ({ abrirNavegacao: jest.fn() }));

jest.mock('@/lib/maplibreWorker', () => ({
  configureMaplibreWorker: jest.fn(),
}));

jest.mock('@/lib/openFreeMapStyle', () => ({
  getOpenFreeMapStyle: jest.fn().mockResolvedValue('mock-style-url'),
  installOpenFreeMapMissingImageHandler: jest.fn(() => jest.fn()),
}));

jest.mock('../NavigationInfoPanelWeb', () => ({
  NavigationInfoPanelWeb: () => null,
}));

jest.mock('../NavigationSettings', () => ({
  NavigationSettings: () => null,
}));

const mockParada = (id: string, ordem: number) => ({
  id,
  ordem,
  endereco: `Rua ${id}`,
  latitude: -23.5 - ordem / 100,
  longitude: -46.6 - ordem / 100,
  status: 'pendente' as const,
  tipo: 'entrega' as const,
  is_checkpoint: true,
});

const PARADA_ATUAL = mockParada('p1', 1);
const PROXIMA = mockParada('p2', 2);
const PARADAS = [PARADA_ATUAL, PROXIMA];

// Retorno estável entre renders: só o theme muda de um render para outro.
const mockLogica = {
  userLocation: null,
  speed: 0,
  distance: null,
  eta: null,
  isTracking: false,
  setIsTracking: jest.fn(),
  showSettings: false,
  setShowSettings: jest.fn(),
  routePath: [],
  preferences: {},
  realParadas: PARADAS,
  startCheckpoint: null,
  endCheckpoint: null,
  currentStopIndex: 0,
  nextStopAfterCurrent: PROXIMA,
  pendingStops: [PROXIMA],
  isEntrega: true,
  isNearDestination: false,
  formatDistance: jest.fn(),
  getSpeedColor: jest.fn(),
  loadPreferences: jest.fn(),
  updateLocationFromCoords: jest.fn(),
};

jest.mock('@/hooks/navigation', () => ({
  useNavigationModeLogic: () => mockLogica,
}));

type Handler = (...args: unknown[]) => void;

const mockMapa = { handlers: new Map<string, Handler>() };

jest.mock('maplibre-gl', () => {
  const MockMap = jest.fn().mockImplementation(() => ({
    on: jest.fn((evento: string, handler: Handler) => {
      mockMapa.handlers.set(evento, handler);
    }),
    remove: jest.fn(),
    setCenter: jest.fn(),
    flyTo: jest.fn(),
    getLayer: jest.fn(() => undefined),
    getSource: jest.fn(() => undefined),
    addSource: jest.fn(),
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    removeSource: jest.fn(),
  }));
  const Marker = jest.fn().mockImplementation(() => {
    const marker = {
      setLngLat: jest.fn(() => marker),
      addTo: jest.fn(() => marker),
      remove: jest.fn(),
    };
    return marker;
  });
  const lib = { Map: MockMap, Marker };
  return { __esModule: true, default: lib, ...lib };
});

import { NavigationMode } from '../NavigationMode.web';

const MockMap = maplibregl.Map as unknown as jest.Mock;
const MockMarker = maplibregl.Marker as unknown as jest.Mock;

const onComplete = jest.fn();
const onSkip = jest.fn();
const onExit = jest.fn();

function elemento() {
  return (
    <NavigationMode
      currentStop={PARADA_ATUAL}
      nextStop={PROXIMA}
      paradas={PARADAS}
      rotaId="rota-1"
      onComplete={onComplete}
      onSkip={onSkip}
      onExit={onExit}
    />
  );
}

async function renderizarCarregado() {
  const tela = render(elemento(), { createNodeMock: () => ({}) });
  // getOpenFreeMapStyle resolve numa microtask; depois o 'load' do maplibre.
  await act(async () => {});
  act(() => {
    mockMapa.handlers.get('load')?.();
  });
  return tela;
}

// O mock global não é __esModule: `import * as` copiaria o objeto, e o spy
// pegaria na cópia. requireMock devolve o objeto que o componente usa.
const estilos = jest.requireMock<{ useUnistyles: () => { theme: object } }>(
  '@/utils/styles',
);

describe('NavigationMode.web – mapa inicializa', () => {
  const base = estilos.useUnistyles();

  beforeEach(() => {
    jest.clearAllMocks();
    mockMapa.handlers.clear();
    // O real devolve um proxy NOVO de theme a cada render, com
    // theme.colors estável (ver PR #596).
    jest
      .spyOn(estilos, 'useUnistyles')
      .mockImplementation(
        () => ({ ...base, theme: { ...base.theme } }) as never,
      );
  });

  it('cria o mapa no container e sai do "Carregando mapa..." no load', async () => {
    const tela = await renderizarCarregado();

    expect(MockMap).toHaveBeenCalledTimes(1);
    expect(MockMap.mock.calls[0][0].container).toBeTruthy();
    expect(tela.queryByText('Carregando mapa...')).toBeNull();
  });

  it('mostra "Carregando mapa..." enquanto o load não chega', async () => {
    const tela = render(elemento(), { createNodeMock: () => ({}) });
    await act(async () => {});

    expect(tela.getByText('Carregando mapa...')).toBeTruthy();
  });

  it('não recria os marcadores das paradas num re-render', async () => {
    const tela = await renderizarCarregado();
    const marcadoresNoLoad = MockMarker.mock.calls.length;
    expect(marcadoresNoLoad).toBeGreaterThan(0);

    tela.rerender(elemento());

    expect(MockMarker.mock.calls.length).toBe(marcadoresNoLoad);
  });
});
