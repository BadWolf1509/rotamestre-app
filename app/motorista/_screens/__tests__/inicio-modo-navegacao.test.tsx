/**
 * Concluir e pular a partir do MODO NAVEGAÇÃO precisam abrir os modais.
 *
 * POR QUE EXISTE. Com o modo navegação ligado, a Início fazia um `return` só
 * com o `<NavigationMode>` — e o `<StopCompletionFlow>` (foto do comprovante)
 * e o `<SkipReasonModal>` moram no OUTRO ramo. "Concluir" e "Pular" dentro da
 * navegação mudavam o estado para "modal aberto" e nada aparecia: o modal só
 * surgia quando o motorista saía da navegação, fora de contexto, muitas vezes
 * já longe do cliente. O modo ficou alcançável na 1.12.6 (#495), e o efeito
 * em produção foi o de entregas concluídas sem foto.
 *
 * Os componentes visuais viram stubs; o `useInicioModals` é o REAL, porque é
 * o estado dele — aberto, mas sem quem o desenhe — que está em jogo.
 */
import { fireEvent, render, waitFor } from '@testing-library/react-native';
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

jest.mock('@/context/RouteStatusContext', () => ({
  useRouteStatus: () => ({
    routeStatus: 'active',
    route: { id: 'rota-1', status: 'em_andamento', unidade_id: 'u-1' },
    paradas: [PARADA],
    currentStop: PARADA,
    nextStop: null,
    progress: { completed: 0, total: 1 },
    pendingRoutesCount: 0,
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
    getNavigationPreferences: jest
      .fn()
      .mockResolvedValue({ autoAdvance: true }),
  },
}));

jest.mock('@/components/motorista/NavigationMode', () => {
  const { Pressable: P, Text: T } = jest.requireActual('react-native');
  return {
    NavigationMode: (props: { onComplete: () => void; onSkip: () => void }) => (
      <>
        <T>modo-navegacao</T>
        <P onPress={props.onComplete}>
          <T>nav-concluir</T>
        </P>
        <P onPress={props.onSkip}>
          <T>nav-pular</T>
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
    }) =>
      props.visible && props.parada ? (
        <T>{`fluxo-conclusao:${props.parada.id}`}</T>
      ) : null,
  };
});

jest.mock('@/components/motorista/SkipReasonModal', () => {
  const { Text: T } = jest.requireActual('react-native');
  return {
    SkipReasonModal: (props: { parada: { id: string } }) => (
      <T>{`modal-pular:${props.parada.id}`}</T>
    ),
  };
});

jest.mock('@/components/motorista/home/MainCard', () => {
  const { Pressable: P, Text: T } = jest.requireActual('react-native');
  return {
    MainCard: (props: { onPress: () => void }) => (
      <P onPress={props.onPress}>
        <T>navegar</T>
      </P>
    ),
  };
});

// Stubs sem papel no teste.
jest.mock('@/components/motorista/home/MiniMap', () => ({
  MiniMap: () => null,
}));
jest.mock('@/components/motorista/home/QuickActions', () => ({
  FloatingActionButton: () => null,
}));
jest.mock('@/components/motorista/home/StartRouteButton', () => ({
  StartRouteButton: () => null,
}));
jest.mock('@/components/motorista/home/StatusSection', () => ({
  StatusSection: () => null,
}));
jest.mock('@/components/motorista/OptimizationAlert', () => ({
  OptimizationAlert: () => null,
}));
jest.mock('@/components/motorista/PictureInPictureMap', () => ({
  PictureInPictureMap: () => null,
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

async function entrarNoModoNavegacao(
  getByText: (t: string) => unknown,
  findByText: (t: string) => Promise<unknown>,
) {
  fireEvent.press(getByText('navegar') as never);
  await findByText('modo-navegacao');
}

describe('Início do motorista — ações dentro do modo navegação', () => {
  it('"Concluir" abre o fluxo de conclusão com foto', async () => {
    const { getByText, findByText } = render(<MotoristaInicio />);
    await entrarNoModoNavegacao(getByText, findByText);

    fireEvent.press(getByText('nav-concluir'));

    await waitFor(() => {
      expect(getByText('fluxo-conclusao:parada-1')).toBeTruthy();
    });
  });

  it('"Pular" abre o modal de motivo', async () => {
    const { getByText, findByText } = render(<MotoristaInicio />);
    await entrarNoModoNavegacao(getByText, findByText);

    fireEvent.press(getByText('nav-pular'));

    await waitFor(() => {
      expect(getByText('modal-pular:parada-1')).toBeTruthy();
    });
  });
});
