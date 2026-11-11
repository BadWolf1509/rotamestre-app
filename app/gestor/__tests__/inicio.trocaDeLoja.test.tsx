/**
 * Início do gestor: o filtro de motorista é de uma loja só. Trocar de loja
 * pelo seletor zera `filters.motoristaId` — senão o painel da loja nova
 * consultaria o id de um motorista da anterior e mostraria "nenhuma rota".
 */
import { act, render } from '@testing-library/react-native';

import GestorInicio from '../inicio';

let mockLoja = 'loja-a';
let mockNomeLoja = 'Loja A';
let mockSubtitulo: string | null | undefined;
let mockFiltros: {
  motoristaId?: string | null;
  status?: string | null;
} = {};
let mockMudarFiltros: (f: unknown) => void = () => {};
let mockPeriodoDaTela: unknown;
const mockUseDashboardData = jest.fn();
let mockPeriodoLembrado: {
  periodo: { tipo: string; de?: string; ate?: string };
  carregado: boolean;
} = { periodo: { tipo: 'este_mes' }, carregado: true };
const mockDefinirPeriodo = jest.fn();

jest.mock('@/hooks/usePeriodoLembrado', () => ({
  usePeriodoLembrado: (tela: string) => {
    if (tela !== 'inicio_gestor') throw new Error(`tela ${tela}`);
    return { ...mockPeriodoLembrado, definirPeriodo: mockDefinirPeriodo };
  },
}));

jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({
    unidadeAtiva: mockLoja,
    unidadeAtivaData: { id: mockLoja, nome: mockNomeLoja },
  }),
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
      unidadeNome?: string | null;
      periodo: unknown;
    }) => {
      mockSubtitulo = props.unidadeNome;
      mockPeriodoDaTela = props.periodo;
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
  mockNomeLoja = 'Loja A';
  mockSubtitulo = undefined;
  mockFiltros = {};
  mockPeriodoDaTela = undefined;
  mockPeriodoLembrado = {
    periodo: {
      tipo: 'personalizado',
      de: '2026-10-01',
      ate: '2026-10-15',
    },
    carregado: true,
  };
  mockUseDashboardData.mockClear();
});

describe('GestorInicio — período', () => {
  it('passa à carga o intervalo do período lembrado, e à tela o período', () => {
    render(<GestorInicio />);

    const [opcoes] = mockUseDashboardData.mock.calls.at(-1)!;
    expect(opcoes.periodo).toEqual({ de: '2026-10-01', ate: '2026-10-15' });
    expect(mockPeriodoDaTela).toEqual(mockPeriodoLembrado.periodo);
  });

  it('antes de o período lembrado carregar, a carga recebe null (não consulta pelo padrão)', () => {
    mockPeriodoLembrado = { periodo: { tipo: 'este_mes' }, carregado: false };
    render(<GestorInicio />);

    for (const [opcoes] of mockUseDashboardData.mock.calls) {
      expect(opcoes.periodo).toBeNull();
    }
  });

  it('trocar de loja mantém o período', () => {
    const { rerender } = render(<GestorInicio />);
    mockUseDashboardData.mockClear();

    mockLoja = 'loja-b';
    rerender(<GestorInicio />);

    for (const [opcoes] of mockUseDashboardData.mock.calls) {
      expect(opcoes.periodo).toEqual({ de: '2026-10-01', ate: '2026-10-15' });
    }
  });
});

describe('GestorInicio — troca de loja', () => {
  it('B-GES-5: o cabeçalho mostra o nome da loja ATIVA, não o da loja do perfil', () => {
    const { rerender } = render(<GestorInicio />);
    expect(mockSubtitulo).toBe('Loja A');

    mockLoja = 'loja-b';
    mockNomeLoja = 'Loja B';
    rerender(<GestorInicio />);

    expect(mockSubtitulo).toBe('Loja B');
  });

  it('zera o filtro de motorista (e só ele) quando a loja muda', () => {
    const { rerender } = render(<GestorInicio />);

    act(() => {
      mockMudarFiltros({
        status: 'pendente',
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
        motoristaId: 'ana',
      });
    });

    rerender(<GestorInicio />);

    expect(mockFiltros.motoristaId).toBe('ana');
  });
});
