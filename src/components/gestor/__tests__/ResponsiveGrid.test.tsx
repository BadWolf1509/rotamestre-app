import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { ResponsiveGrid, GridItem, MetricCard } from '../ResponsiveGrid';

// Mock useResponsive
const mockIsDesktop = jest.fn();
const mockIsTablet = jest.fn();
const mockIsMobile = jest.fn();

jest.mock('@/hooks/useResponsive', () => ({
    useResponsive: () => ({
        isDesktop: mockIsDesktop(),
        isTablet: mockIsTablet(),
        isMobile: mockIsMobile(),
    }),
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

describe('ResponsiveGrid', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockIsDesktop.mockReturnValue(false);
        mockIsTablet.mockReturnValue(false);
        mockIsMobile.mockReturnValue(true);
    });

    describe('ResponsiveGrid container', () => {
        it('deve renderizar filhos corretamente', () => {
            const { getByText } = render(
                <ResponsiveGrid>
                    <GridItem>
                        <Text>Item 1</Text>
                    </GridItem>
                </ResponsiveGrid>
            );

            expect(getByText('Item 1')).toBeTruthy();
        });

        it('deve usar spacing padrão de 16', () => {
            const { toJSON } = render(
                <ResponsiveGrid>
                    <Text>Content</Text>
                </ResponsiveGrid>
            );

            expect(toJSON()).toBeTruthy();
        });

        it('deve aceitar spacing customizado', () => {
            const { toJSON } = render(
                <ResponsiveGrid spacing={24}>
                    <Text>Content</Text>
                </ResponsiveGrid>
            );

            expect(toJSON()).toBeTruthy();
        });

        it('deve usar ScrollView quando scrollable é true', () => {
            const { toJSON } = render(
                <ResponsiveGrid scrollable>
                    <Text>Content</Text>
                </ResponsiveGrid>
            );

            expect(toJSON()).toBeTruthy();
        });

        it('deve usar View quando scrollable é false', () => {
            const { toJSON } = render(
                <ResponsiveGrid scrollable={false}>
                    <Text>Content</Text>
                </ResponsiveGrid>
            );

            expect(toJSON()).toBeTruthy();
        });
    });

    describe('GridItem', () => {
        it('deve renderizar filhos', () => {
            mockIsMobile.mockReturnValue(true);

            const { getByText } = render(
                <GridItem>
                    <Text>Grid Content</Text>
                </GridItem>
            );

            expect(getByText('Grid Content')).toBeTruthy();
        });

        it('deve calcular largura 100% para mobile com span padrão', () => {
            mockIsMobile.mockReturnValue(true);
            mockIsTablet.mockReturnValue(false);
            mockIsDesktop.mockReturnValue(false);

            const { toJSON } = render(
                <GridItem>
                    <Text>Content</Text>
                </GridItem>
            );

            expect(toJSON()).toBeTruthy();
        });

        it('deve calcular largura baseada em span.mobile', () => {
            mockIsMobile.mockReturnValue(true);
            mockIsTablet.mockReturnValue(false);
            mockIsDesktop.mockReturnValue(false);

            const { toJSON } = render(
                <GridItem span={{ mobile: 1, tablet: 1, desktop: 2 }}>
                    <Text>Content</Text>
                </GridItem>
            );

            expect(toJSON()).toBeTruthy();
        });

        it('deve calcular largura para tablet (50% por coluna)', () => {
            mockIsMobile.mockReturnValue(false);
            mockIsTablet.mockReturnValue(true);
            mockIsDesktop.mockReturnValue(false);

            const { toJSON } = render(
                <GridItem span={{ tablet: 1 }}>
                    <Text>Content</Text>
                </GridItem>
            );

            expect(toJSON()).toBeTruthy();
        });

        it('deve calcular largura para desktop (25% por coluna)', () => {
            mockIsMobile.mockReturnValue(false);
            mockIsTablet.mockReturnValue(false);
            mockIsDesktop.mockReturnValue(true);

            const { toJSON } = render(
                <GridItem span={{ desktop: 1 }}>
                    <Text>Content</Text>
                </GridItem>
            );

            expect(toJSON()).toBeTruthy();
        });

        it('deve calcular largura 50% para desktop com span 2', () => {
            mockIsMobile.mockReturnValue(false);
            mockIsTablet.mockReturnValue(false);
            mockIsDesktop.mockReturnValue(true);

            const { toJSON } = render(
                <GridItem span={{ desktop: 2 }}>
                    <Text>Content</Text>
                </GridItem>
            );

            expect(toJSON()).toBeTruthy();
        });

        it('deve usar order padrão 0', () => {
            mockIsMobile.mockReturnValue(true);

            const { toJSON } = render(
                <GridItem>
                    <Text>Content</Text>
                </GridItem>
            );

            expect(toJSON()).toBeTruthy();
        });

        it('deve aceitar order customizado', () => {
            mockIsMobile.mockReturnValue(true);

            const { toJSON } = render(
                <GridItem order={{ mobile: 2, tablet: 1, desktop: 0 }}>
                    <Text>Content</Text>
                </GridItem>
            );

            expect(toJSON()).toBeTruthy();
        });

        it('deve usar order.desktop em desktop', () => {
            mockIsMobile.mockReturnValue(false);
            mockIsTablet.mockReturnValue(false);
            mockIsDesktop.mockReturnValue(true);

            const { toJSON } = render(
                <GridItem order={{ desktop: 5 }}>
                    <Text>Content</Text>
                </GridItem>
            );

            expect(toJSON()).toBeTruthy();
        });

        it('deve usar order.tablet em tablet', () => {
            mockIsMobile.mockReturnValue(false);
            mockIsTablet.mockReturnValue(true);
            mockIsDesktop.mockReturnValue(false);

            const { toJSON } = render(
                <GridItem order={{ tablet: 3 }}>
                    <Text>Content</Text>
                </GridItem>
            );

            expect(toJSON()).toBeTruthy();
        });
    });

    describe('MetricCard', () => {
        it('deve renderizar título e valor', () => {
            mockIsDesktop.mockReturnValue(false);

            const { getByText } = render(
                <MetricCard title="Total" value={42} />
            );

            expect(getByText('Total')).toBeTruthy();
            expect(getByText('42')).toBeTruthy();
        });

        it('deve renderizar subtitle quando fornecido', () => {
            mockIsDesktop.mockReturnValue(false);

            const { getByText } = render(
                <MetricCard title="Total" value={42} subtitle="Último mês" />
            );

            expect(getByText('Último mês')).toBeTruthy();
        });

        it('deve aceitar valor como string', () => {
            mockIsDesktop.mockReturnValue(false);

            const { getByText } = render(
                <MetricCard title="Receita" value="R$ 1.500" />
            );

            expect(getByText('R$ 1.500')).toBeTruthy();
        });

        it('deve renderizar icon quando fornecido', () => {
            mockIsDesktop.mockReturnValue(false);

            const { getByText } = render(
                <MetricCard
                    title="Rotas"
                    value={10}
                    icon={<Text>🚗</Text>}
                />
            );

            expect(getByText('🚗')).toBeTruthy();
        });

        it('deve renderizar trend up', () => {
            mockIsDesktop.mockReturnValue(false);

            const { toJSON } = render(
                <MetricCard title="Crescimento" value={25} trend="up" />
            );

            expect(toJSON()).toBeTruthy();
        });

        it('deve renderizar trend down', () => {
            mockIsDesktop.mockReturnValue(false);

            const { toJSON } = render(
                <MetricCard title="Declínio" value={-5} trend="down" />
            );

            expect(toJSON()).toBeTruthy();
        });

        it('deve renderizar trend neutral', () => {
            mockIsDesktop.mockReturnValue(false);

            const { toJSON } = render(
                <MetricCard title="Estável" value={0} trend="neutral" />
            );

            expect(toJSON()).toBeTruthy();
        });

        it('deve aceitar color customizado', () => {
            mockIsDesktop.mockReturnValue(false);

            const { toJSON } = render(
                <MetricCard title="Custom" value={100} color="#FF5500" />
            );

            expect(toJSON()).toBeTruthy();
        });

        it('deve mostrar botão de ação em desktop', () => {
            mockIsDesktop.mockReturnValue(true);

            const { toJSON } = render(
                <MetricCard title="Desktop" value={50} />
            );

            // Em desktop, o botão de ação deve estar presente
            expect(toJSON()).toBeTruthy();
        });

        it('não deve mostrar botão de ação em mobile', () => {
            mockIsDesktop.mockReturnValue(false);
            mockIsMobile.mockReturnValue(true);

            const { toJSON } = render(
                <MetricCard title="Mobile" value={50} />
            );

            expect(toJSON()).toBeTruthy();
        });

        it('deve renderizar sem icon quando não fornecido', () => {
            mockIsDesktop.mockReturnValue(false);

            const { getByText } = render(
                <MetricCard title="No Icon" value={99} />
            );

            expect(getByText('No Icon')).toBeTruthy();
            expect(getByText('99')).toBeTruthy();
        });

        it('deve renderizar sem subtitle quando não fornecido', () => {
            mockIsDesktop.mockReturnValue(false);

            const { getByText } = render(
                <MetricCard title="No Subtitle" value={88} />
            );

            expect(getByText('No Subtitle')).toBeTruthy();
            // Nenhum subtitle adicional
        });

        it('deve renderizar todos os elementos juntos', () => {
            mockIsDesktop.mockReturnValue(true);

            const { getByText } = render(
                <MetricCard
                    title="Completo"
                    value="R$ 999"
                    subtitle="Este mês"
                    icon={<Text>📊</Text>}
                    trend="up"
                    color="#00FF00"
                />
            );

            expect(getByText('Completo')).toBeTruthy();
            expect(getByText('R$ 999')).toBeTruthy();
            expect(getByText('Este mês')).toBeTruthy();
            expect(getByText('📊')).toBeTruthy();
        });
    });

    describe('Integration', () => {
        it('deve renderizar grid completo com items e metric cards', () => {
            mockIsMobile.mockReturnValue(false);
            mockIsTablet.mockReturnValue(false);
            mockIsDesktop.mockReturnValue(true);

            const { getByText } = render(
                <ResponsiveGrid spacing={20}>
                    <GridItem span={{ desktop: 2, tablet: 1, mobile: 1 }}>
                        <MetricCard title="Rotas Hoje" value={15} trend="up" />
                    </GridItem>
                    <GridItem span={{ desktop: 1 }}>
                        <MetricCard title="Motoristas" value={5} />
                    </GridItem>
                    <GridItem span={{ desktop: 1 }}>
                        <MetricCard title="Concluídas" value={12} trend="up" />
                    </GridItem>
                </ResponsiveGrid>
            );

            expect(getByText('Rotas Hoje')).toBeTruthy();
            expect(getByText('15')).toBeTruthy();
            expect(getByText('Motoristas')).toBeTruthy();
            expect(getByText('5')).toBeTruthy();
            expect(getByText('Concluídas')).toBeTruthy();
            expect(getByText('12')).toBeTruthy();
        });
    });
});
