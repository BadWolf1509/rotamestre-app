import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import type { Periodo } from '@/lib/periodo';

import { RouteFilters } from '../RouteFilters';

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

jest.mock('react-native-ui-datepicker', () => ({
  __esModule: true,
  default: () => null,
  useDefaultStyles: () => ({}),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

const ESTE_MES: Periodo = { tipo: 'este_mes' };

describe('RouteFilters', () => {
  const defaultProps = {
    filters: {},
    onFiltersChange: jest.fn(),
    periodo: ESTE_MES,
    onPeriodoChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('deve renderizar corretamente com props basicas', () => {
      const { toJSON } = render(<RouteFilters {...defaultProps} />);
      expect(toJSON()).toBeTruthy();
    });

    it('deve renderizar variante mobile', () => {
      const { toJSON } = render(
        <RouteFilters {...defaultProps} variant="mobile" />,
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

  describe('Mobile', () => {
    it('sem periodo (o celular escolhe fora do modal), o modal não tem a seção Período', () => {
      const { getByTestId, getByText, queryByText, queryByTestId } = render(
        <RouteFilters
          filters={{}}
          onFiltersChange={jest.fn()}
          variant="mobile"
        />,
      );

      fireEvent.press(getByTestId('filter-floating-button'));

      expect(getByText('Status')).toBeTruthy();
      expect(queryByText('Período')).toBeNull();
      expect(queryByTestId('filtro-periodo')).toBeNull();
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

    it('tocar em "Filtros" mostra as seções, com o seletor de período', () => {
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
      expect(getByTestId('filtro-periodo')).toBeTruthy();
      // O "Selecionar período" antigo saiu.
      expect(() => getByTestId('filter-date-range')).toThrow();
    });

    it('sem filtro, o resumo diz o padrão: "este mês" em minúscula, sem datas', () => {
      const { getByTestId } = render(
        <RouteFilters
          {...defaultProps}
          motoristas={motoristas}
          variant="desktop"
        />,
      );

      expect(getByTestId('route-filters-resumo')).toHaveTextContent(
        'Todos os status, este mês, todos os motoristas',
      );
    });

    it('com filtros, o resumo diz quais estão ativos', () => {
      const { getByTestId } = render(
        <RouteFilters
          {...defaultProps}
          motoristas={motoristas}
          variant="desktop"
          filters={{ status: 'em_andamento', motoristaId: 'mot-2' }}
          periodo={{ tipo: 'semana_passada' }}
        />,
      );

      expect(getByTestId('route-filters-resumo')).toHaveTextContent(
        'Em andamento, semana passada, Bia Lima',
      );
    });

    it.each<[Periodo, string]>([
      [{ tipo: 'todo' }, 'todo o período'],
      [{ tipo: 'hoje' }, 'hoje'],
      [
        { tipo: 'personalizado', de: '2020-10-01', ate: '2020-10-15' },
        '01/10/2020 a 15/10/2020',
      ],
      // Intervalo incompleto (só por chamada errada): o rótulo, nunca
      // "Todos os status, , todos os motoristas".
      [{ tipo: 'personalizado', de: '', ate: '' }, 'personalizado'],
    ])('o período no resumo (%o)', (periodo, trecho) => {
      const { getByTestId } = render(
        <RouteFilters
          {...defaultProps}
          motoristas={motoristas}
          variant="desktop"
          periodo={periodo}
        />,
      );

      expect(getByTestId('route-filters-resumo')).toHaveTextContent(
        `Todos os status, ${trecho}, todos os motoristas`,
      );
    });
  });
});
