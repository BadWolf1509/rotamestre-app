/**
 * @jest-environment jsdom
 */

/**
 * MapaWebMapLibre — o marcador do motorista mostra a idade da posição.
 *
 * O ponto azul não dizia se a posição era de agora ou de meia hora atrás
 * (motorista sem sinal, fila offline). O marcador traz "há N min", que anda
 * com um relógio, sem recriar o marcador.
 *
 * O mapa inicializa como no teste de câmera: `createNodeMock` dá ao `<div>`
 * um nó e o `load` do maplibre é disparado à mão.
 */

import { act, render } from '@testing-library/react-native';
import React from 'react';

let mockLocation: Record<string, unknown> | null = null;
jest.mock('@/components/map/hooks/useMotoristaLocationMapLibre', () => ({
  useMotoristaLocationMapLibre: () => ({ location: mockLocation }),
}));
jest.mock('@/hooks/useRouteDirections', () => ({
  useRouteDirections: () => ({ routeCoordinates: [] }),
}));
jest.mock('@/lib/maplibreWorker', () => ({
  configureMaplibreWorker: jest.fn(),
}));
jest.mock('@/lib/openFreeMapStyle', () => ({
  getOpenFreeMapStyle: jest.fn().mockResolvedValue('mock-style-url'),
  installOpenFreeMapMissingImageHandler: jest.fn(() => jest.fn()),
}));

type Handler = (...args: unknown[]) => void;
const mockHandlers = new Map<string, Handler>();
const mockElementos: HTMLElement[] = [];

jest.mock('maplibre-gl', () => {
  const MockMap = jest.fn().mockImplementation(() => ({
    on: jest.fn((evento: string, ...resto: unknown[]) => {
      if (resto.length === 1) mockHandlers.set(evento, resto[0] as Handler);
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
    fitBounds: jest.fn(),
    flyTo: jest.fn(),
    style: {},
  }));
  const Marker = jest.fn().mockImplementation(
    ({ element }: { element: HTMLElement }) => {
      mockElementos.push(element);
      const marcador = {
        setLngLat: jest.fn(() => marcador),
        addTo: jest.fn(() => marcador),
        remove: jest.fn(),
      };
      return marcador;
    },
  );
  const lib = {
    Map: MockMap,
    Marker,
    NavigationControl: jest.fn(),
    LngLatBounds: jest.fn((sw: unknown, ne: unknown) => ({ sw, ne })),
    Popup: jest.fn(),
  };
  return { __esModule: true, default: lib, ...lib };
});

import MapaWebMapLibre from '../MapaWebMapLibre';

function elemento() {
  return (
    <MapaWebMapLibre
      paradas={[]}
      rotaId="rota-1"
      showMotorista
      motoristaNome="Ana"
    />
  );
}

async function renderizarCarregado() {
  const tela = render(elemento(), { createNodeMock: () => ({}) });
  await act(async () => {});
  act(() => {
    mockHandlers.get('load')?.();
  });
  return tela;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-24T10:30:00Z'));
  mockHandlers.clear();
  mockElementos.length = 0;
  mockLocation = {
    id: 'loc-1',
    rota_id: 'rota-1',
    latitude: -7.1,
    longitude: -34.8,
    timestamp: '2026-10-24T10:18:00Z',
  };
});
// Relógio real de volta DENTRO do teste: o afterEach da RNTL (cleanup
// automático) é registrado no import, antes deste arquivo, e roda primeiro —
// com o relógio falso no jsdom ele espera para sempre.
function relogioReal() {
  jest.useRealTimers();
}

it('o marcador mostra há quanto tempo a posição foi tomada', async () => {
  await renderizarCarregado();

  expect(mockElementos).toHaveLength(1);
  expect(mockElementos[0].textContent).toContain('há 12 min');
  relogioReal();
});

it('a idade anda com o relógio sem recriar o marcador', async () => {
  await renderizarCarregado();

  act(() => {
    jest.advanceTimersByTime(3 * 60_000);
  });

  expect(mockElementos).toHaveLength(1);
  expect(mockElementos[0].textContent).toContain('há 15 min');
  relogioReal();
});
