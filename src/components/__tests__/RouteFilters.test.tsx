import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RouteFilters } from '../RouteFilters';

// Mock DateTimePicker
jest.mock('@react-native-community/datetimepicker', () => {
    const MockDateTimePicker = (props: any) => {
        return <>{JSON.stringify(props)}</>;
    };
    return MockDateTimePicker;
});

// Mock DateTimePickerModal (react-native-ui-datepicker)
jest.mock('react-native-ui-datepicker', () => ({
    __esModule: true,
    default: (props: any) => <>{JSON.stringify(props)}</>,
    useDefaultStyles: () => ({}),
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

describe('RouteFilters', () => {
    const mockOnFiltersChange = jest.fn();
    const defaultFilters = {
        status: null,
        dataInicio: null,
        dataFim: null,
        motoristaId: null,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('deve renderizar corretamente em desktop', () => {
        const { getByText } = render(
            <RouteFilters
                filters={defaultFilters}
                onFiltersChange={mockOnFiltersChange}
                variant="desktop"
            />
        );

        expect(getByText('Filtros')).toBeTruthy();
        expect(getByText('Status')).toBeTruthy();
        expect(getByText('Período')).toBeTruthy();
    });

    it('deve renderizar botão flutuante em mobile', () => {
        const { getByTestId } = render(
            <RouteFilters
                filters={defaultFilters}
                onFiltersChange={mockOnFiltersChange}
                variant="mobile"
            />
        );

        expect(getByTestId('filter-floating-button')).toBeTruthy();
    });

    it('deve abrir modal ao clicar no botão flutuante em mobile', () => {
        const { getByTestId, getByText } = render(
            <RouteFilters
                filters={defaultFilters}
                onFiltersChange={mockOnFiltersChange}
                variant="mobile"
            />
        );

        fireEvent.press(getByTestId('filter-floating-button'));
        expect(getByText('Filtros Avançados')).toBeTruthy();
    });

    it('deve alterar status ao clicar na opção', () => {
        const { getByText } = render(
            <RouteFilters
                filters={defaultFilters}
                onFiltersChange={mockOnFiltersChange}
                variant="desktop"
            />
        );

        fireEvent.press(getByText('Pendente'));
        expect(mockOnFiltersChange).toHaveBeenCalledWith({
            ...defaultFilters,
            status: 'pendente',
        });
    });

    it('deve limpar status ao clicar na opção selecionada', () => {
        const { getByText } = render(
            <RouteFilters
                filters={{ ...defaultFilters, status: 'pendente' }}
                onFiltersChange={mockOnFiltersChange}
                variant="desktop"
            />
        );

        fireEvent.press(getByText('Pendente'));
        expect(mockOnFiltersChange).toHaveBeenCalledWith({
            ...defaultFilters,
            status: null,
        });
    });

    it('deve mostrar lista de motoristas se fornecida', () => {
        const motoristas = [
            { id: '1', nome: 'João' },
            { id: '2', nome: 'Maria' },
        ];

        const { getByText } = render(
            <RouteFilters
                filters={defaultFilters}
                onFiltersChange={mockOnFiltersChange}
                motoristas={motoristas}
                variant="desktop"
            />
        );

        expect(getByText('Motorista')).toBeTruthy();
        expect(getByText('João')).toBeTruthy();
        expect(getByText('Maria')).toBeTruthy();
    });

    it('deve selecionar motorista', () => {
        const motoristas = [{ id: '1', nome: 'João' }];
        const { getByText } = render(
            <RouteFilters
                filters={defaultFilters}
                onFiltersChange={mockOnFiltersChange}
                motoristas={motoristas}
                variant="desktop"
            />
        );

        fireEvent.press(getByText('João'));
        expect(mockOnFiltersChange).toHaveBeenCalledWith({
            ...defaultFilters,
            motoristaId: '1',
        });
    });

    it('deve limpar filtros', () => {
        const filters = {
            status: 'pendente' as const,
            dataInicio: new Date(),
            dataFim: new Date(),
            motoristaId: '1',
        };

        const { getByText } = render(
            <RouteFilters
                filters={filters}
                onFiltersChange={mockOnFiltersChange}
                variant="desktop"
            />
        );

        fireEvent.press(getByText(/Limpar Filtros/));
        expect(mockOnFiltersChange).toHaveBeenCalledWith({
            status: null,
            dataInicio: null,
            dataFim: null,
            motoristaId: null,
        });
    });
});
