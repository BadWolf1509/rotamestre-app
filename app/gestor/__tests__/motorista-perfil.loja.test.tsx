/**
 * Perfil do motorista: as rotas recentes são as da LOJA ABERTA. O motorista
 * que atende duas lojas aparecia com as rotas da outra, e o toque abria uma
 * rota que esta loja não gerencia.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import MotoristaPerfil from '../motorista-perfil';

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

const mockFiltrosRotas: [string, unknown][] = [];
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tabela: string) => {
      const consulta = {
        select: () => consulta,
        eq: (coluna: string, valor: unknown) => {
          if (tabela === 'rotas') mockFiltrosRotas.push([coluna, valor]);
          return consulta;
        },
        order: () => consulta,
        limit: () => Promise.resolve({ data: [], error: null }),
        single: () =>
          Promise.resolve({
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
          }),
      };
      return consulta;
    },
    rpc: jest.fn(),
  },
}));

it('busca as rotas recentes só da loja aberta', async () => {
  render(<MotoristaPerfil />);
  await screen.findByText('João Silva');

  await waitFor(() =>
    expect(mockFiltrosRotas).toEqual(
      expect.arrayContaining([
        ['motorista_id', 'motorista-1'],
        ['unidade_id', 'loja-ativa'],
      ]),
    ),
  );
});
