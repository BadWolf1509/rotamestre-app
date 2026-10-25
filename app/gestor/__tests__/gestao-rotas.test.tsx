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
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

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

const mockExportarCSV = jest.fn();
const mockExportarXLSX = jest.fn();
const mockLoadRotas = jest.fn();
const mockCarregarMais = jest.fn();
let mockEstadoHook: Record<string, unknown> = {};

jest.mock('@/hooks/useGestaoRotas', () => ({
  FILTRO_STATUS_OPTIONS: ['todas', 'pendente'],
  useGestaoRotas: () => ({
    rotasFiltradas: [],
    loading: false,
    erroCarga: null,
    dadosDe: null,
    filtroStatus: 'todas',
    searchQuery: '',
    showConfirmModal: false,
    confirmacaoExclusao: { titulo: '', mensagem: '' },
    userData: { id: 'g1' },
    setFiltroStatus: jest.fn(),
    setSearchQuery: jest.fn(),
    verDetalhes: jest.fn(),
    excluirRota: jest.fn(),
    handleConfirmDelete: jest.fn(),
    handleCancelDelete: jest.fn(),
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
  }),
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: false, isMobile: true, isTablet: false }),
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
});

describe('GestaoRotas (mobile/tablet)', () => {
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
    expect(screen.getByText(/437 rota\(s\) encontrada\(s\)/)).toBeTruthy();
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
