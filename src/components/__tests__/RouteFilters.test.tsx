import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { RouteFilters } from '../RouteFilters';

// Mock DateTimePicker
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

// Mock DateTimePickerModal
jest.mock('react-native-ui-datepicker', () => ({
  __esModule: true,
  default: () => null,
  useDefaultStyles: () => ({}),
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('RouteFilters', () => {
  const defaultProps = {
    filters: {},
    onFiltersChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('deve renderizar corretamente com props basicas', () => {
      const { toJSON } = render(<RouteFilters {...defaultProps} />);
      expect(toJSON()).toBeTruthy();
    });

    it('deve renderizar variante desktop', () => {
      const { toJSON } = render(
        <RouteFilters {...defaultProps} variant="desktop" />,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('deve renderizar variante mobile', () => {
      const { toJSON } = render(
        <RouteFilters {...defaultProps} variant="mobile" />,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('deve renderizar com motoristas', () => {
      const motoristas = [
        { id: 'mot-1', nome: 'Motorista 1' },
        { id: 'mot-2', nome: 'Motorista 2' },
      ];

      const { toJSON } = render(
        <RouteFilters {...defaultProps} motoristas={motoristas} />,
      );
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Filters', () => {
    it('deve aceitar filtro de status', () => {
      const filters = { status: 'em_andamento' as const };

      const { toJSON } = render(
        <RouteFilters {...defaultProps} filters={filters} />,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('deve aceitar filtro de dataInicio', () => {
      const filters = { dataInicio: new Date('2025-01-01') };

      const { toJSON } = render(
        <RouteFilters {...defaultProps} filters={filters} />,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('deve aceitar filtro de dataFim', () => {
      const filters = { dataFim: new Date('2025-01-31') };

      const { toJSON } = render(
        <RouteFilters {...defaultProps} filters={filters} />,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('deve aceitar filtro de motoristaId', () => {
      const filters = { motoristaId: 'motorista-1' };

      const { toJSON } = render(
        <RouteFilters {...defaultProps} filters={filters} />,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('deve aceitar todos os filtros', () => {
      const filters = {
        status: 'concluida' as const,
        dataInicio: new Date('2025-01-01'),
        dataFim: new Date('2025-01-31'),
        motoristaId: 'mot-1',
      };

      const { toJSON } = render(
        <RouteFilters {...defaultProps} filters={filters} />,
      );
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Callbacks', () => {
    it('deve ter onFiltersChange como funcao', () => {
      const onFiltersChange = jest.fn();

      render(
        <RouteFilters {...defaultProps} onFiltersChange={onFiltersChange} />,
      );

      expect(typeof onFiltersChange).toBe('function');
    });
  });

  describe('Status options', () => {
    it('deve renderizar sem status selecionado', () => {
      const { toJSON } = render(
        <RouteFilters {...defaultProps} filters={{ status: null }} />,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('deve renderizar com status pendente', () => {
      const { toJSON } = render(
        <RouteFilters {...defaultProps} filters={{ status: 'pendente' }} />,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('deve renderizar com status concluida', () => {
      const { toJSON } = render(
        <RouteFilters {...defaultProps} filters={{ status: 'concluida' }} />,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('deve renderizar com status cancelada', () => {
      const { toJSON } = render(
        <RouteFilters {...defaultProps} filters={{ status: 'cancelada' }} />,
      );
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Empty states', () => {
    it('deve renderizar com filtros vazios', () => {
      const { toJSON } = render(
        <RouteFilters {...defaultProps} filters={{}} />,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('deve renderizar com motoristas vazios', () => {
      const { toJSON } = render(
        <RouteFilters {...defaultProps} motoristas={[]} />,
      );
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Date handling', () => {
    it('deve aceitar datas nulas', () => {
      const filters = {
        dataInicio: null,
        dataFim: null,
      };

      const { toJSON } = render(
        <RouteFilters {...defaultProps} filters={filters} />,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('deve aceitar data de inicio sem data fim', () => {
      const filters = {
        dataInicio: new Date('2025-01-01'),
        dataFim: null,
      };

      const { toJSON } = render(
        <RouteFilters {...defaultProps} filters={filters} />,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('deve aceitar data fim sem data inicio', () => {
      const filters = {
        dataInicio: null,
        dataFim: new Date('2025-01-31'),
      };

      const { toJSON } = render(
        <RouteFilters {...defaultProps} filters={filters} />,
      );
      expect(toJSON()).toBeTruthy();
    });
  });
  describe('Desktop recolhido', () => {
    const motoristas = [
      { id: 'mot-1', nome: 'Ana Souza' },
      { id: 'mot-2', nome: 'Bia Lima' },
    ];

    it('começa sem as seções, com o botão "Filtros" fechado', () => {
      const { getByRole, queryByText } = render(
        <RouteFilters
          {...defaultProps}
          motoristas={motoristas}
          variant="desktop"
        />,
      );

      const botao = getByRole('button', { name: /^Filtros/ });
      expect(botao.props.accessibilityState).toEqual(
        expect.objectContaining({ expanded: false }),
      );
      expect(queryByText('Status')).toBeNull();
      expect(queryByText('Período')).toBeNull();
      expect(queryByText('Motorista')).toBeNull();
    });

    it('tocar em "Filtros" mostra as seções', () => {
      const { getByTestId, getByText } = render(
        <RouteFilters
          {...defaultProps}
          motoristas={motoristas}
          variant="desktop"
        />,
      );

      fireEvent.press(getByTestId('route-filters-toggle'));

      expect(
        getByTestId('route-filters-toggle').props.accessibilityState,
      ).toEqual(expect.objectContaining({ expanded: true }));
      expect(getByText('Status')).toBeTruthy();
      expect(getByText('Período')).toBeTruthy();
      expect(getByText('Motorista')).toBeTruthy();
    });

    it('sem filtro, o resumo diz o padrão', () => {
      const { getByTestId } = render(
        <RouteFilters
          {...defaultProps}
          motoristas={motoristas}
          variant="desktop"
        />,
      );

      expect(getByTestId('route-filters-resumo')).toHaveTextContent(
        'Todos os status, hoje, todos os motoristas',
      );
    });

    it('com filtros, o resumo diz quais estão ativos', () => {
      const { getByTestId } = render(
        <RouteFilters
          {...defaultProps}
          motoristas={motoristas}
          variant="desktop"
          filters={{ status: 'em_andamento', motoristaId: 'mot-2' }}
        />,
      );

      expect(getByTestId('route-filters-resumo')).toHaveTextContent(
        'Em andamento, hoje, Bia Lima',
      );
    });

    it.each([
      [{ dataInicio: new Date(2026, 10, 1) }, 'a partir de 01/11/2026'],
      [{ dataFim: new Date(2026, 10, 5) }, 'até 05/11/2026'],
    ])(
      'no meio da frase, o período fica em minúscula (%o)',
      (datas, trecho) => {
        const { getByTestId } = render(
          <RouteFilters
            {...defaultProps}
            motoristas={motoristas}
            variant="desktop"
            filters={datas}
          />,
        );

        expect(getByTestId('route-filters-resumo')).toHaveTextContent(
          `Todos os status, ${trecho}, todos os motoristas`,
        );
      },
    );
  });
});
