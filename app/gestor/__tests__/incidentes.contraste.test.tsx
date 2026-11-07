/**
 * Tela de incidentes: os números dos cartões de resumo e o texto do selo de
 * status usam tons de texto (>= 4,5:1), não a cor do status crua.
 */
import { render, renderHook, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { larguraMinimaDaTabela } from '@/components/data-table/larguras';
import type {
  DataTableAction,
  DataTableColumn,
} from '@/components/data-table/types';
import { useUnistyles } from '@/utils/styles';

import Incidentes from '../incidentes';

let mockIsDesktop = true;

// Captura colunas e ações que a tela entrega ao DataTable (render real).
let mockColunas: DataTableColumn<object>[] = [];
let mockAcoes: DataTableAction<object>[] = [];
jest.mock('@/design-system', () => {
  const real = jest.requireActual('@/design-system');
  const ReactLocal = jest.requireActual('react');
  return {
    ...real,
    DataTable: (props: {
      columns: DataTableColumn<object>[];
      actions?: DataTableAction<object>[];
    }) => {
      mockColunas = props.columns;
      mockAcoes = props.actions ?? [];
      return ReactLocal.createElement(real.DataTable, props);
    },
  };
});

jest.mock('@/hooks/useIncidentesGestor', () => {
  const rotulo = { label: 'X', icon: 'alert', color: '#000000' };
  const categorias = new Proxy({}, { get: () => rotulo });
  return {
    useIncidentesGestor: () => ({
      incidentes: [
        {
          id: 'inc-1',
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
        },
      ],
      total: 1,
      temMais: false,
      carregandoMais: false,
      carregarMais: jest.fn(),
      loading: false,
      categoriaLabels: categorias,
      // O mesmo rótulo aparece no chip de filtro; o selo é o de textColor.
      statusLabels: new Proxy(
        {},
        {
          get: (_alvo, chave) => ({
            label: `rotulo-${String(chave)}`,
            color: '#ef4444',
            textColor: '#abcdef',
          }),
        },
      ),
      estatisticasMotorista: [],
      resumoGeral: {
        total: 24,
        abertos: 7,
        emAnalise: 8,
        resolvidos: 9,
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

const corDe = (texto: string) =>
  StyleSheet.flatten(screen.getByText(texto).props.style).color;

it('números do resumo em errorText, warningText e successDark', () => {
  mockIsDesktop = true;
  const { result } = renderHook(() => useUnistyles());
  const { colors } = result.current.theme;
  render(<Incidentes />);

  expect(corDe('7')).toBe(colors.errorText);
  expect(corDe('8')).toBe(colors.warningText);
  expect(corDe('9')).toBe(colors.successDark);
  expect(corDe('24')).toBe(colors.gray600);
});

it.each([
  ['desktop', true],
  ['celular', false],
])('%s: o selo de status escreve no textColor do status', (_n, desktop) => {
  mockIsDesktop = desktop;
  render(<Incidentes />);

  const cores = screen
    .getAllByText('rotulo-aberto')
    .map((el) => StyleSheet.flatten(el.props.style).color);
  expect(cores).toContain('#abcdef');
});

it('a tabela cabe no cartão de 950 px (1280 de janela) sem rolar', () => {
  mockIsDesktop = true;
  render(<Incidentes />);

  expect(larguraMinimaDaTabela(mockColunas, mockAcoes)).toBeLessThanOrEqual(
    950,
  );
});
