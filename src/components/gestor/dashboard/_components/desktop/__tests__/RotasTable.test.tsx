import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { RotasTable } from '../RotasTable';

// Mock EmptyState from design system
jest.mock('@/design-system', () => {
    const { View, Text } = require('react-native');
    return {
        EmptyState: ({ title, description }: any) => (
            <View>
                <Text>{title}</Text>
                {description ? <Text>{description}</Text> : null}
            </View>
        ),
    };
});

// Mock useUnistyles
jest.mock('@/utils/styles', () => {
    const { defaultTheme } = require('@/utils/styles.base');
    const theme = defaultTheme;

    return {
        useUnistyles: () => ({ theme }),
        StyleSheet: {
            create: (fn: Function) => (typeof fn === 'function' ? fn(theme) : fn),
        },
        defaultTheme: theme,
    };
});

describe('RotasTable', () => {
    const mockRotas = [
        {
            id: 'rota-1',
            motorista_nome: 'João Silva',
            status: 'pendente' as const,
            data: '2024-01-15',
            paradas_concluidas: 0,
            total_paradas: 5,
            distancia_total: 25.5,
        },
        {
            id: 'rota-2',
            motorista_nome: 'Maria Santos',
            status: 'em_andamento' as const,
            data: '2024-01-15',
            paradas_concluidas: 3,
            total_paradas: 8,
            distancia_total: 42.3,
        },
        {
            id: 'rota-3',
            motorista_nome: 'Pedro Costa',
            status: 'concluida' as const,
            data: '2024-01-14',
            paradas_concluidas: 6,
            total_paradas: 6,
            distancia_total: 18.7,
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Renderização', () => {
        it('deve renderizar tabela com rotas', () => {
            const { getByText } = render(<RotasTable rotas={mockRotas} />);

            expect(getByText('João Silva')).toBeTruthy();
            expect(getByText('Maria Santos')).toBeTruthy();
            expect(getByText('Pedro Costa')).toBeTruthy();
        });

        it('deve mostrar EmptyState quando não há rotas', () => {
            const { getByText } = render(<RotasTable rotas={[]} />);

            expect(getByText('Nenhuma rota cadastrada hoje')).toBeTruthy();
        });

        it('deve renderizar headers da tabela', () => {
            const { getByText } = render(<RotasTable rotas={mockRotas} />);

            expect(getByText('MOTORISTA')).toBeTruthy();
            expect(getByText('STATUS')).toBeTruthy();
            expect(getByText('PROGRESSO')).toBeTruthy();
            expect(getByText('DISTÂNCIA')).toBeTruthy();
            expect(getByText('AÇÕES')).toBeTruthy();
        });
    });

    describe('Status badges', () => {
        it('deve mostrar badge Pendente', () => {
            const { getByText } = render(
                <RotasTable rotas={[mockRotas[0]]} />
            );

            expect(getByText('Pendente')).toBeTruthy();
        });

        it('deve mostrar badge Em andamento', () => {
            const { getByText } = render(
                <RotasTable rotas={[mockRotas[1]]} />
            );

            expect(getByText('Em andamento')).toBeTruthy();
        });

        it('deve mostrar badge Concluída', () => {
            const { getByText } = render(
                <RotasTable rotas={[mockRotas[2]]} />
            );

            expect(getByText('Concluída')).toBeTruthy();
        });

        it('deve mostrar badge Cancelada', () => {
            const rotaCancelada = {
                ...mockRotas[0],
                status: 'cancelada' as const,
            };
            const { getByText } = render(
                <RotasTable rotas={[rotaCancelada]} />
            );

            expect(getByText('Cancelada')).toBeTruthy();
        });
    });

    describe('Progresso', () => {
        it('deve mostrar progresso correto', () => {
            const { getByText } = render(<RotasTable rotas={mockRotas} />);

            expect(getByText('0/5 paradas')).toBeTruthy();
            expect(getByText('3/8 paradas')).toBeTruthy();
            expect(getByText('6/6 paradas')).toBeTruthy();
        });
    });

    describe('Distância', () => {
        it('deve mostrar distância formatada', () => {
            const { getByText } = render(<RotasTable rotas={mockRotas} />);

            expect(getByText('25.5 km')).toBeTruthy();
            expect(getByText('42.3 km')).toBeTruthy();
            expect(getByText('18.7 km')).toBeTruthy();
        });
    });

    describe('Data', () => {
        it('deve formatar data corretamente', () => {
            const { getAllByText } = render(<RotasTable rotas={mockRotas} />);

            expect(getAllByText('15/01/2024').length).toBeGreaterThanOrEqual(1);
            expect(getAllByText('14/01/2024').length).toBeGreaterThanOrEqual(1);
        });

        it('deve mostrar "-" para data inválida', () => {
            const rotaSemData = { ...mockRotas[0], data: undefined };
            const { getByText } = render(
                <RotasTable rotas={[rotaSemData]} />
            );

            expect(getByText('-')).toBeTruthy();
        });
    });

    describe('Ações', () => {
        it('deve chamar onViewDetails ao clicar em Detalhes', () => {
            const onViewDetails = jest.fn();
            const { getByText } = render(
                <RotasTable rotas={[mockRotas[0]]} onViewDetails={onViewDetails} />
            );

            fireEvent.press(getByText('👁️ Detalhes'));

            expect(onViewDetails).toHaveBeenCalledWith('rota-1');
        });

        it('deve chamar onDelete ao clicar em Excluir', () => {
            const onDelete = jest.fn();
            const { getByText } = render(
                <RotasTable rotas={[mockRotas[0]]} onDelete={onDelete} />
            );

            fireEvent.press(getByText('🗑️ Excluir'));

            expect(onDelete).toHaveBeenCalledWith('rota-1');
        });

        it('não deve falhar sem callbacks', () => {
            const { getByText } = render(
                <RotasTable rotas={[mockRotas[0]]} />
            );

            // Deve renderizar botões sem callbacks
            expect(getByText('👁️ Detalhes')).toBeTruthy();
            expect(getByText('🗑️ Excluir')).toBeTruthy();
        });
    });

    describe('Múltiplas rotas', () => {
        it('deve renderizar todas as rotas', () => {
            const { getAllByText } = render(<RotasTable rotas={mockRotas} />);

            const botoes = getAllByText('👁️ Detalhes');
            expect(botoes.length).toBe(3);
        });
    });

    describe('Status desconhecido', () => {
        it('deve usar estilo default para status desconhecido', () => {
            const rotaStatusInvalido = {
                ...mockRotas[0],
                status: 'invalido' as any,
            };

            const { getByText } = render(
                <RotasTable rotas={[rotaStatusInvalido]} />
            );

            expect(getByText('Indefinido')).toBeTruthy();
        });
    });
});
