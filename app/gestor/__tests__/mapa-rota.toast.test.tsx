/**
 * Tela da rota do gestor: o toast que os hooks disparam tem de chegar ao toast
 * que a PÁGINA renderiza.
 *
 * `useToast` é estado local de cada instância, sem provider. Os hooks
 * `useMapaRotaHandlers` e `useMapaRotaData` criavam a instância deles e
 * chamavam `showToast` nela, enquanto a página só renderizava a sua: recusa de
 * editar/remover parada finalizada, falha de remover/reordenar e os toasts de
 * sucesso nunca apareciam. Aqui o handler REAL recusa o clique e a mensagem
 * tem de estar na tela.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { MENSAGEM_PARADA_JA_FINALIZADA } from '@/lib/gestor/paradaEditavel';

import MapaRota from '../mapa-rota';

const PARADA_CONCLUIDA = {
  id: 'p1',
  ordem: 1,
  endereco: 'Rua A, 1',
  tipo: 'entrega' as const,
  status: 'concluida',
  latitude: -7.1,
  longitude: -34.8,
  is_checkpoint: true,
};

const mockRecarregar = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'rota-1' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isDesktop: true,
    isMobile: false,
    isTablet: false,
    width: 1280,
  }),
}));
jest.mock('@/hooks/useDesktopHeaderMenu', () => ({
  useDesktopHeaderMenu: () => ({
    userMenuTrigger: null,
    userMenuItems: [],
    logoutModal: null,
  }),
}));
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: { id: 'g1', nome: 'Gestor' } }),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));
jest.mock('@/components/MapaAdapter', () => ({ MapaAdapter: () => null }));
// O barrel do mapa-rota importa a lista arrastável, que puxa o worklets nativo.
jest.mock('react-native-draggable-flatlist', () => ({
  __esModule: true,
  default: () => null,
  ScaleDecorator: ({ children }: { children: React.ReactNode }) => children,
}));

// Só os dados são simulados: os handlers e os modais são os de verdade.
jest.mock('@/components/gestor/mapa-rota/hooks', () => ({
  ...jest.requireActual('@/components/gestor/mapa-rota/hooks'),
  useMapaRotaData: () => ({
    loading: false,
    rota: {
      id: 'rota-1',
      data: '2026-10-24',
      status: 'em_andamento',
      motorista_id: 'm1',
      unidade_id: 'u1',
    },
    paradas: [PARADA_CONCLUIDA],
    paradasReais: [PARADA_CONCLUIDA],
    pontosBase: [],
    resumoParadas: {
      total: 1,
      concluidas: 1,
      pendentes: 0,
      emAndamento: 0,
    },
    enderecoUnidade: { latitude: -7, longitude: -34 },
    recarregarSilencioso: mockRecarregar,
  }),
}));

// O cartão vira um botão que dispara o onEdit da página, como o clique real.
jest.mock('@/components/gestor/mapa-rota', () => {
  const actual = jest.requireActual('@/components/gestor/mapa-rota');
  const { Pressable, Text } = require('react-native');
  const nulo = () => null;
  return {
    ...actual,
    RouteInfoHeaderCompact: nulo,
    ChangeDriverModal: nulo,
    EditStopModal: nulo,
    AddStopModal: nulo,
    DraggableStopList: nulo,
    PhotoModal: nulo,
    TimelineCollapsible: nulo,
    ParadaCardCompact: ({
      parada,
      onEdit,
    }: {
      parada: unknown;
      onEdit: (p: unknown) => void;
    }) => (
      <Pressable testID="editar-parada" onPress={() => onEdit(parada)}>
        <Text>Editar</Text>
      </Pressable>
    ),
  };
});

describe('MapaRota (desktop): toast dos handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('recusar editar parada finalizada mostra o motivo na tela', async () => {
    render(<MapaRota />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('editar-parada'));
    });

    expect(screen.getByText(MENSAGEM_PARADA_JA_FINALIZADA)).toBeTruthy();
  });
});
