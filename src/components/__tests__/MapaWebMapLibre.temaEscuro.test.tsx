/**
 * MapaWebMapLibre (mapa web do gestor) no tema escuro.
 *
 * O estilo do mapa é sempre claro e o popup do MapLibre tem fundo sempre
 * branco, mas `colors.white`/`colors.black` se INVERTEM no tema escuro: a
 * borda e o número dos pinos saíam escuros, e o texto secundário do popup
 * (`#d1d5db` no escuro) ficava ilegível no branco. Tudo o que é desenhado
 * SOBRE o mapa usa a paleta clara fixa `CORES_SOBRE_O_MAPA`.
 *
 * Arquivo à parte porque o `StyleSheet.create` do componente é avaliado na
 * importação, com o tema do mock (modelo: NavigationMode.temaEscuro.test.tsx).
 * Mocks do maplibre copiados de MapaWebMapLibre.camera.test.tsx.
 */

import { act, render } from '@testing-library/react-native';
import React from 'react';

import { CORES_SOBRE_O_MAPA } from '@/components/map/coresSobreOMapa';
import { withOpacity } from '@/utils/color';
import { darkTheme } from '@/utils/styles.base';

jest.mock('@/utils/styles', () => {
  const { darkTheme: escuro } = jest.requireActual('@/utils/styles.base');
  return {
    useUnistyles: () => ({ theme: escuro }),
    StyleSheet: {
      create: (fn: unknown) => (typeof fn === 'function' ? fn(escuro) : fn),
    },
  };
});

jest.mock('@/components/map/hooks/useMotoristaLocationMapLibre', () => ({
  useMotoristaLocationMapLibre: () => ({ location: null }),
}));

// Coordenadas da rota: vazias por padrão; o teste da linha preenche.
const mockRota: { coordenadas: { latitude: number; longitude: number }[] } = {
  coordenadas: [],
};
jest.mock('@/hooks/useRouteDirections', () => ({
  useRouteDirections: () => ({ routeCoordinates: mockRota.coordenadas }),
}));

jest.mock('@/lib/openFreeMapStyle', () => ({
  getOpenFreeMapStyle: jest.fn().mockResolvedValue('mock-style-url'),
  installOpenFreeMapMissingImageHandler: jest.fn(() => jest.fn()),
}));

type Handler = (...args: unknown[]) => void;
type Camada = { id: string; paint?: Record<string, unknown> };

const mockMapa = {
  handlers: new Map<string, Handler>(),
  addLayer: jest.fn<void, [Camada]>(),
};
const mockHtmlDoPopup = jest.fn<void, [string]>();

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
    addLayer: mockMapa.addLayer,
    removeLayer: jest.fn(),
    removeSource: jest.fn(),
    setPaintProperty: jest.fn(),
    getCanvas: jest.fn(() => ({ style: {} })),
    fitBounds: jest.fn(),
    flyTo: jest.fn(),
    style: {},
  }));
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

// Partida (a primeira), duas paradas e a chegada. Neste componente a semântica
// de `is_checkpoint` é invertida: `false` marca partida/chegada e `true` marca
// parada comum.
const PARADAS = [
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
    status: 'concluida' as const,
    tipo: 'entrega' as const,
    is_checkpoint: true,
  },
  {
    id: 'chegada',
    ordem: 3,
    endereco: 'Base',
    latitude: -23.51,
    longitude: -46.61,
    status: 'pendente' as const,
    tipo: 'entrega' as const,
    is_checkpoint: false,
  },
];

const onSelectedMarkerPress = jest.fn();

type Props = Partial<React.ComponentProps<typeof MapaWebMapLibre>>;

async function renderizarCarregado(props: Props = {}) {
  const tela = render(
    <MapaWebMapLibre paradas={PARADAS} unidadeNome="Unidade" {...props} />,
    { createNodeMock: () => ({}) },
  );
  await act(async () => {});
  act(() => {
    mockMapa.handlers.get('load')?.();
  });
  return tela;
}

function pinturaDa(id: string): Record<string, unknown> {
  const chamada = mockMapa.addLayer.mock.calls.find(([c]) => c.id === id);
  if (!chamada) throw new Error(`camada ${id} não foi criada`);
  return chamada[0].paint ?? {};
}

function ultimoHtmlDoPopup(): string {
  const chamadas = mockHtmlDoPopup.mock.calls;
  if (chamadas.length === 0) throw new Error('nenhum popup aberto');
  return chamadas[chamadas.length - 1][0];
}

describe('MapaWebMapLibre no tema escuro', () => {
  beforeEach(() => {
    mockMapa.handlers.clear();
    mockMapa.addLayer.mockClear();
    mockHtmlDoPopup.mockClear();
    mockRota.coordenadas = [];
  });

  it('pino mantém borda e número brancos de verdade', async () => {
    await renderizarCarregado();

    expect(pinturaDa('paradas-circle')['circle-stroke-color']).toBe(
      CORES_SOBRE_O_MAPA.branco,
    );
    const rotulo = pinturaDa('paradas-label');
    expect(rotulo['text-color']).toBe(CORES_SOBRE_O_MAPA.branco);
    expect(rotulo['text-halo-color']).toBe(
      withOpacity(CORES_SOBRE_O_MAPA.sombra, 0.3),
    );
  });

  it('preenchimento dos pinos vem da paleta clara', async () => {
    await renderizarCarregado();

    const preenchimento = JSON.stringify(
      pinturaDa('paradas-circle')['circle-color'],
    );
    expect(preenchimento).toContain('#047857');
    expect(preenchimento).not.toContain(darkTheme.colors.primary);
    expect(preenchimento).not.toContain(darkTheme.colors.warningDark);
  });

  it('linha da rota usa a cor da marca da paleta clara', async () => {
    mockRota.coordenadas = [
      { latitude: -23.5, longitude: -46.6 },
      { latitude: -23.55, longitude: -46.63 },
    ];
    await renderizarCarregado();

    expect(pinturaDa('route-layer')['line-color']).toBe(
      CORES_SOBRE_O_MAPA.marca,
    );
  });

  it('popup da parada é legível no fundo branco do MapLibre', async () => {
    await renderizarCarregado({
      selectedParadaId: 'p1',
      onSelectedMarkerPress,
    });

    const html = ultimoHtmlDoPopup();
    expect(html).toContain(CORES_SOBRE_O_MAPA.textoSecundario);
    expect(html).toContain(`color: ${CORES_SOBRE_O_MAPA.marca};">Ver ações`);
    expect(html).not.toContain(darkTheme.colors.textSecondary);
    expect(html).not.toContain(darkTheme.colors.primary);
  });

  it('popup do pino com vários serviços no mesmo local idem', async () => {
    // Retirada no mesmo ponto da p1: o pino agrupa as duas.
    const retirada = {
      ...PARADAS[1],
      id: 'p1b',
      ordem: 2,
      tipo: 'retirada' as const,
    };
    await renderizarCarregado({
      paradas: [PARADAS[0], PARADAS[1], retirada, PARADAS[3]],
      selectedParadaId: 'p1',
      onSelectedMarkerPress,
    });

    const html = ultimoHtmlDoPopup();
    expect(html).toContain('Paradas 1 e 2');
    expect(html).toContain(CORES_SOBRE_O_MAPA.textoSecundario);
    expect(html).toContain(`color: ${CORES_SOBRE_O_MAPA.marca};">Ver ações`);
    expect(html).not.toContain(darkTheme.colors.textSecondary);
    expect(html).not.toContain(darkTheme.colors.primary);
  });

  it('popup do checkpoint idem', async () => {
    await renderizarCarregado({ selectedParadaId: 'partida' });

    const html = ultimoHtmlDoPopup();
    expect(html).toContain('Ponto de Partida');
    expect(html).toContain(CORES_SOBRE_O_MAPA.textoSecundario);
    expect(html).not.toContain(darkTheme.colors.textSecondary);
  });
});
