/**
 * Tela de incidentes com período: o seletor aparece, e o aviso dos pendentes
 * de antes do período (singular/plural) some quando não há nenhum (inclusive
 * em "Todo o período", onde o hook devolve 0). O "Ver" chama a ação do hook.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import Incidentes from '../incidentes';

const mockVer = jest.fn();
const mockDefinirPeriodo = jest.fn();
const mockSetFiltroStatus = jest.fn();
let mockEstado: Record<string, unknown> = {};
let mockIsDesktop = false;

jest.mock('@/hooks/useIncidentesGestor', () => {
  const rotulo = { label: 'X', icon: 'alert', color: '#000' };
  const rotulos = new Proxy({}, { get: () => rotulo });
  return {
    useIncidentesGestor: () => ({
      incidentes: [],
      total: 0,
      temMais: false,
      carregandoMais: false,
      carregarMais: jest.fn(),
      loading: false,
      categoriaLabels: rotulos,
      statusLabels: rotulos,
      estatisticasMotorista: [],
      resumoGeral: {
        total: 0,
        abertos: 0,
        emAnalise: 0,
        resolvidos: 0,
        fechados: 0,
        porCategoria: {},
      },
      periodo: { tipo: 'este_mes' },
      definirPeriodo: mockDefinirPeriodo,
      pendentesAntesDoPeriodo: 0,
      verPendentesAnteriores: mockVer,
      filtroStatus: 'todos',
      filtroCategoria: 'todos',
      setFiltroStatus: mockSetFiltroStatus,
      setFiltroCategoria: jest.fn(),
      incidenteSelecionado: null,
      showDetalhesModal: false,
      fotoLoading: false,
      fotoError: false,
      handleVerDetalhes: jest.fn(),
      handleFotoLoad: jest.fn(),
      handleFotoError: jest.fn(),
      handleFotoRetry: jest.fn(),
      setShowDetalhesModal: jest.fn(),
      showAlterarStatusModal: false,
      novoStatus: '',
      observacoes: '',
      atualizando: false,
      handleAlterarStatus: jest.fn(),
      confirmarAlterarStatus: jest.fn(),
      setNovoStatus: jest.fn(),
      setObservacoes: jest.fn(),
      setShowAlterarStatusModal: jest.fn(),
      showHistoricoMotoristaModal: false,
      motoristaSelecionado: null,
      incidentesMotorista: [],
      historicoLoading: false,
      handleVerHistoricoMotorista: jest.fn(),
      setShowHistoricoMotoristaModal: jest.fn(),
      fetchIncidentes: jest.fn(),
      formatDate: (d: string) => d,
      ...mockEstado,
    }),
  };
});
jest.mock('@/components/gestor/incidentes', () => ({
  IncidenteDetalhesModal: () => null,
  AlterarStatusModal: () => null,
  EstatisticaMotoristaCard: () => null,
  HistoricoMotoristaModal: () => null,
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isDesktop: mockIsDesktop,
    isMobile: !mockIsDesktop,
    isTablet: false,
    width: mockIsDesktop ? 1280 : 390,
  }),
}));
jest.mock('@/hooks/useDesktopHeaderMenu', () => ({
  useDesktopHeaderMenu: () => ({
    userMenuTrigger: null,
    userMenuItems: [],
    logoutModal: null,
  }),
}));
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: { id: 'g1', nome: 'Gestor' } }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockEstado = {};
  mockIsDesktop = false;
});

describe.each([
  ['celular', false],
  ['desktop', true],
])(
  'Incidentes (%s): período e aviso dos pendentes anteriores',
  (_n, desktop) => {
    it('mostra o seletor de período', () => {
      mockIsDesktop = desktop;
      render(<Incidentes />);
      expect(screen.getByTestId('incidentes-periodo')).toBeTruthy();
    });

    it('sem pendentes anteriores não há aviso', () => {
      mockIsDesktop = desktop;
      render(<Incidentes />);
      expect(screen.queryByTestId('incidentes-aviso-pendentes')).toBeNull();
    });

    it('no singular quando é 1', () => {
      mockIsDesktop = desktop;
      mockEstado = { pendentesAntesDoPeriodo: 1 };
      render(<Incidentes />);
      expect(
        screen.getByText('1 incidente pendente de antes do período'),
      ).toBeTruthy();
    });

    it('no plural quando há vários', () => {
      mockIsDesktop = desktop;
      mockEstado = { pendentesAntesDoPeriodo: 7 };
      render(<Incidentes />);
      expect(
        screen.getByText('7 incidentes pendentes de antes do período'),
      ).toBeTruthy();
    });

    it('"Ver" chama a ação que abre todo o período com os pendentes', () => {
      mockIsDesktop = desktop;
      mockEstado = { pendentesAntesDoPeriodo: 3 };
      render(<Incidentes />);
      fireEvent.press(screen.getByTestId('incidentes-aviso-pendentes-ver'));
      expect(mockVer).toHaveBeenCalledTimes(1);
    });
  },
);

describe('celular: filtro de status ativo (sem chips)', () => {
  it('com status "pendentes" mostra a indicação e "Limpar" volta a todos', () => {
    mockEstado = { filtroStatus: 'pendentes' };
    render(<Incidentes />);
    expect(screen.getByText('Mostrando: Pendentes')).toBeTruthy();
    fireEvent.press(screen.getByTestId('incidentes-filtro-status-limpar'));
    expect(mockSetFiltroStatus).toHaveBeenCalledWith('todos');
  });

  it('com status "todos" não há indicação', () => {
    render(<Incidentes />);
    expect(screen.queryByTestId('incidentes-filtro-status')).toBeNull();
  });

  it('no desktop os chips já mostram o status: sem a indicação', () => {
    mockIsDesktop = true;
    mockEstado = { filtroStatus: 'pendentes' };
    render(<Incidentes />);
    expect(screen.queryByTestId('incidentes-filtro-status')).toBeNull();
  });
});

it('celular: durante a carga o seletor e o filtro ativo continuam montados', () => {
  mockEstado = { loading: true, filtroStatus: 'pendentes' };
  render(<Incidentes />);
  expect(screen.getByTestId('incidentes-periodo')).toBeTruthy();
  expect(screen.getByText('Mostrando: Pendentes')).toBeTruthy();
});

it('o vazio diz o período, em minúsculas, no meio da frase', () => {
  render(<Incidentes />);
  expect(screen.getByText(/Não há incidentes em este mês \(/)).toBeTruthy();
});
