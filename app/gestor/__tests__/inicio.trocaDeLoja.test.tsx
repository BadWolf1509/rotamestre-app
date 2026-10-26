/**
 * Início do gestor: o filtro de motorista é de uma loja só. Trocar de loja
 * pelo seletor zera `filters.motoristaId` — senão o painel da loja nova
 * consultaria o id de um motorista da anterior e mostraria "nenhuma rota".
 */
import { act, render } from '@testing-library/react-native';

import GestorInicio from '../inicio';

let mockLoja = 'loja-a';
let mockFiltros: {
  motoristaId?: string | null;
  status?: string | null;
} = {};
let mockMudarFiltros: (f: unknown) => void = () => {};
const mockUseDashboardData = jest.fn();

jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: mockLoja }),
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: true }),
}));
jest.mock('@/components/gestor/dashboard/_hooks/useDashboardData', () => ({
  useDashboardData: (...args: unknown[]) => {
    mockUseDashboardData(...args);
    return {};
  },
}));
jest.mock(
  '@/components/gestor/dashboard/_components/desktop/DashboardDesktop',
  () => ({
    DashboardDesktop: (props: {
      filters: typeof mockFiltros;
      onFiltersChange: (f: unknown) => void;
    }) => {
      mockFiltros = props.filters;
      mockMudarFiltros = props.onFiltersChange;
      return null;
    },
  }),
);
jest.mock(
  '@/components/gestor/dashboard/_components/mobile/DashboardMobile',
  () => ({ DashboardMobile: () => null }),
);

beforeEach(() => {
  mockLoja = 'loja-a';
  mockFiltros = {};
  mockUseDashboardData.mockClear();
});

describe('GestorInicio — troca de loja', () => {
  it('zera o filtro de motorista (e só ele) quando a loja muda', () => {
    const { rerender } = render(<GestorInicio />);

    act(() => {
      mockMudarFiltros({
        status: 'pendente',
        dataInicio: null,
        dataFim: null,
        motoristaId: 'ana',
      });
    });
    expect(mockFiltros.motoristaId).toBe('ana');

    mockLoja = 'loja-b';
    rerender(<GestorInicio />);

    expect(mockFiltros.motoristaId).toBeNull();
    expect(mockFiltros.status).toBe('pendente');
  });

  it('a carga da loja nova nunca recebe o motorista da anterior', () => {
    const { rerender } = render(<GestorInicio />);
    act(() => {
      mockMudarFiltros({
        status: null,
        dataInicio: null,
        dataFim: null,
        motoristaId: 'ana',
      });
    });
    mockUseDashboardData.mockClear();

    mockLoja = 'loja-b';
    rerender(<GestorInicio />);

    const chamadas = mockUseDashboardData.mock.calls.map(
      ([opcoes]) => opcoes.filters.motoristaId,
    );
    expect(chamadas).not.toContain('ana');
  });

  it('mantém o filtro quando a loja não muda', () => {
    const { rerender } = render(<GestorInicio />);
    act(() => {
      mockMudarFiltros({
        status: null,
        dataInicio: null,
        dataFim: null,
        motoristaId: 'ana',
      });
    });

    rerender(<GestorInicio />);

    expect(mockFiltros.motoristaId).toBe('ana');
  });
});
