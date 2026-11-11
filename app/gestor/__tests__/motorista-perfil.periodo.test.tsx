/**
 * Perfil do motorista: o período dos indicadores (fim cortado em hoje) e a
 * ordem das rotas recentes (data desc, id desc).
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
// Hoje fixo: 2026-11-10.
jest.mock('@/lib/dateUtils', () => ({
  ...jest.requireActual('@/lib/dateUtils'),
  getTodayISO: () => '2026-11-10',
}));
let mockPeriodo: unknown = { tipo: 'este_mes' };
jest.mock('@/hooks/usePeriodoLembrado', () => ({
  usePeriodoLembrado: () => ({
    periodo: mockPeriodo,
    definirPeriodo: jest.fn(),
    carregado: true,
  }),
}));
jest.mock('@/lib/gestor/performanceMotorista', () => ({
  buscarPerformanceMotorista: jest.fn().mockResolvedValue(null),
}));

const mockOrdens: [string, unknown][] = [];
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => {
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        order: (coluna: string, opcoes: unknown) => {
          mockOrdens.push([coluna, opcoes]);
          return consulta;
        },
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

const buscar = () =>
  jest.requireMock('@/lib/gestor/performanceMotorista')
    .buscarPerformanceMotorista as jest.Mock;

beforeEach(() => {
  buscar().mockClear();
  mockOrdens.length = 0;
  mockPeriodo = { tipo: 'este_mes' };
});

it('Este mês em 10/11 consulta de 01/11 a 10/11 (fim cortado em hoje)', async () => {
  render(<MotoristaPerfil />);
  await screen.findByText('João Silva');

  await waitFor(() =>
    expect(buscar()).toHaveBeenCalledWith(
      'motorista-1',
      'João Silva',
      'loja-ativa',
      { de: '2026-11-01', ate: '2026-11-10' },
    ),
  );
  expect(buscar()).toHaveBeenCalledTimes(1);
  expect(
    await screen.findByText('Performance: Este mês (01/11 a 10/11)'),
  ).toBeTruthy();
});

it('período futuro não consulta e mostra o vazio, sem cartões', async () => {
  mockPeriodo = { tipo: 'personalizado', de: '2026-11-20', ate: '2026-11-25' };
  render(<MotoristaPerfil />);
  await screen.findByText('João Silva');

  expect(await screen.findByText('Nenhuma rota neste período')).toBeTruthy();
  expect(buscar()).not.toHaveBeenCalled();
  expect(screen.queryByText('Total de Rotas')).toBeNull();
});

it('Rotas recentes ordena por data desc e depois id desc', async () => {
  render(<MotoristaPerfil />);
  await screen.findByText('João Silva');

  await waitFor(() =>
    expect(mockOrdens).toEqual([
      ['data', { ascending: false }],
      ['id', { ascending: false }],
    ]),
  );
});
