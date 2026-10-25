/**
 * Tela de incidentes com mais incidentes do que a página carregada: diz
 * quantos mostra de quantos e oferece "Carregar mais" (antes não havia
 * limite, e o corte de 1.000 linhas do Supabase escondia os mais antigos sem
 * aviso). O Top 5 por motorista, calculado sobre os carregados, avisa que é
 * parcial.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import Incidentes from '../incidentes';

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

const mockCarregarMais = jest.fn();
let mockEstado: Record<string, unknown> = {};
let mockIsDesktop = false;

function incidentes(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `inc-${i}`,
    categoria: 'other',
    descricao: 'x',
    endereco: 'Rua A',
    status: 'aberto',
    foto_url: null,
    created_at: '2026-10-24T10:00:00Z',
    motorista_nome: 'João',
    motorista_id: 'm1',
    unidade_nome: 'Loja A',
    rota_id: null,
    rota_data: null,
    parada_endereco: null,
    observacoes_gestao: null,
  }));
}

jest.mock('@/hooks/useIncidentesGestor', () => {
  const rotulo = { label: 'X', icon: 'alert', color: '#000' };
  const rotulos = new Proxy({}, { get: () => rotulo });
  return {
    useIncidentesGestor: () => ({
      incidentes: [],
      total: 0,
      temMais: false,
      carregandoMais: false,
      carregarMais: mockCarregarMais,
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
      filtroStatus: 'todos',
      filtroCategoria: 'todos',
      setFiltroStatus: jest.fn(),
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
])('Incidentes (%s): mais incidentes que a página', (_nome, desktop) => {
  it('diz quantos mostra de quantos e "Carregar mais" pede a próxima página', () => {
    mockIsDesktop = desktop;
    mockEstado = { incidentes: incidentes(50), total: 130, temMais: true };
    render(<Incidentes />);

    expect(screen.getByText(/Mostrando 50 de 130 incidentes/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('incidentes-carregar-mais'));
    expect(mockCarregarMais).toHaveBeenCalledTimes(1);
  });

  it('os números do "Mostrando" saem por formatarDecimal', () => {
    mockIsDesktop = desktop;
    mockEstado = { incidentes: incidentes(50), total: 130, temMais: true };
    comMarcador();
    render(<Incidentes />);

    expect(screen.getByText(/Mostrando #50# de #130# incidentes/)).toBeTruthy();
  });

  it('com todos carregados não há aviso nem botão', () => {
    mockIsDesktop = desktop;
    mockEstado = { incidentes: incidentes(3), total: 3, temMais: false };
    render(<Incidentes />);

    expect(screen.queryByText(/Mostrando/)).toBeNull();
    expect(screen.queryByTestId('incidentes-carregar-mais')).toBeNull();
  });
});

it('Top 5 por motorista avisa que conta só os incidentes carregados', () => {
  mockIsDesktop = true;
  mockEstado = {
    incidentes: incidentes(50),
    total: 130,
    temMais: true,
    estatisticasMotorista: [
      { id: 'm1', nome: 'João', total: 50, abertos: 50, resolvidos: 0 },
    ],
  };
  render(<Incidentes />);

  expect(
    screen.getByText(/Top 5 entre os 50 incidentes carregados/),
  ).toBeTruthy();
});
