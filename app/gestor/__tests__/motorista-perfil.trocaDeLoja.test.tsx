/**
 * Perfil do motorista na troca de loja: a carga depende da loja aberta, então
 * trocar de loja com o perfil aberto dispara uma segunda carga. A resposta
 * lenta da loja anterior não pode sobrescrever a da atual.
 */
import { act, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import MotoristaPerfil from '../motorista-perfil';

let mockUnidadeAtiva: string | null = 'loja-a';
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'motorista-1' }),
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: false, isMobile: true, isTablet: false }),
}));
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: { id: 'g1', nome: 'Gestora' }, loading: false }),
}));
jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: mockUnidadeAtiva }),
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

// Consulta de rotas de cada loja fica pendurada até o teste resolvê-la.
const mockPendentes: Record<string, ((v: unknown) => void)[]> = {};
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tabela: string) => {
      let loja = '';
      const consulta = {
        select: () => consulta,
        eq: (coluna: string, valor: unknown) => {
          if (coluna === 'unidade_id') loja = String(valor);
          return consulta;
        },
        order: () => consulta,
        limit: () =>
          new Promise((resolve) => {
            (mockPendentes[loja] ??= []).push(resolve);
          }),
        single: () =>
          Promise.resolve(
            tabela === 'usuarios'
              ? {
                  data: {
                    id: 'motorista-1',
                    nome: 'João Silva',
                    email: 'joao@exemplo.com',
                    telefone: null,
                    foto_url: null,
                    ativo: true,
                    created_at: '2026-08-01T00:00:00Z',
                  },
                  error: null,
                }
              : { data: null, error: null },
          ),
      };
      return consulta;
    },
    rpc: jest.fn(),
  },
}));

function rota(id: string, data: string) {
  return { id, data, status: 'concluida', distancia_total: 1000 };
}

async function resolver(loja: string, rotas: unknown[]) {
  await waitFor(() => expect(mockPendentes[loja]?.length).toBeGreaterThan(0));
  const resolve = mockPendentes[loja].shift();
  await act(async () => {
    resolve?.({ data: rotas, error: null });
  });
}

beforeEach(() => {
  mockUnidadeAtiva = 'loja-a';
  for (const k of Object.keys(mockPendentes)) delete mockPendentes[k];
});

it('a carga lenta da loja anterior não sobrescreve as rotas da atual', async () => {
  const { rerender } = render(<MotoristaPerfil />);
  await waitFor(() => expect(mockPendentes['loja-a']?.length).toBe(1));

  mockUnidadeAtiva = 'loja-b';
  rerender(<MotoristaPerfil />);

  await resolver('loja-b', [rota('rb', '2026-10-02')]);
  expect(await screen.findByText('02/10/2026')).toBeTruthy();

  await resolver('loja-a', [rota('ra', '2026-10-01')]);
  expect(screen.getByText('02/10/2026')).toBeTruthy();
  expect(screen.queryByText('01/10/2026')).toBeNull();
});
