/**
 * @jest-environment ./jest.ambiente-jsdom.js
 */

/**
 * Mapa web (gestor e aba Mapa): partida e chegada viram o pino da sede.
 *
 * Em produção (08/11/2026) o "F" vermelho da chegada cobria o "I" verde da
 * partida — os dois saem do mesmo endereço da sede em 100% das rotas — e o
 * vermelho é a cor de "não executada".
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

const mockMapa = { handlers: new Map<string, Handler>() };
const mockHtmlDoPopup = jest.fn<void, [string]>();
const mockElementosDosMarcadores: HTMLElement[] = [];
const mockMarcadoresRemovidos = jest.fn();

jest.mock('maplibre-gl', () => {
  const MockMap = jest.fn().mockImplementation(() => ({
    on: jest.fn((evento: string, ...resto: unknown[]) => {
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
    fitBounds: jest.fn(),
    flyTo: jest.fn(),
    style: {},
  }));
  const Marker = jest
    .fn()
    .mockImplementation((opts?: { element?: HTMLElement }) => {
      if (opts?.element) mockElementosDosMarcadores.push(opts.element);
      const marcador = {
        setLngLat: jest.fn(() => marcador),
        addTo: jest.fn(() => marcador),
        remove: jest.fn(() => mockMarcadoresRemovidos(opts?.element)),
        getElement: jest.fn(() => opts?.element),
      };
      return marcador;
    });
  const Popup = jest.fn().mockImplementation(() => {
    const popup = {
      setLngLat: jest.fn(() => popup),
      setHTML: jest.fn((html: string) => {
        mockHtmlDoPopup(html);
        return popup;
      }),
      addTo: jest.fn(() => popup),
      remove: jest.fn(),
      getElement: jest.fn(() => null),
    };
    return popup;
  });
  const lib = {
    Map: MockMap,
    Marker,
    NavigationControl: jest.fn(),
    LngLatBounds: jest.fn((sw: unknown, ne: unknown) => ({ sw, ne })),
    Popup,
  };
  return { __esModule: true, default: lib, ...lib };
});

import MapaWebMapLibre from '../MapaWebMapLibre';

// Neste componente `is_checkpoint: false` marca partida/chegada.
function parada(
  id: string,
  ordem: number,
  extra: Partial<{ latitude: number; is_checkpoint: boolean }> = {},
) {
  return {
    id,
    ordem,
    endereco: id === 'p1' ? 'Rua A, 1' : 'Av. Epitácio Pessoa, 1000',
    latitude: -7.1153,
    longitude: -34.8641,
    status: 'pendente' as const,
    tipo: 'entrega' as const,
    is_checkpoint: false,
    ...extra,
  };
}

const PARTIDA = parada('partida', 0);
const P1 = parada('p1', 1, { latitude: -7.13, is_checkpoint: true });
const CHEGADA = parada('chegada', 2);

type Props = Partial<React.ComponentProps<typeof MapaWebMapLibre>>;

async function renderizarCarregado(props: Props = {}) {
  const tela = render(
    <MapaWebMapLibre
      paradas={[PARTIDA, P1, CHEGADA]}
      unidadeNome="Loja Centro"
      {...props}
    />,
    { createNodeMock: () => ({}) },
  );
  await act(async () => {});
  act(() => {
    mockMapa.handlers.get('load')?.();
  });
  return tela;
}

function pinosDaUnidade() {
  return mockElementosDosMarcadores.filter((el) => el.dataset.tipo);
}

function ultimoHtmlDoPopup(): string {
  const chamadas = mockHtmlDoPopup.mock.calls;
  if (chamadas.length === 0) throw new Error('nenhum popup aberto');
  return chamadas[chamadas.length - 1][0];
}

beforeEach(() => {
  mockMapa.handlers.clear();
  mockHtmlDoPopup.mockClear();
  mockMarcadoresRemovidos.mockClear();
  mockElementosDosMarcadores.length = 0;
});

describe('MapaWebMapLibre — pino da sede', () => {
  it('partida e chegada no mesmo lugar: UM pino de sede', async () => {
    await renderizarCarregado();

    const pinos = pinosDaUnidade();
    expect(pinos.map((el) => el.dataset.tipo)).toEqual(['sede']);
    expect(pinos[0].getAttribute('aria-label')).toBe(
      'Sede da unidade, Av. Epitácio Pessoa, 1000',
    );
  });

  it('clicar no pino abre o popup da sede, sem emoji nem I/F', async () => {
    await renderizarCarregado();

    act(() => {
      pinosDaUnidade()[0].click();
    });

    const html = ultimoHtmlDoPopup();
    expect(html).toContain('Sede da unidade');
    expect(html).toContain('Partida e chegada da rota');
    expect(html).toContain('Loja Centro');
    expect(html).not.toContain('🚀');
    expect(html).not.toContain('🏁');
  });

  it('selecionar pelo id da chegada abre o popup da sede', async () => {
    await renderizarCarregado({ selectedParadaId: 'chegada' });

    expect(ultimoHtmlDoPopup()).toContain('Sede da unidade');
  });

  it('partida e chegada distantes: um pino de cada', async () => {
    await renderizarCarregado({
      paradas: [PARTIDA, P1, parada('chegada', 2, { latitude: -7.2 })],
    });

    expect(pinosDaUnidade().map((el) => el.dataset.tipo)).toEqual([
      'partida',
      'chegada',
    ]);
  });

  it('desmontar remove os pinos da unidade', async () => {
    const tela = await renderizarCarregado();
    const [pino] = pinosDaUnidade();

    tela.unmount();

    expect(mockMarcadoresRemovidos).toHaveBeenCalledWith(pino);
  });
});
