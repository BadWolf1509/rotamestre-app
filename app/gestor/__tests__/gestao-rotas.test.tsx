/**
 * Tela Gestão de Rotas (layout abaixo de 1024px).
 *
 * - Exportar usava `Alert.alert` com botões, que é no-op no
 *   react-native-web: o botão não fazia nada no navegador do celular/tablet.
 *   Agora abre um Modal do design system com as opções.
 * - Erro de carga aparece na tela, com "Tentar novamente".
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import GestaoRotas from '../gestao-rotas';

const mockExportarCSV = jest.fn();
const mockExportarXLSX = jest.fn();
const mockLoadRotas = jest.fn();
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
    getStatusLabel: (s: string) => s,
    getStatusColor: () => 'x',
    toastState: { visible: false, message: '', type: 'info' },
    hideToast: jest.fn(),
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
});
