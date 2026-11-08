/**
 * NavigationMode (nativo) no tema escuro.
 *
 * O estilo do mapa é sempre claro, mas `colors.white`/`colors.black` se
 * INVERTEM no tema escuro. Tudo o que é desenhado SOBRE o mapa (pinos,
 * ícones dentro do Marker, linha da rota) usa a paleta clara fixa
 * `CORES_SOBRE_O_MAPA`; o painel de baixo é UI sobre a tela e segue o tema.
 *
 * Arquivo à parte porque o `StyleSheet.create` do componente é avaliado na
 * importação, com o tema do mock (modelo: MiniMap.temaEscuro.test.tsx).
 */

import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { CORES_SOBRE_O_MAPA } from '@/components/map/coresSobreOMapa';
import { withOpacity } from '@/utils/color';
import { darkTheme } from '@/utils/styles.base';

import { NavigationMode } from '../NavigationMode';

jest.mock('@/utils/styles', () => {
  const { darkTheme: escuro } = jest.requireActual('@/utils/styles.base');
  return {
    useUnistyles: () => ({ theme: escuro }),
    StyleSheet: {
      create: (fn: unknown) => (typeof fn === 'function' ? fn(escuro) : fn),
    },
  };
});

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6 },
}));

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn().mockResolvedValue(undefined),
  deactivateKeepAwake: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/permissoes', () => ({
  pedirPermissao: jest.fn(() => new Promise(() => {})),
  oferecerSaidaParaConfiguracoes: jest.fn(),
}));

jest.mock('@/hooks/useLocationWatcher', () => ({
  useLocationWatcher: jest.fn(),
}));

jest.mock('@/hooks/useRevalidarPermissaoDeLocalizacao', () => ({
  useRevalidarPermissaoDeLocalizacao: jest.fn(),
}));

jest.mock('@/hooks/useAlert', () => ({
  useAlert: () => ({ showConfirm: jest.fn(), AlertDialog: () => null }),
}));

jest.mock('../NavigationSettings', () => ({
  NavigationSettings: () => null,
}));

jest.mock('../NavigationInfoPanel', () => ({
  NavigationInfoPanel: () => null,
}));

const parada = (
  id: string,
  ordem: number,
  extra: Record<string, unknown> = {},
) => ({
  id,
  ordem,
  endereco: `Rua ${id}`,
  latitude: -23.5 - ordem / 100,
  longitude: -46.6 - ordem / 100,
  status: 'pendente' as const,
  tipo: 'entrega' as const,
  ...extra,
});

const ATUAL = parada('p1', 1);
const PROXIMA = parada('p2', 2);
const OUTRA = parada('p3', 3);
const PARTIDA = parada('partida', 0, { is_checkpoint: true });
const CHEGADA = parada('chegada', 4, { is_checkpoint: true });

const mockLogica = {
  userLocation: { latitude: -23.5, longitude: -46.6 },
  speed: 0,
  distance: null,
  eta: null,
  isTracking: false,
  setIsTracking: jest.fn(),
  showSettings: false,
  setShowSettings: jest.fn(),
  routePath: [
    { latitude: -23.5, longitude: -46.6 },
    { latitude: -23.51, longitude: -46.61 },
  ],
  preferences: {},
  isInitializing: false,
  setIsInitializing: jest.fn(),
  realParadas: [ATUAL, PROXIMA, OUTRA],
  startCheckpoint: PARTIDA,
  endCheckpoint: CHEGADA,
  currentStopIndex: 0,
  nextStopAfterCurrent: PROXIMA,
  isEntrega: true,
  formatDistance: jest.fn(),
  getSpeedColor: jest.fn(),
  loadPreferences: jest.fn(),
  startNavigation: jest.fn(),
  stopNavigation: jest.fn(),
  updateLocationFromCoords: jest.fn(),
};

jest.mock('@/hooks/navigation', () => ({
  useNavigationModeLogic: () => mockLogica,
  useNavigationFeedback: jest.fn(() => ({
    triggerHaptic: jest.fn(),
  })),
  useNavigationActions: jest.fn(() => ({
    handleCompleteStop: jest.fn(),
    handleSkipStop: jest.fn(),
    handleExitNavigation: jest.fn(),
    handleOpenExternalNavigation: jest.fn(),
    handleRecenter: jest.fn(),
  })),
}));

type Estilo = {
  width?: number;
  borderWidth?: number;
  backgroundColor?: string;
  borderColor?: string;
  color?: string;
  shadowOpacity?: number;
};

// Valores do darkTheme que NÃO coincidem com nenhuma cor da paleta clara.
const PALETA = Object.values(CORES_SOBRE_O_MAPA) as string[];
const c = darkTheme.colors;
const TOKENS_ESCUROS = [
  c.white,
  c.black,
  c.gray200,
  c.gray400,
  c.warning,
  c.error,
  c.info,
  c.success,
  c.primary,
].filter((valor) => !PALETA.includes(valor));

const BRANCO = '#ffffff';

const props = {
  currentStop: ATUAL,
  nextStop: PROXIMA,
  paradas: [ATUAL, PROXIMA, OUTRA],
  rotaId: 'rota-1',
  onComplete: jest.fn(),
  onSkip: jest.fn(),
  onExit: jest.fn(),
};

/** Coleta estilos achatados e `color` de ícones de toda a subárvore. */
function coletar(no: unknown, saida: unknown[] = []): unknown[] {
  const n = no as {
    props?: { style?: unknown; color?: unknown };
    children?: unknown[];
  };
  if (!n || typeof n !== 'object') return saida;
  if (n.props?.style) saida.push(StyleSheet.flatten(n.props.style as never));
  if (n.props?.color) saida.push(n.props.color);
  (n.children ?? []).forEach((filho) => coletar(filho, saida));
  return saida;
}

/** Estilos (objetos) de tudo o que está dentro de algum Marker. */
function estilosDosMarkers(
  getAllByTestId: (id: string) => { children: unknown[] }[],
): Estilo[] {
  return getAllByTestId('marker')
    .flatMap((marcador) => coletar(marcador))
    .filter((e) => typeof e === 'object' && e !== null) as Estilo[];
}

describe('NavigationMode no tema escuro', () => {
  it('os tokens escuros de fato diferem da paleta (a asserção não é vazia)', () => {
    expect(TOKENS_ESCUROS.length).toBeGreaterThan(0);
  });

  it('pino de parada mantém borda e número brancos de verdade', () => {
    const { getAllByTestId, getByText } = render(<NavigationMode {...props} />);
    expect(StyleSheet.flatten(getByText('3').props.style).color).toBe(BRANCO);

    const pino = estilosDosMarkers(getAllByTestId).find(
      (e) => e.width === 24 && e.borderWidth === 2,
    );
    expect(pino?.borderColor).toBe(BRANCO);
  });

  it('nenhum pino nem ícone dentro de Marker usa token do tema escuro', () => {
    const { getAllByTestId } = render(<NavigationMode {...props} />);
    const json = JSON.stringify(
      getAllByTestId('marker').flatMap((marcador) => coletar(marcador)),
    );
    for (const token of TOKENS_ESCUROS) {
      expect(json).not.toContain(token);
    }
  });

  it('posição do motorista usa a cor de usuário da paleta clara', () => {
    const { getAllByTestId } = render(<NavigationMode {...props} />);
    const motorista = estilosDosMarkers(getAllByTestId).find(
      (e) => e.backgroundColor === withOpacity(CORES_SOBRE_O_MAPA.usuario, 0.2),
    );
    expect(motorista).toBeDefined();
    expect(motorista?.borderColor).toBe(CORES_SOBRE_O_MAPA.branco);
  });

  // Aqui partida e chegada ficam a ~600 m: um pino de cada.
  it('pinos da unidade: azul-marinho da paleta clara, borda branca', () => {
    const { getAllByLabelText } = render(<NavigationMode {...props} />);
    const pinos = getAllByLabelText(/^Ponto de (partida|chegada)/);
    expect(pinos).toHaveLength(2);
    pinos.forEach((pino) => {
      const estilo = StyleSheet.flatten(pino.props.style);
      expect(estilo.backgroundColor).toBe(CORES_SOBRE_O_MAPA.sede);
      expect(estilo.borderColor).toBe(BRANCO);
    });
  });

  describe('partida e chegada no mesmo lugar (a sede)', () => {
    const CHEGADA_NA_SEDE = {
      ...CHEGADA,
      latitude: PARTIDA.latitude,
      longitude: PARTIDA.longitude,
    };
    beforeEach(() => {
      mockLogica.endCheckpoint = CHEGADA_NA_SEDE;
    });
    afterEach(() => {
      mockLogica.endCheckpoint = CHEGADA;
    });

    it('um pino de sede', () => {
      const { getAllByLabelText } = render(<NavigationMode {...props} />);
      expect(getAllByLabelText(/^Sede da unidade/)).toHaveLength(1);
    });

    // Voltando à sede, o destino já está desenhado: o pino da sede por cima
    // dele seria um segundo alvo no mesmo ponto.
    it('voltando à sede (parada atual = chegada), nenhum pino da unidade', () => {
      const { queryByLabelText } = render(
        <NavigationMode {...props} currentStop={CHEGADA_NA_SEDE} />,
      );
      // Nem a sede nem um pino de partida que sobrasse no mesmo ponto.
      expect(
        queryByLabelText(
          /^(Sede da unidade|Ponto de partida|Ponto de chegada)/,
        ),
      ).toBeNull();
    });
  });

  it('linha da rota usa a cor da marca da paleta clara', () => {
    const { getByTestId } = render(<NavigationMode {...props} />);
    expect(getByTestId('line-layer').props.paint['line-color']).toBe(
      CORES_SOBRE_O_MAPA.marca,
    );
  });

  it('o painel continua seguindo o tema (UI sobre a tela, não sobre o mapa)', () => {
    const { getByTestId } = render(<NavigationMode {...props} />);
    expect(
      StyleSheet.flatten(getByTestId('nav-painel').props.style).backgroundColor,
    ).toBe(darkTheme.colors.white);
  });
});
