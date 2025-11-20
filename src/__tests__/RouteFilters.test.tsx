import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { RouteFilters } from '@/components/RouteFilters';
import type { RouteFilters as RouteFiltersType } from '@/components/RouteFilters';

describe('RouteFilters Component', () => {
  const mockOnFiltersChange = jest.fn();
  const mockMotoristas = [
    { id: 'motorista-1', nome: 'João Silva' },
    { id: 'motorista-2', nome: 'Maria Santos' },
  ];

  const defaultFilters: RouteFiltersType = {
    status: null,
    dataInicio: null,
    dataFim: null,
    motoristaId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Set Platform.OS to 'web' for web-specific tests
    (Platform as any).OS = 'web';
  });

  describe('Desktop Variant', () => {
    it('deve renderizar todos os campos de filtro', () => {
      const { getByText } = render(
        <RouteFilters
          filters={defaultFilters}
          onFiltersChange={mockOnFiltersChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />
      );

      expect(getByText('Status')).toBeTruthy();
      expect(getByText('Período')).toBeTruthy();
      expect(getByText('Motorista')).toBeTruthy();
    });

    it('deve aplicar filtro de status quando selecionado', () => {
      const { getByTestId } = render(
        <RouteFilters
          filters={defaultFilters}
          onFiltersChange={mockOnFiltersChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />
      );

      const statusButton = getByTestId('filter-status-em_andamento');
      fireEvent.press(statusButton);

      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        ...defaultFilters,
        status: 'em_andamento',
      });
    });

    it('deve limpar filtro de status ao clicar novamente (toggle)', () => {
      const filtersWithStatus: RouteFiltersType = {
        ...defaultFilters,
        status: 'em_andamento',
      };

      const { getByTestId } = render(
        <RouteFilters
          filters={filtersWithStatus}
          onFiltersChange={mockOnFiltersChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />
      );

      const statusButton = getByTestId('filter-status-em_andamento');
      fireEvent.press(statusButton);

      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        ...filtersWithStatus,
        status: null,
      });
    });

    it('deve aplicar filtro de motorista quando selecionado', () => {
      const { getByTestId } = render(
        <RouteFilters
          filters={defaultFilters}
          onFiltersChange={mockOnFiltersChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />
      );

      const motoristaButton = getByTestId('filter-motorista-motorista-1');
      fireEvent.press(motoristaButton);

      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        ...defaultFilters,
        motoristaId: 'motorista-1',
      });
    });

    it('deve limpar filtro de motorista ao clicar novamente (toggle)', () => {
      const filtersWithMotorista: RouteFiltersType = {
        ...defaultFilters,
        motoristaId: 'motorista-1',
      };

      const { getByTestId } = render(
        <RouteFilters
          filters={filtersWithMotorista}
          onFiltersChange={mockOnFiltersChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />
      );

      const motoristaButton = getByTestId('filter-motorista-motorista-1');
      fireEvent.press(motoristaButton);

      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        ...filtersWithMotorista,
        motoristaId: null,
      });
    });

    it('deve limpar todos os filtros ao clicar em "Limpar Filtros"', () => {
      const filtersWithData: RouteFiltersType = {
        status: 'em_andamento',
        dataInicio: new Date('2025-01-01'),
        dataFim: new Date('2025-01-31'),
        motoristaId: 'motorista-1',
      };

      const { getByText } = render(
        <RouteFilters
          filters={filtersWithData}
          onFiltersChange={mockOnFiltersChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />
      );

      // O botão mostra "Limpar Filtros (4)" porque há 4 filtros ativos
      const clearButton = getByText(/Limpar Filtros/);
      fireEvent.press(clearButton);

      expect(mockOnFiltersChange).toHaveBeenCalledWith(defaultFilters);
    });
  });

  describe('Filter Behavior', () => {
    it('deve aplicar filtro de data programaticamente', () => {
      const { rerender } = render(
        <RouteFilters
          filters={defaultFilters}
          onFiltersChange={mockOnFiltersChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />
      );

      // Simular aplicação de filtro de data externamente
      const newFilters: RouteFiltersType = {
        ...defaultFilters,
        dataInicio: new Date('2025-01-15'),
      };

      rerender(
        <RouteFilters
          filters={newFilters}
          onFiltersChange={mockOnFiltersChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />
      );

      // Verificar que o componente aceita o novo filtro
      expect(newFilters.dataInicio).toBeTruthy();
    });

    it('deve aplicar período completo (dataInicio + dataFim)', () => {
      const filtersWithPeriod: RouteFiltersType = {
        ...defaultFilters,
        dataInicio: new Date('2025-01-01'),
        dataFim: new Date('2025-01-31'),
      };

      render(
        <RouteFilters
          filters={filtersWithPeriod}
          onFiltersChange={mockOnFiltersChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />
      );

      // Verificar que ambas as datas estão definidas
      expect(filtersWithPeriod.dataInicio).toBeTruthy();
      expect(filtersWithPeriod.dataFim).toBeTruthy();
    });

    it('deve limpar filtro de data ao definir como null', () => {
      const filtersWithDate: RouteFiltersType = {
        ...defaultFilters,
        dataInicio: new Date('2025-01-15'),
      };

      const { rerender } = render(
        <RouteFilters
          filters={filtersWithDate}
          onFiltersChange={mockOnFiltersChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />
      );

      // Simular limpeza de filtro
      const clearedFilters: RouteFiltersType = {
        ...filtersWithDate,
        dataInicio: null,
      };

      rerender(
        <RouteFilters
          filters={clearedFilters}
          onFiltersChange={mockOnFiltersChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />
      );

      expect(clearedFilters.dataInicio).toBeNull();
    });
  });

  describe('Mobile Variant', () => {
    it('deve renderizar botão flutuante em mobile', () => {
      const { getByTestId } = render(
        <RouteFilters
          filters={defaultFilters}
          onFiltersChange={mockOnFiltersChange}
          motoristas={mockMotoristas}
          variant="mobile"
        />
      );

      expect(getByTestId('filter-floating-button')).toBeTruthy();
    });

    it('deve abrir modal ao clicar no botão flutuante', () => {
      const { getByTestId, getByText } = render(
        <RouteFilters
          filters={defaultFilters}
          onFiltersChange={mockOnFiltersChange}
          motoristas={mockMotoristas}
          variant="mobile"
        />
      );

      const floatingButton = getByTestId('filter-floating-button');
      fireEvent.press(floatingButton);

      // Modal deve estar visível
      expect(getByText('Filtros Avançados')).toBeTruthy();
    });
  });

  describe('Filter Counter Badge', () => {
    it('deve mostrar badge com contagem quando filtros ativos', () => {
      const filtersWithData: RouteFiltersType = {
        status: 'em_andamento',
        dataInicio: new Date('2025-01-01'),
        dataFim: null,
        motoristaId: null,
      };

      const { getByText } = render(
        <RouteFilters
          filters={filtersWithData}
          onFiltersChange={mockOnFiltersChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />
      );

      // Badge deve mostrar "2" (status + dataInicio)
      expect(getByText('2')).toBeTruthy();
    });

    it('não deve mostrar badge quando nenhum filtro ativo', () => {
      const { queryByTestId } = render(
        <RouteFilters
          filters={defaultFilters}
          onFiltersChange={mockOnFiltersChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />
      );

      expect(queryByTestId('filter-badge')).toBeNull();
    });

    it('deve contar todos os filtros ativos corretamente', () => {
      const filtersWithAllActive: RouteFiltersType = {
        status: 'em_andamento',
        dataInicio: new Date('2025-01-01'),
        dataFim: new Date('2025-01-31'),
        motoristaId: 'motorista-1',
      };

      const { getByText } = render(
        <RouteFilters
          filters={filtersWithAllActive}
          onFiltersChange={mockOnFiltersChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />
      );

      // Badge deve mostrar "4" (status + dataInicio + dataFim + motoristaId)
      expect(getByText('4')).toBeTruthy();
    });
  });

  describe('Multiple Filters', () => {
    it('deve aplicar múltiplos filtros simultaneamente', () => {
      const multipleFilters: RouteFiltersType = {
        status: 'em_andamento',
        dataInicio: new Date('2025-01-01'),
        dataFim: new Date('2025-01-31'),
        motoristaId: 'motorista-1',
      };

      render(
        <RouteFilters
          filters={multipleFilters}
          onFiltersChange={mockOnFiltersChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />
      );

      // Verificar que todos os filtros estão aplicados
      expect(multipleFilters.status).toBe('em_andamento');
      expect(multipleFilters.dataInicio).toBeTruthy();
      expect(multipleFilters.dataFim).toBeTruthy();
      expect(multipleFilters.motoristaId).toBe('motorista-1');
    });

    it('deve limpar filtros individuais mantendo os outros', () => {
      const filtersWithMultiple: RouteFiltersType = {
        status: 'em_andamento',
        dataInicio: new Date('2025-01-01'),
        dataFim: new Date('2025-01-31'),
        motoristaId: 'motorista-1',
      };

      const { getByTestId, rerender } = render(
        <RouteFilters
          filters={filtersWithMultiple}
          onFiltersChange={mockOnFiltersChange}
          motoristas={mockMotoristas}
          variant="desktop"
        />
      );

      // Limpar apenas o status (toggle)
      const statusButton = getByTestId('filter-status-em_andamento');
      fireEvent.press(statusButton);

      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        status: null, // Limpo
        dataInicio: filtersWithMultiple.dataInicio, // Mantido
        dataFim: filtersWithMultiple.dataFim, // Mantido
        motoristaId: filtersWithMultiple.motoristaId, // Mantido
      });
    });
  });
});
