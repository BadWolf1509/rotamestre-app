/**
 * Tela da rota do gestor abaixo de 1024 px (celular e tablet): as ações de
 * gestão têm de existir também aqui. Antes o ramo não-desktop só mostrava a
 * rota — sem cancelar, trocar motorista, adicionar/reordenar/editar/remover
 * parada nem linha do tempo, e os modais nem eram montados.
 *
 * O teste usa TABLET (`isDesktop: false, isTablet: true`, 900 px): é a faixa
 * que mais fácil cai no ramo errado, porque não é "mobile" mas também não é
 * desktop.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import MapaRota from '../mapa-rota';

const PARADA_PENDENTE = {
  id: 'p1',
  ordem: 1,
  endereco: 'Rua A, 1',
  tipo: 'entrega' as const,
  status: 'pendente',
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
    isDesktop: false,
    isTablet: true,
    isMobile: false,
    width: 900,
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
jest.mock('@/hooks/storage/useSignedUrl', () => ({
  useSignedUrl: () => ({ url: null, loading: false, error: false }),
}));
jest.mock('@/components/MapaAdapter', () => ({ MapaAdapter: () => null }));
// O barrel do mapa-rota importa a lista arrastável, que puxa o worklets nativo.
jest.mock('react-native-draggable-flatlist', () => ({
  __esModule: true,
  default: () => null,
  ScaleDecorator: ({ children }: { children: React.ReactNode }) => children,
}));

// Só os dados são simulados: handlers, cabeçalho, cards e diálogos são os de
// verdade.
jest.mock('@/components/gestor/mapa-rota/hooks', () => ({
  ...jest.requireActual('@/components/gestor/mapa-rota/hooks'),
  useMapaRotaData: () => ({
    loading: false,
    rota: {
      id: 'rota-1',
      data: '2026-10-24',
      status: 'pendente',
      motorista_id: 'm1',
      unidade_id: 'u1',
      created_at: '2026-10-24T10:00:00Z',
      motorista: { nome: 'Carlos' },
    },
    paradas: [PARADA_PENDENTE],
    paradasReais: [PARADA_PENDENTE],
    pontosBase: [],
    resumoParadas: {
      total: 1,
      concluidas: 0,
      pendentes: 1,
      emAndamento: 0,
    },
    enderecoUnidade: { latitude: -7, longitude: -34 },
    recarregarSilencioso: mockRecarregar,
  }),
}));

jest.mock('@/components/gestor/mapa-rota', () => {
  const actual = jest.requireActual('@/components/gestor/mapa-rota');
  const { Text } = require('react-native');
  const nulo = () => null;
  return {
    ...actual,
    ChangeDriverModal: nulo,
    EditStopModal: nulo,
    AddStopModal: nulo,
    DraggableStopList: nulo,
    PhotoModal: nulo,
    TimelineCollapsible: ({ rotaId }: { rotaId: string }) => (
      <Text testID="linha-do-tempo">{rotaId}</Text>
    ),
  };
});

describe('MapaRota (tablet, < 1024 px): ações de gestão', () => {
  beforeEach(() => jest.clearAllMocks());

  it('"Cancelar rota" abre o diálogo de cancelar', async () => {
    render(<MapaRota />);

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Cancelar rota' }));
    });

    expect(
      screen.getByText(
        'Tem certeza que deseja cancelar esta rota? Esta ação não pode ser desfeita.',
      ),
    ).toBeTruthy();
  });

  it('o card da parada pendente tem editar e remover', () => {
    render(<MapaRota />);

    expect(screen.getByLabelText('Editar parada')).toBeTruthy();
    expect(screen.getByLabelText('Remover parada')).toBeTruthy();
  });

  it('remover parada abre o diálogo de remover', async () => {
    render(<MapaRota />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Remover parada'));
    });

    expect(screen.getByText('Sim, remover')).toBeTruthy();
  });

  it('monta a linha do tempo', () => {
    render(<MapaRota />);

    expect(screen.getByTestId('linha-do-tempo')).toBeTruthy();
  });
});
