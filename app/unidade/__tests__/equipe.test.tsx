import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';

import EquipeScreen from '../equipe';

// O gestor está com a loja "loja-ativa" aberta; o `usuarios.unidade_id`
// legado aponta para outra. A Equipe tem de seguir a loja ATIVA, como o
// resto do app (useUnidadeAtiva).
const GESTOR_PRINCIPAL = {
  id: 'gestor-1',
  nome: 'Gestor Principal',
  unidade_id: 'loja-legada',
  is_gestor_principal: true,
  foto_url: null,
};

const MOTORISTAS = [
  {
    id: 'motorista-1',
    nome: 'Motorista Um',
    email: 'motorista.um@exemplo.com',
    ativo: true,
    vinculo_ativo: true,
    created_at: '2026-08-01T00:00:00Z',
    foto_url: null,
  },
];

const GESTORES = [
  {
    usuarios: {
      id: 'gestor-1',
      nome: 'Gestor Principal',
      email: 'principal@exemplo.com',
      papel: 'gestor',
      is_gestor_principal: true,
      ativo: true,
      created_at: '2026-07-01T00:00:00Z',
      foto_url: null,
    },
  },
  {
    usuarios: {
      id: 'gestor-2',
      nome: 'Outra Gestora',
      email: 'outra@exemplo.com',
      papel: 'gestor',
      is_gestor_principal: false,
      ativo: true,
      created_at: '2026-07-02T00:00:00Z',
      foto_url: null,
    },
  },
];

jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: GESTOR_PRINCIPAL, loading: false }),
}));
jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: 'loja-ativa', loading: false }),
}));

// Caminho mobile: é onde o `if (isLoading)` troca a tela inteira pelo
// MobileLoading, então o sintoma fica direto de observar.
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: false, isMobile: true, isTablet: false }),
}));

const mockUpdate = jest.fn().mockResolvedValue({ error: null });
const mockEqGestores = jest.fn();

// A segunda carga de motoristas fica pendurada de propósito. Sem isso ela
// resolveria no mesmo tick e o estado intermediário nunca chegaria a
// renderizar — o teste passaria mesmo com o defeito presente.
let mockResolverSegundaCarga: ((v: unknown) => void) | null = null;
let mockCargas = 0;
const mockRpc = jest.fn((nome: string, _args: unknown) => {
  if (nome === 'listar_motoristas_unidade') {
    mockCargas += 1;
    if (mockCargas === 1) {
      return Promise.resolve({ data: MOTORISTAS, error: null });
    }
    return new Promise((resolve) => {
      mockResolverSegundaCarga = resolve;
    });
  }
  return Promise.resolve({ data: 'pessoa', error: null });
});

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => {
      const consulta = {
        select: () => consulta,
        eq: (col: string, val: unknown) => {
          mockEqGestores(col, val);
          return consulta;
        },
        then: (resolve: (v: unknown) => void) =>
          resolve({ data: GESTORES, error: null }),
        update: (...args: unknown[]) => ({
          eq: () => mockUpdate(...args),
        }),
      };
      return consulta;
    },
    rpc: (nome: string, args: unknown) => mockRpc(nome, args),
  },
}));

describe('EquipeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCargas = 0;
    mockResolverSegundaCarga = null;
    global.mockUseAlert.showConfirm.mockResolvedValue(true);
  });

  it('lista a equipe da loja ATIVA (motoristas pela RPC, gestores pelo vínculo)', async () => {
    render(<EquipeScreen />);

    expect(await screen.findByText('Motorista Um')).toBeTruthy();
    expect(screen.getByText('Outra Gestora')).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledWith('listar_motoristas_unidade', {
      p_unidade_id: 'loja-ativa',
    });
    expect(mockEqGestores).toHaveBeenCalledWith('unidade_id', 'loja-ativa');
    expect(mockEqGestores).not.toHaveBeenCalledWith(
      'unidade_id',
      'loja-legada',
    );
  });

  it('não oferece desativar outro gestor (a RLS recusaria em silêncio)', async () => {
    render(<EquipeScreen />);

    expect(await screen.findByText('Outra Gestora')).toBeTruthy();
    // Só o card do motorista tem a ação.
    expect(screen.getAllByText('Desativar')).toHaveLength(1);
  });

  it('mantém a lista na tela durante a recarga após desativar um membro', async () => {
    render(<EquipeScreen />);

    expect(await screen.findByText('Motorista Um')).toBeTruthy();

    fireEvent.press(screen.getByText('Desativar'));

    // Espera a recarga começar (e ficar pendurada no mock).
    await waitFor(() => expect(mockResolverSegundaCarga).not.toBeNull());

    // Regressão: `loadMembros` religava `loading`, e o `if (isLoading)` devolve
    // só o MobileLoading — a página inteira sumia durante a recarga, logo após
    // uma ação que o gestor acabou de fazer e já confirmada por toast. O mesmo
    // vale no desktop, via `loading` do DesktopPageLayout.
    expect(screen.queryByText('Carregando equipe...')).toBeNull();
    expect(screen.getByText('Motorista Um')).toBeTruthy();

    mockResolverSegundaCarga!({ data: MOTORISTAS, error: null });
    await waitFor(() => expect(screen.getByText('Motorista Um')).toBeTruthy());
  });

  it('desativa motorista pela RPC da loja ativa, não direto em usuarios', async () => {
    render(<EquipeScreen />);

    expect(await screen.findByText('Motorista Um')).toBeTruthy();

    fireEvent.press(screen.getByText('Desativar'));

    // Motorista que atende outra loja sai só desta; quem decide é o banco.
    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith('alternar_motorista_na_unidade', {
        p_motorista_id: 'motorista-1',
        p_unidade_id: 'loja-ativa',
        p_ativo: false,
      }),
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
