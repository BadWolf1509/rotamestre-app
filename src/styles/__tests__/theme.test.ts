import { colors, spacing, borderRadius, typography, shadows, layout, theme } from '../theme';

describe('theme', () => {
    describe('colors', () => {
        it('deve ter cores primárias', () => {
            expect(colors.primary).toBe('#284093');
            expect(colors.primaryDark).toBe('#1b2c63');
            expect(colors.primaryLight).toBe('#34699f');
            expect(colors.primaryBg).toBe('#e6ecfb');
        });

        it('deve ter cores secundárias', () => {
            expect(colors.secondary).toBe('#f7a02a');
            expect(colors.secondaryDark).toBe('#c87704');
            expect(colors.secondaryLight).toBe('#ffbf14');
            expect(colors.secondaryBg).toBe('#fff3d6');
        });

        it('deve ter cores de feedback', () => {
            expect(colors.success).toBe('#10b981');
            expect(colors.warning).toBe('#f59e0b');
            expect(colors.error).toBe('#ef4444');
            expect(colors.info).toBe('#3b82f6');
        });

        it('deve ter escalas de cinza', () => {
            expect(colors.gray50).toBe('#f9fafb');
            expect(colors.gray500).toBe('#6b7280');
            expect(colors.gray900).toBe('#111827');
        });

        it('deve ter cores especiais', () => {
            expect(colors.white).toBe('#ffffff');
            expect(colors.black).toBe('#000000');
            expect(colors.transparent).toBe('transparent');
            expect(colors.purple).toBe('#8b5cf6');
        });
    });

    describe('spacing', () => {
        it('deve ter espaçamentos definidos', () => {
            expect(spacing.xs).toBe(4);
            expect(spacing.sm).toBe(8);
            expect(spacing.md).toBe(12);
            expect(spacing.lg).toBe(16);
            expect(spacing.xl).toBe(20);
            expect(spacing['2xl']).toBe(24);
            expect(spacing['3xl']).toBe(32);
            expect(spacing['4xl']).toBe(40);
            expect(spacing['5xl']).toBe(48);
            expect(spacing['6xl']).toBe(64);
        });
    });

    describe('borderRadius', () => {
        it('deve ter border radius definidos', () => {
            expect(borderRadius.sm).toBe(8);
            expect(borderRadius.md).toBe(10);
            expect(borderRadius.lg).toBe(12);
            expect(borderRadius.xl).toBe(16);
            expect(borderRadius.full).toBe(9999);
        });
    });

    describe('typography', () => {
        it('deve ter font families', () => {
            expect(typography.fontDisplay).toBe('Viga');
            expect(typography.fontSans).toBe('NunitoSans-Regular');
            expect(typography.fontSansBold).toBe('NunitoSans-Bold');
        });

        it('deve ter font sizes', () => {
            expect(typography.fontSize.xs).toBe(12);
            expect(typography.fontSize.base).toBe(16);
            expect(typography.fontSize['4xl']).toBe(36);
        });

        it('deve ter line heights', () => {
            expect(typography.lineHeight.tight).toBe(1.2);
            expect(typography.lineHeight.normal).toBe(1.5);
            expect(typography.lineHeight.relaxed).toBe(1.75);
        });
    });

    describe('shadows', () => {
        it('deve ter sombra sm', () => {
            expect(shadows.sm.shadowColor).toBe('#000');
            expect(shadows.sm.elevation).toBe(1);
        });

        it('deve ter sombra md', () => {
            expect(shadows.md.elevation).toBe(3);
        });

        it('deve ter sombra lg', () => {
            expect(shadows.lg.elevation).toBe(5);
        });
    });

    describe('layout', () => {
        it('deve ter configurações de container', () => {
            expect(layout.container.mobile).toBe('100%');
            expect(layout.container.desktop).toBe(1280);
        });

        it('deve ter largura da sidebar', () => {
            expect(layout.sidebar.width).toBe(264);
        });
    });

    describe('theme object', () => {
        it('deve exportar objeto theme completo', () => {
            expect(theme.colors).toBe(colors);
            expect(theme.spacing).toBe(spacing);
            expect(theme.borderRadius).toBe(borderRadius);
            expect(theme.typography).toBe(typography);
            expect(theme.shadows).toBe(shadows);
            expect(theme.layout).toBe(layout);
        });
    });
});
