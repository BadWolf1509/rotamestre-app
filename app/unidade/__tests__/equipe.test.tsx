import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';

import EquipeScreen from '../equipe';

const GESTOR_PRINCIPAL = {
  id: 'gestor-1',
  nome: 'Gestor Principal',
  unidade_id: 'unidade-1',
  is_gestor_principal: true,
  foto_url: null,
};

const MEMBROS = [
  {
    id: 'motorista-1',
    nome: 'Motorista Um',
    email: 'motorista.um@exemplo.com',
    papel: 'motorista',
    is_gestor_principal: false,
    ativo: true,
    created_at: '2026-08-01T00:00:00Z',
    foto_url: null,
  },
];

jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: GESTOR_PRINCIPAL, loading: false }),
}));

// Caminho mobile: é onde o `if (isLoading)` troca a tela inteira pelo
// MobileLoading, então o sintoma fica direto de observar.
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: false, isMobile: true, isTablet: false }),
}));

const mockUpdate = jest.fn().mockResolvedValue({ error: null });

// A segunda carga fica pendurada de propósito. Sem isso ela resolveria no mesmo
// tick e o estado intermediário nunca chegaria a renderizar — o teste passaria
// mesmo com o defeito presente.
let mockResolverSegundaCarga: ((v: unknown) => void) | null = null;
let mockCargas = 0;

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => {
            mockCargas += 1;
            if (mockCargas === 1) {
              return Promise.resolve({ data: MEMBROS, error: null });
            }
            return new Promise((resolve) => {
              mockResolverSegundaCarga = resolve;
            });
          },
        }),
      }),
      update: (...args: unknown[]) => ({
        eq: () => mockUpdate(...args),
      }),
    }),
  },
}));

describe('EquipeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCargas = 0;
    mockResolverSegundaCarga = null;
    global.mockUseAlert.showConfirm.mockResolvedValue(true);
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

    mockResolverSegundaCarga!({ data: MEMBROS, error: null });
    await waitFor(() => expect(screen.getByText('Motorista Um')).toBeTruthy());
  });
});
