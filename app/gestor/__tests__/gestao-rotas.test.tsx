/**
 * Tela Gestão de Rotas (layout abaixo de 1024px).
 *
 * - Exportar usava `Alert.alert` com botões, que é no-op no
 *   react-native-web: o botão não fazia nada no navegador do celular/tablet.
 *   Agora abre um Modal do design system com as opções.
 * - Erro de carga aparece na tela, com "Tentar novamente".
 * - Loja com mais de 100 rotas: a lista diz quantas mostra de quantas e
 *   oferece "Carregar mais" (antes cortava em 100 sem aviso). A exportação
 *   mostra o progresso da busca de todas as páginas.
 */
import {
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { larguraMinimaDaTabela } from '@/components/data-table/larguras';
import type { DataTableAction } from '@/components/data-table/types';
import { useUnistyles } from '@/utils/styles';

import GestaoRotas from '../gestao-rotas';

// Espião com a implementação real: o teste do formato troca por um marcador
// (para inteiros o real sai igual a `String(n)`, e não provaria nada).
jest.mock('@/lib/formatNumber', () => {
  const real = jest.requireActual('@/lib/formatNumber');
  return { ...real, formatarDecimal: jest.fn(real.formatarDecimal) };
});
const formatarDecimalEspiao = () =>
  jest.requireMock('@/lib/formatNumber').formatarDecimal as jest.Mock;
const comMarcador = () =>
  formatarDecimalEspiao().mockImplementation((v: number) => `#${v}#`);
afterEach(() => {
  formatarDecimalEspiao().mockImplementation(
    jest.requireActual('@/lib/formatNumber').formatarDecimal,
  );
});

// Captura as colunas que a tela entrega ao DataTable (render real preservado).
let mockColunasDaTabela: { key: string; width?: number }[] = [];
let mockAcoesDaTabela: DataTableAction<object>[] = [];
jest.mock('@/design-system', () => {
  const real = jest.requireActual('@/design-system');
  const ReactLocal = jest.requireActual('react');
  return {
    ...real,
    DataTable: (props: {
      columns: { key: string; width?: number }[];
      actions?: DataTableAction<object>[];
    }) => {
      mockColunasDaTabela = props.columns;
      mockAcoesDaTabela = props.actions ?? [];
      return ReactLocal.createElement(real.DataTable, props);
    },
  };
});

const mockExportarCSV = jest.fn();
const mockExportarXLSX = jest.fn();
const mockLoadRotas = jest.fn();
const mockCarregarMais = jest.fn();
let mockEstadoHook: Record<string, unknown> = {};
let mockOpcoesDoHook: { statusColorMap?: Record<string, string> } = {};
const mockVerDetalhes = jest.fn();
const mockExcluirRota = jest.fn();
let mockEhDesktop = false;

jest.mock('@/hooks/useGestaoRotas', () => ({
  FILTRO_STATUS_OPTIONS: ['todas', 'pendente'],
  useGestaoRotas: (opcoes: { statusColorMap?: Record<string, string> }) => {
    mockOpcoesDoHook = opcoes;
    return {
      rotasFiltradas: [],
      loading: false,
      erroCarga: null,
      dadosDe: null,
      filtroStatus: 'todas',
      searchQuery: '',
      userData: { id: 'g1' },
      setFiltroStatus: jest.fn(),
      setSearchQuery: jest.fn(),
      verDetalhes: mockVerDetalhes,
      exportarParaCSV: mockExportarCSV,
      exportarParaXLSX: mockExportarXLSX,
      loadRotas: mockLoadRotas,
      carregarMais: mockCarregarMais,
      total: 0,
      temMais: false,
      carregandoMais: false,
      contagens: null,
      exportacao: null,
      getStatusLabel: (s: string) => s,
      getStatusColor: () => 'x',
      handleSort: jest.fn(),
      ...mockEstadoHook,
    };
  },
}));
// A página é dona do fluxo de exclusão: "Excluir rota" abre o diálogo, como o
// hook de verdade faz (aqui um stub com estado real).
jest.mock('@/hooks/gestao-rotas/useExclusaoDeRota', () => ({
  useExclusaoDeRota: () => {
    const React = jest.requireActual('react');
    const { Text } = jest.requireActual('react-native');
    const [aberto, setAberto] = React.useState(false);
    return {
      pedirExclusao: (rota: unknown) => {
        mockExcluirRota(rota);
        setAberto(true);
      },
      dialogo: aberto ? (
        <>
          <Text>Excluir rota?</Text>
          <Text>A rota de Ana será excluída.</Text>
        </>
      ) : null,
    };
  },
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isDesktop: mockEhDesktop,
    isMobile: !mockEhDesktop,
    isTablet: false,
  }),
}));
jest.mock('@/hooks/useDesktopHeaderMenu', () => ({
  useDesktopHeaderMenu: () => ({
    userMenuTrigger: null,
    userMenuItems: [],
    logoutModal: null,
  }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockEstadoHook = {};
  mockEhDesktop = false;
});

describe('GestaoRotas (mobile/tablet)', () => {
  it('cores de status vêm da fonte única: nao_executada em error, como o desktop', () => {
    const { result } = renderHook(() => useUnistyles());
    const { colors } = result.current.theme;
    render(<GestaoRotas />);

    const cores = mockOpcoesDoHook.statusColorMap;
    expect(cores?.nao_executada).toBe(colors.error);
    expect(cores?.cancelada).toBe(colors.error);
    expect(cores?.pendente).toBe(colors.warning);
    expect(cores?.em_andamento).toBe(colors.info);
    expect(cores?.concluida).toBe(colors.success);
  });

  it('a coluna Status é larga o bastante para "Não executada" sem reticências', () => {
    mockEstadoHook = { rotasFiltradas: rotasFalsas(3), total: 3 };
    render(<GestaoRotas />);

    const status = mockColunasDaTabela.find((c) => c.key === 'status');
    expect(status?.width).toBeGreaterThanOrEqual(150);
  });

  it('Exportar abre as opções na tela (não Alert) e Excel exporta XLSX', () => {
    render(<GestaoRotas />);

    fireEvent.press(screen.getByLabelText('Abrir menu de exportação'));

    expect(global.mockAlert).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('Excel (XLSX)'));
    expect(mockExportarXLSX).toHaveBeenCalledTimes(1);
    expect(mockExportarCSV).not.toHaveBeenCalled();
  });

  it('erro de carga aparece com "Tentar novamente", que recarrega', () => {
    mockEstadoHook = { erroCarga: 'Não foi possível carregar as rotas.' };
    render(<GestaoRotas />);

    expect(screen.getByText(/Não foi possível carregar as rotas/)).toBeTruthy();
    expect(screen.queryByText('Nenhuma rota encontrada')).toBeNull();
    fireEvent.press(screen.getByText('Tentar novamente'));
    expect(mockLoadRotas).toHaveBeenCalledTimes(1);
  });

  it('mais de 100 rotas: diz quantas mostra de quantas e "Carregar mais" pede a próxima página', () => {
    mockEstadoHook = {
      rotasFiltradas: rotasFalsas(100),
      total: 437,
      temMais: true,
    };
    render(<GestaoRotas />);

    expect(screen.getByText(/Mostrando 100 de 437 rotas/)).toBeTruthy();
    expect(screen.getByText(/437 rotas encontradas/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('gestao-rotas-carregar-mais'));
    expect(mockCarregarMais).toHaveBeenCalledTimes(1);
  });

  it('com todas as rotas na lista não há aviso nem "Carregar mais"', () => {
    mockEstadoHook = {
      rotasFiltradas: rotasFalsas(3),
      total: 3,
      temMais: false,
    };
    render(<GestaoRotas />);

    expect(screen.queryByText(/Mostrando/)).toBeNull();
    expect(screen.queryByTestId('gestao-rotas-carregar-mais')).toBeNull();
  });

  it('exportação em andamento mostra o progresso e trava um segundo pedido', () => {
    mockEstadoHook = {
      rotasFiltradas: rotasFalsas(100),
      total: 2345,
      temMais: true,
      exportacao: { formato: 'csv', carregadas: 1000, total: 2345 },
    };
    render(<GestaoRotas />);

    expect(
      screen.getByText(/Preparando a exportação: 1000 de 2345 rotas/),
    ).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Abrir menu de exportação'));
    expect(screen.queryByText('Excel (XLSX)')).toBeNull();
  });
});

describe('GestaoRotas (desktop)', () => {
  beforeEach(() => {
    mockEhDesktop = true;
    mockEstadoHook = { rotasFiltradas: rotasFalsas(2), total: 2 };
  });

  it('tocar na linha abre a rota, a mesma navegação de "Ver detalhes"', () => {
    render(<GestaoRotas />);

    fireEvent.press(screen.getAllByText('Ana')[1]);

    expect(mockVerDetalhes).toHaveBeenCalledTimes(1);
    expect(mockVerDetalhes).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r1' }),
    );
  });

  it('"Ver detalhes" fica na linha e "Excluir rota" só no menu "Mais ações"', () => {
    render(<GestaoRotas />);

    expect(screen.getAllByText('Ver detalhes')).toHaveLength(2);
    expect(screen.queryByText('Excluir rota')).toBeNull();
    expect(screen.getAllByLabelText('Mais ações')).toHaveLength(2);
  });

  it('escolher "Excluir rota" no menu abre o Dialog de confirmação', () => {
    render(<GestaoRotas />);
    expect(screen.queryByText('Excluir rota?')).toBeNull();

    fireEvent.press(screen.getAllByLabelText('Mais ações')[0]);
    fireEvent.press(screen.getByRole('menuitem', { name: 'Excluir rota' }));

    expect(mockExcluirRota).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r0' }),
    );
    expect(mockVerDetalhes).not.toHaveBeenCalled();
    expect(screen.getByText('Excluir rota?')).toBeTruthy();
    expect(screen.getByText('A rota de Ana será excluída.')).toBeTruthy();
  });

  it('o texto do selo de status usa o tom de texto do status, não a cor dele', () => {
    const { result } = renderHook(() => useUnistyles());
    const { colors } = result.current.theme;
    mockEstadoHook = {
      rotasFiltradas: [{ ...rotasFalsas(1)[0], status: 'nao_executada' }],
      total: 1,
    };
    render(<GestaoRotas />);

    const estilo = StyleSheet.flatten(
      screen.getByText('Não executada').props.style,
    );
    expect(estilo.color).toBe(colors.errorText);
  });

  it('o botão do cabeçalho diz "Nova rota"', () => {
    render(<GestaoRotas />);

    expect(screen.getByText('Nova rota')).toBeTruthy();
  });

  it('a tabela cabe no cartão de 950 px (1280 de janela) sem rolar', () => {
    render(<GestaoRotas />);

    expect(
      larguraMinimaDaTabela(mockColunasDaTabela, mockAcoesDaTabela),
    ).toBeLessThanOrEqual(950);
  });

  it('o nome longo do motorista fica numa linha, com o nome inteiro no accessibilityLabel', () => {
    const nome = 'Maximiliano Bartholomeu de Albuquerque Cavalcanti Figueiredo';
    mockEstadoHook = {
      rotasFiltradas: [{ ...rotasFalsas(1)[0], motorista_nome: nome }],
      total: 1,
    };
    render(<GestaoRotas />);

    const texto = screen.getByText(nome);
    expect(texto.props.numberOfLines).toBe(1);
    expect(texto.props.accessibilityLabel).toBe(nome);
  });
});

it('o progresso da exportação sai por formatarDecimal', () => {
  mockEstadoHook = {
    rotasFiltradas: rotasFalsas(100),
    total: 2345,
    temMais: true,
    exportacao: { formato: 'csv', carregadas: 1000, total: 2345 },
  };
  comMarcador();
  render(<GestaoRotas />);

  expect(
    screen.getByText(/Preparando a exportação: #1000# de #2345# rotas/),
  ).toBeTruthy();
});

it('o total de rotas encontradas usa a concordância certa', () => {
  mockEstadoHook = {
    rotasFiltradas: rotasFalsas(100),
    total: 2345,
    temMais: true,
  };
  comMarcador();
  render(<GestaoRotas />);

  expect(screen.getByText('2345 rotas encontradas')).toBeTruthy();
});

it('com uma rota o subtítulo diz "1 rota encontrada"', () => {
  mockEstadoHook = { rotasFiltradas: rotasFalsas(1), total: 1 };
  render(<GestaoRotas />);

  expect(screen.getByText('1 rota encontrada')).toBeTruthy();
});

function rotasFalsas(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    data: '2026-10-01',
    status: 'pendente',
    motorista_nome: 'Ana',
    paradas_count: 1,
    paradas_concluidas: 0,
  }));
}
