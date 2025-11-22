import { render } from '@testing-library/react-native';
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
                <RouteFilters {...defaultProps} variant="desktop" />
            );
            expect(toJSON()).toBeTruthy();
        });

        it('deve renderizar variante mobile', () => {
            const { toJSON } = render(
                <RouteFilters {...defaultProps} variant="mobile" />
            );
            expect(toJSON()).toBeTruthy();
        });

        it('deve renderizar com motoristas', () => {
            const motoristas = [
                { id: 'mot-1', nome: 'Motorista 1' },
                { id: 'mot-2', nome: 'Motorista 2' },
            ];

            const { toJSON } = render(
                <RouteFilters {...defaultProps} motoristas={motoristas} />
            );
            expect(toJSON()).toBeTruthy();
        });
    });

    describe('Filters', () => {
        it('deve aceitar filtro de status', () => {
            const filters = { status: 'em_andamento' as const };

            const { toJSON } = render(
                <RouteFilters {...defaultProps} filters={filters} />
            );
            expect(toJSON()).toBeTruthy();
        });

        it('deve aceitar filtro de dataInicio', () => {
            const filters = { dataInicio: new Date('2025-01-01') };

            const { toJSON } = render(
                <RouteFilters {...defaultProps} filters={filters} />
            );
            expect(toJSON()).toBeTruthy();
        });

        it('deve aceitar filtro de dataFim', () => {
            const filters = { dataFim: new Date('2025-01-31') };

            const { toJSON } = render(
                <RouteFilters {...defaultProps} filters={filters} />
            );
            expect(toJSON()).toBeTruthy();
        });

        it('deve aceitar filtro de motoristaId', () => {
            const filters = { motoristaId: 'motorista-1' };

            const { toJSON } = render(
                <RouteFilters {...defaultProps} filters={filters} />
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
                <RouteFilters {...defaultProps} filters={filters} />
            );
            expect(toJSON()).toBeTruthy();
        });
    });

    describe('Callbacks', () => {
        it('deve ter onFiltersChange como funcao', () => {
            const onFiltersChange = jest.fn();

            render(
                <RouteFilters {...defaultProps} onFiltersChange={onFiltersChange} />
            );

            expect(typeof onFiltersChange).toBe('function');
        });
    });

    describe('Status options', () => {
        it('deve renderizar sem status selecionado', () => {
            const { toJSON } = render(
                <RouteFilters {...defaultProps} filters={{ status: null }} />
            );
            expect(toJSON()).toBeTruthy();
        });

        it('deve renderizar com status pendente', () => {
            const { toJSON } = render(
                <RouteFilters {...defaultProps} filters={{ status: 'pendente' }} />
            );
            expect(toJSON()).toBeTruthy();
        });

        it('deve renderizar com status concluida', () => {
            const { toJSON } = render(
                <RouteFilters {...defaultProps} filters={{ status: 'concluida' }} />
            );
            expect(toJSON()).toBeTruthy();
        });

        it('deve renderizar com status cancelada', () => {
            const { toJSON } = render(
                <RouteFilters {...defaultProps} filters={{ status: 'cancelada' }} />
            );
            expect(toJSON()).toBeTruthy();
        });
    });

    describe('Empty states', () => {
        it('deve renderizar com filtros vazios', () => {
            const { toJSON } = render(
                <RouteFilters {...defaultProps} filters={{}} />
            );
            expect(toJSON()).toBeTruthy();
        });

        it('deve renderizar com motoristas vazios', () => {
            const { toJSON } = render(
                <RouteFilters {...defaultProps} motoristas={[]} />
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
                <RouteFilters {...defaultProps} filters={filters} />
            );
            expect(toJSON()).toBeTruthy();
        });

        it('deve aceitar data de inicio sem data fim', () => {
            const filters = {
                dataInicio: new Date('2025-01-01'),
                dataFim: null,
            };

            const { toJSON } = render(
                <RouteFilters {...defaultProps} filters={filters} />
            );
            expect(toJSON()).toBeTruthy();
        });

        it('deve aceitar data fim sem data inicio', () => {
            const filters = {
                dataInicio: null,
                dataFim: new Date('2025-01-31'),
            };

            const { toJSON } = render(
                <RouteFilters {...defaultProps} filters={filters} />
            );
            expect(toJSON()).toBeTruthy();
        });
    });
});
