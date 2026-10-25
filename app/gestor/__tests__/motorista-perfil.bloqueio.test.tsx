/**
 * Perfil do motorista: desativar com rota aberta (Migration 54) é recusado
 * pelo banco, e a tela lista as rotas em vez de dizer "desativado".
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';

import MotoristaPerfil from '../motorista-perfil';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'motorista-1' }),
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: false, isMobile: true, isTablet: false }),
}));
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: { id: 'gestor-1', nome: 'Gestor' } }),
}));
jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: 'loja-ativa' }),
}));
jest.mock('@/hooks/useDesktopHeaderMenu', () => ({
  useDesktopHeaderMenu: () => ({
    userMenuTrigger: null,
    userMenuItems: [],
    logoutModal: null,
  }),
}));
jest.mock('@/lib/gestor/performanceMotorista', () => ({
  buscarPerformanceMotorista: jest.fn().mockResolvedValue(null),
}));

const MOTORISTA = {
  id: 'motorista-1',
  nome: 'João Silva',
  email: 'joao@exemplo.com',
  telefone: null,
  foto_url: null,
  ativo: true,
  created_at: '2026-08-01T00:00:00Z',
};

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tabela: string) => {
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        order: () => consulta,
        limit: () => Promise.resolve({ data: [], error: null }),
        single: () =>
          Promise.resolve(
            tabela === 'usuarios'
              ? { data: MOTORISTA, error: null }
              : { data: null, error: null },
          ),
      };
      return consulta;
    },
    rpc: (nome: string, args: unknown) => mockRpc(nome, args),
  },
}));

const ERRO_ROTA_ABERTA = {
  code: 'P0001',
  message:
    'Não dá para desativar: este motorista tem 3 rotas abertas nesta loja. Reatribua a outro motorista ou cancele antes de desativar.',
  details: JSON.stringify([
    { id: 'r-and', data: '2026-10-24', status: 'em_andamento' },
    { id: 'r-p1', data: '2026-10-25', status: 'pendente' },
    { id: 'r-p2', data: '2026-10-26', status: 'pendente' },
  ]),
  hint: 'MOTORISTA_COM_ROTA_ABERTA',
};

async function desativarPelaTela() {
  render(<MotoristaPerfil />);
  fireEvent.press(await screen.findByText('Desativar'));
  // Dialog de confirmação: o botão de confirmar também diz "Desativar"
  const botoes = await screen.findAllByText('Desativar');
  fireEvent.press(botoes[botoes.length - 1]);
}

describe('MotoristaPerfil: desativar com rota aberta', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('recusa e lista as três rotas; o motorista continua ativo', async () => {
    mockRpc.mockResolvedValue({ data: null, error: ERRO_ROTA_ABERTA });

    await desativarPelaTela();

    expect(await screen.findByTestId('rota-aberta-r-and')).toBeTruthy();
    expect(screen.getByTestId('rota-aberta-r-p1')).toBeTruthy();
    expect(screen.getByTestId('rota-aberta-r-p2')).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledWith('alternar_motorista_na_unidade', {
      p_motorista_id: 'motorista-1',
      p_unidade_id: 'loja-ativa',
      p_ativo: false,
    });
    expect(screen.queryByText(/desativado com sucesso/)).toBeNull();
    expect(mockBack).not.toHaveBeenCalled();

    // a rota abre a tela da rota (trocar motorista ou cancelar)
    fireEvent.press(screen.getByTestId('rota-aberta-r-p1'));
    expect(mockPush).toHaveBeenCalledWith('/gestor/mapa-rota?id=r-p1');
  });

  it('sem rota aberta, desativa normalmente', async () => {
    mockRpc.mockResolvedValue({ data: 'pessoa', error: null });

    await desativarPelaTela();

    await waitFor(() =>
      expect(screen.getByText('Motorista desativado com sucesso')).toBeTruthy(),
    );
    expect(screen.queryByTestId(/^rota-aberta-/)).toBeNull();
  });
});
