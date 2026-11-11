import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';

import { RouteFilters } from '@/components/RouteFilters';
import type { RouteFiltersState } from '@/components/RouteFilters';
import type { Periodo } from '@/lib/periodo';

const ESTE_MES: Periodo = { tipo: 'este_mes' };

// Contador de montagens da seção de status: o prefixo `mock` é o que permite
// referenciá-lo de dentro da factory do jest.mock. O wrapper é transparente
// (delega para a seção real), então os demais testes não mudam.
const mockMontagensStatusSection = { total: 0 };

jest.mock('@/components/route-filters', () => {
  const actual = jest.requireActual('@/components/route-filters');
  const ReactActual = require('react');
  return {
    ...actual,
    StatusFilterSection: (props: unknown) => {
      ReactActual.useEffect(() => {
        mockMontagensStatusSection.total += 1;
      }, []);
      return ReactActual.createElement(actual.StatusFilterSection, props);
    },
  };
});

/**
 * O desktop começa recolhido (só o botão "Filtros" e o resumo): os testes das
 * seções abrem a barra antes. No mobile não há o botão, e nada muda.
 */
function renderAberto(ui: React.ReactElement) {
  const resultado = render(ui);
  const botao = resultado.queryByTestId('route-filters-toggle');
  if (botao) fireEvent.press(botao);
  return resultado;
}

describe('RouteFilters Component', () => {
  const mockOnFiltersChange = jest.fn();
  const mockOnPeriodoChange = jest.fn();
  const mockMotoristas = [
    { id: 'motorista-1', nome: 'João Silva' },
    { id: 'motorista-2', nome: 'Maria Santos' },
  ];

  const defaultFilters: RouteFiltersState = {
    status: null,
    motoristaId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Set Platform.OS to 'web' for web-specific tests
    (Platform as any).OS = 'web';
  });

  describe('Desktop Variant', () => {
    it('escolher um atalho no seletor de período chama onPeriodoChange (não mexe nos filtros)', () => {
      const { getByTestId } = renderAberto(
        <RouteFilters
          filters={defaultFilters}
          onFiltersChange={mockOnFiltersChange}
          periodo={ESTE_MES}
          onPeriodoChange={mockOnPeriodoChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />,
      );

      fireEvent.press(getByTestId('filtro-periodo'));
      fireEvent.press(getByTestId('filtro-periodo-item-mes_passado'));

      expect(mockOnPeriodoChange).toHaveBeenCalledWith({ tipo: 'mes_passado' });
      expect(mockOnFiltersChange).not.toHaveBeenCalled();
    });

    it('deve renderizar todos os campos de filtro', () => {
      const { getByText } = renderAberto(
        <RouteFilters
          filters={defaultFilters}
          onFiltersChange={mockOnFiltersChange}
          periodo={ESTE_MES}
          onPeriodoChange={mockOnPeriodoChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />,
      );

      expect(getByText('Status')).toBeTruthy();
      expect(getByText('Período')).toBeTruthy();
      expect(getByText('Motorista')).toBeTruthy();
    });

    it('deve aplicar filtro de status quando selecionado', () => {
      const { getByTestId } = renderAberto(
        <RouteFilters
          filters={defaultFilters}
          onFiltersChange={mockOnFiltersChange}
          periodo={ESTE_MES}
          onPeriodoChange={mockOnPeriodoChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />,
      );

      const statusButton = getByTestId('filter-status-em_andamento');
      fireEvent.press(statusButton);

      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        ...defaultFilters,
        status: 'em_andamento',
      });
    });

    it('deve limpar filtro de status ao clicar novamente (toggle)', () => {
      const filtersWithStatus: RouteFiltersState = {
        ...defaultFilters,
        status: 'em_andamento',
      };

      const { getByTestId } = renderAberto(
        <RouteFilters
          filters={filtersWithStatus}
          onFiltersChange={mockOnFiltersChange}
          periodo={ESTE_MES}
          onPeriodoChange={mockOnPeriodoChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />,
      );

      const statusButton = getByTestId('filter-status-em_andamento');
      fireEvent.press(statusButton);

      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        ...filtersWithStatus,
        status: null,
      });
    });

    it('deve aplicar filtro de motorista quando selecionado', () => {
      const { getByTestId } = renderAberto(
        <RouteFilters
          filters={defaultFilters}
          onFiltersChange={mockOnFiltersChange}
          periodo={ESTE_MES}
          onPeriodoChange={mockOnPeriodoChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />,
      );

      const motoristaButton = getByTestId('filter-motorista-motorista-1');
      fireEvent.press(motoristaButton);

      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        ...defaultFilters,
        motoristaId: 'motorista-1',
      });
    });

    it('deve limpar filtro de motorista ao clicar novamente (toggle)', () => {
      const filtersWithMotorista: RouteFiltersState = {
        ...defaultFilters,
        motoristaId: 'motorista-1',
      };

      const { getByTestId } = renderAberto(
        <RouteFilters
          filters={filtersWithMotorista}
          onFiltersChange={mockOnFiltersChange}
          periodo={ESTE_MES}
          onPeriodoChange={mockOnPeriodoChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />,
      );

      const motoristaButton = getByTestId('filter-motorista-motorista-1');
      fireEvent.press(motoristaButton);

      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        ...filtersWithMotorista,
        motoristaId: null,
      });
    });

    it('"Limpar Filtros" limpa status e motorista, e o período fica', () => {
      const filtersWithData: RouteFiltersState = {
        status: 'em_andamento',
        motoristaId: 'motorista-1',
      };

      const { getByText } = renderAberto(
        <RouteFilters
          filters={filtersWithData}
          onFiltersChange={mockOnFiltersChange}
          periodo={ESTE_MES}
          onPeriodoChange={mockOnPeriodoChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />,
      );

      fireEvent.press(getByText('Limpar Filtros (2)'));

      expect(mockOnFiltersChange).toHaveBeenCalledWith(defaultFilters);
      expect(mockOnPeriodoChange).not.toHaveBeenCalled();
    });
  });

  describe('Filter Behavior', () => {
    it('não remonta as seções quando o pai re-renderiza', () => {
      const { rerender } = renderAberto(
        <RouteFilters
          filters={defaultFilters}
          onFiltersChange={mockOnFiltersChange}
          periodo={ESTE_MES}
          onPeriodoChange={mockOnPeriodoChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />,
      );
      const montagensIniciais = mockMontagensStatusSection.total;

      // O dashboard do gestor re-renderiza com dados em tempo real e passa um
      // objeto de filtros novo (mesmo conteúdo) a cada atualização.
      rerender(
        <RouteFilters
          filters={{ ...defaultFilters }}
          onFiltersChange={mockOnFiltersChange}
          periodo={ESTE_MES}
          onPeriodoChange={mockOnPeriodoChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />,
      );

      // Regressão da causa raiz: com `FilterContent` declarado como componente
      // dentro do render, cada re-render dava um TIPO novo ao React e
      // remontava a subárvore inteira — as seções (e o seletor de período
      // aberto) perdiam o estado interno no meio da interação, sem erro no
      // console.
      expect(mockMontagensStatusSection.total).toBe(montagensIniciais);
    });
  });

  describe('Mobile Variant', () => {
    it('deve renderizar botão flutuante em mobile', () => {
      const { getByTestId } = renderAberto(
        <RouteFilters
          filters={defaultFilters}
          onFiltersChange={mockOnFiltersChange}
          periodo={ESTE_MES}
          onPeriodoChange={mockOnPeriodoChange}
          motoristas={mockMotoristas}
          variant="mobile"
        />,
      );

      expect(getByTestId('filter-floating-button')).toBeTruthy();
    });

    it('deve abrir modal ao clicar no botão flutuante', () => {
      const { getByTestId, getByText } = renderAberto(
        <RouteFilters
          filters={defaultFilters}
          onFiltersChange={mockOnFiltersChange}
          periodo={ESTE_MES}
          onPeriodoChange={mockOnPeriodoChange}
          motoristas={mockMotoristas}
          variant="mobile"
        />,
      );

      const floatingButton = getByTestId('filter-floating-button');
      fireEvent.press(floatingButton);

      // Modal deve estar visível
      expect(getByText('Filtros Avançados')).toBeTruthy();
    });
  });

  describe('Filter Counter Badge', () => {
    it('deve mostrar badge com contagem quando filtros ativos', () => {
      const filtersWithData: RouteFiltersState = {
        status: 'em_andamento',
        motoristaId: null,
      };

      const { getByText } = renderAberto(
        <RouteFilters
          filters={filtersWithData}
          onFiltersChange={mockOnFiltersChange}
          periodo={ESTE_MES}
          onPeriodoChange={mockOnPeriodoChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />,
      );

      // O período não conta: sempre há um (o padrão é "Este mês").
      expect(getByText('1')).toBeTruthy();
    });

    it('não deve mostrar badge quando nenhum filtro ativo', () => {
      const { queryByTestId } = renderAberto(
        <RouteFilters
          filters={defaultFilters}
          onFiltersChange={mockOnFiltersChange}
          periodo={ESTE_MES}
          onPeriodoChange={mockOnPeriodoChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />,
      );

      expect(queryByTestId('filter-badge')).toBeNull();
    });

    it('deve contar todos os filtros ativos corretamente', () => {
      const filtersWithAllActive: RouteFiltersState = {
        status: 'em_andamento',
        motoristaId: 'motorista-1',
      };

      const { getByText } = renderAberto(
        <RouteFilters
          filters={filtersWithAllActive}
          onFiltersChange={mockOnFiltersChange}
          periodo={ESTE_MES}
          onPeriodoChange={mockOnPeriodoChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />,
      );

      // Badge deve mostrar "2" (status + motoristaId)
      expect(getByText('2')).toBeTruthy();
    });
  });

  describe('Multiple Filters', () => {
    it('deve limpar filtros individuais mantendo os outros', () => {
      const filtersWithMultiple: RouteFiltersState = {
        status: 'em_andamento',
        motoristaId: 'motorista-1',
      };

      const { getByTestId, rerender: _rerender } = renderAberto(
        <RouteFilters
          filters={filtersWithMultiple}
          onFiltersChange={mockOnFiltersChange}
          periodo={ESTE_MES}
          onPeriodoChange={mockOnPeriodoChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />,
      );

      // Limpar apenas o status (toggle)
      const statusButton = getByTestId('filter-status-em_andamento');
      fireEvent.press(statusButton);

      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        status: null, // Limpo
        motoristaId: filtersWithMultiple.motoristaId, // Mantido
      });
    });
  });
});
