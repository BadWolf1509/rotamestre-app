/**
 * Início enquanto a rota carrega ou sem conexão.
 *
 * POR QUE EXISTE. A Início não lia `loading`: com `route=null` e a carga em
 * curso (abertura do app, Activity recriada pelo Android), mostrava "Sem rota"
 * e "Expediente encerrado" a um motorista no meio da rota. E sem conexão a
 * rota era apagada; agora ela fica, com um aviso discreto de quando são os
 * dados.
 */
import { render } from '@testing-library/react-native';
import React from 'react';

import MotoristaInicio from '../inicio';

const PARADA = {
  id: 'parada-1',
  ordem: 1,
  status: 'em_andamento',
  endereco: 'Rua A, 1',
  latitude: -7.1,
  longitude: -34.8,
  is_checkpoint: true,
};
const ROTA = { id: 'rota-1', status: 'em_andamento', unidade_id: 'u-1' };

const mockCtx: {
  route: typeof ROTA | null;
  loading: boolean;
  error: Error | null;
  atualizadoEm: number | null;
} = { route: null, loading: false, error: null, atualizadoEm: null };

const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();
const mockNavegarCom = 'mapa';
const mockAbrirNavegacao = jest.fn();

jest.mock('@/hooks/useAlert', () => ({
  useAlert: () => ({
    showWarning: jest.fn(),
    showSuccess: (...a: unknown[]) => mockShowSuccess(...a),
    showError: (...a: unknown[]) => mockShowError(...a),
    AlertDialog: () => null,
  }),
}));

jest.mock('@/context/RouteStatusContext', () => ({
  useRouteStatus: () => ({
    routeStatus: mockCtx.route ? 'active' : 'no-route',
    route: mockCtx.route,
    paradas: mockCtx.route ? [PARADA] : [],
    currentStop: mockCtx.route ? PARADA : null,
    nextStop: null,
    progress: { completed: 0, total: 1, percentage: 0 },
    pendingRoutesCount: 0,
    loading: mockCtx.loading,
    error: mockCtx.error,
    atualizadoEm: mockCtx.atualizadoEm,
    refreshRoute: jest.fn(),
    startRoute: jest.fn(),
    completeStop: jest.fn(),
    skipStop: jest.fn(),
    completeRoute: jest.fn(),
  }),
}));

jest.mock('@/services/locationTracking', () => ({
  __esModule: true,
  default: {
    getNavigationPreferences: jest.fn(() =>
      Promise.resolve({ navegarCom: mockNavegarCom }),
    ),
  },
}));

jest.mock('@/lib/navigation', () => ({
  abrirNavegacao: (...a: unknown[]) => mockAbrirNavegacao(...a),
}));

jest.mock('@/components/motorista/NavigationMode', () => {
  const { Pressable: P, Text: T } = jest.requireActual('react-native');
  return {
    NavigationMode: (props: {
      onComplete: () => void;
      onSkip: () => void;
      onExit: () => void;
    }) => (
      <>
        <T>modo-navegacao</T>
        <P onPress={props.onComplete}>
          <T>nav-concluir</T>
        </P>
        <P onPress={props.onSkip}>
          <T>nav-pular</T>
        </P>
        <P onPress={props.onExit}>
          <T>nav-sair</T>
        </P>
      </>
    ),
  };
});

jest.mock('@/components/motorista/StopCompletionFlow', () => {
  const { Text: T } = jest.requireActual('react-native');
  return {
    StopCompletionFlow: (props: {
      visible: boolean;
      parada: { id: string } | null;
      contexto?: string | null;
    }) =>
      props.visible && props.parada ? (
        <>
          <T>{`fluxo-conclusao:${props.parada.id}`}</T>
          <T>{`contexto:${props.contexto ?? ''}`}</T>
        </>
      ) : null,
  };
});

jest.mock('@/components/motorista/SkipReasonModal', () => {
  const { Pressable: P, Text: T } = jest.requireActual('react-native');
  return {
    SkipReasonModal: (props: {
      parada: { id: string };
      outrosServicosNoLocal?: Array<{ id: string }>;
      onConfirm: (m: string, o?: string, incluir?: boolean) => void;
    }) => (
      <>
        <T>{`modal-pular:${props.parada.id}`}</T>
        <T>{`outros:${(props.outrosServicosNoLocal ?? []).map((p) => p.id).join(',')}`}</T>
        <P onPress={() => props.onConfirm('cliente_ausente', undefined, true)}>
          <T>confirmar-com-outros</T>
        </P>
        <P onPress={() => props.onConfirm('cliente_ausente', undefined, false)}>
          <T>confirmar-sem-outros</T>
        </P>
      </>
    ),
  };
});

jest.mock('@/components/motorista/home/MainCard', () => {
  const { Pressable: P, Text: T } = jest.requireActual('react-native');
  return {
    MainCard: (props: { onPress: () => void; state: string }) => (
      <P onPress={props.onPress}>
        <T>{`main-card:${props.state}`}</T>
      </P>
    ),
  };
});

// Stubs sem papel no teste.
jest.mock('@/components/motorista/home/MiniMap', () => {
  const { Text: T } = jest.requireActual('react-native');
  return {
    MiniMap: () => <T>mini-mapa</T>,
  };
});
jest.mock('@/components/motorista/home/QuickActions', () => ({
  FloatingActionButton: () => null,
}));
jest.mock('@/components/motorista/home/StartRouteButton', () => ({
  StartRouteButton: () => null,
}));
jest.mock('@/components/motorista/home/StatusSection', () => {
  const { Text: T } = jest.requireActual('react-native');
  return {
    StatusSection: (props: { routeStatus: string; estadoDaCarga?: string }) => (
      <T>{`status:${props.estadoDaCarga ?? props.routeStatus}`}</T>
    ),
  };
});
jest.mock('@/components/motorista/OptimizationAlert', () => ({
  OptimizationAlert: () => null,
}));
jest.mock('@/components/IncidentReportWizard', () => ({
  IncidentReportWizard: () => null,
}));
jest.mock('@/components/SwipeOnboarding', () => ({
  SwipeOnboarding: () => null,
  hasSeenSwipeOnboarding: jest.fn().mockResolvedValue(true),
}));
jest.mock('@/design-system', () => ({
  Dialog: () => null,
  SupportModal: () => null,
}));
jest.mock('@/hooks/useDriverLocationBroadcast', () => ({
  useDriverLocationBroadcast: jest.fn(),
}));
jest.mock('@/hooks/motorista/useRestaurarConclusaoEmVoo', () => ({
  useRestaurarConclusaoEmVoo: jest.fn(),
}));
jest.mock('@/hooks/motorista/useRestaurarRascunhoIncidente', () => ({
  useRestaurarRascunhoIncidente: jest.fn(),
}));
jest.mock('@/hooks/useRevalidarPermissaoDeLocalizacao', () => ({
  useRevalidarPermissaoDeLocalizacao: jest.fn(),
}));
jest.mock('@/hooks/useLocationWatcher', () => ({
  useLocationWatcher: jest.fn(),
}));
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: { id: 'motorista-1', nome: 'Teste' } }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: 'granted', canAskAgain: true }),
  requestForegroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: 'granted', canAskAgain: true }),
  Accuracy: { Balanced: 3, High: 4 },
}));

describe('Início — carga e conexão', () => {
  beforeEach(() => {
    mockCtx.route = null;
    mockCtx.loading = false;
    mockCtx.error = null;
    mockCtx.atualizadoEm = null;
  });

  it('carregando sem rota mostra skeleton e rótulo neutro, nunca "Sem rota"', () => {
    mockCtx.loading = true;
    const { getByTestId, getByText, queryByText } = render(<MotoristaInicio />);

    expect(getByTestId('motorista-inicio-carregando')).toBeTruthy();
    expect(getByText('status:carregando')).toBeTruthy();
    expect(queryByText('main-card:no-route')).toBeNull();
  });

  it('erro com rota preservada: rota na tela e aviso com a hora dos dados', () => {
    mockCtx.route = ROTA;
    mockCtx.error = new Error('Network request failed');
    mockCtx.atualizadoEm = new Date(2026, 9, 22, 14, 5).getTime();
    const { getByText } = render(<MotoristaInicio />);

    expect(getByText('main-card:active')).toBeTruthy();
    expect(getByText(/Sem conexão — dados de 14:05/)).toBeTruthy();
  });

  it('erro sem nunca ter carregado: "Sem conexão", não "Sem rota"', () => {
    mockCtx.error = new Error('Network request failed');
    const { getByText, queryByText } = render(<MotoristaInicio />);

    expect(getByText('status:sem-conexao')).toBeTruthy();
    expect(queryByText('main-card:no-route')).toBeNull();
  });

  it('sem erro e sem carga: o "Sem rota" de sempre', () => {
    const { getByText, queryByTestId } = render(<MotoristaInicio />);
    expect(getByText('main-card:no-route')).toBeTruthy();
    expect(queryByTestId('motorista-inicio-carregando')).toBeNull();
  });
});
