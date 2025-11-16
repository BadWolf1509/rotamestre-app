import {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  opacity,
  transitions,
  zIndex,
  icons,
  getBadgeColor,
  getStatusColor,
  getStatusIcon,
} from '../design-tokens';

describe('Design Tokens', () => {
  describe('Colors', () => {
    it('deve ter cores primárias definidas', () => {
      expect(colors.primary.main).toBe('#284093');
      expect(colors.primary.dark).toBe('#1b2c63');
      expect(colors.primary.light).toBe('#34699f');
    });

    it('deve ter cores secundárias definidas', () => {
      expect(colors.secondary.main).toBe('#f7a02a');
      expect(colors.secondary.dark).toBe('#c87704');
      expect(colors.secondary.light).toBe('#ffbf14');
    });

    it('deve ter cores semânticas definidas', () => {
      expect(colors.success).toBe('#10b981');
      expect(colors.warning).toBe('#f59e0b');
      expect(colors.error).toBe('#ef4444');
      expect(colors.info).toBe('#3b82f6');
    });

    it('deve ter escala de cinzas completa', () => {
      expect(colors.gray[50]).toBe('#f9fafb');
      expect(colors.gray[100]).toBe('#f3f4f6');
      expect(colors.gray[900]).toBe('#111827');
    });

    it('deve ter cores de texto definidas', () => {
      expect(colors.text.primary).toBe('#111827');
      expect(colors.text.secondary).toBe('#6b7280');
      expect(colors.text.inverse).toBe('#ffffff');
      expect(colors.text.link).toBe('#284093');
    });
  });

  describe('Typography', () => {
    it('deve ter famílias de fonte definidas', () => {
      expect(typography.fontFamily.display).toBe('Viga');
      expect(typography.fontFamily.body).toBe('Nunito Sans');
    });

    it('deve ter tamanhos de fonte definidos', () => {
      expect(typography.fontSize['5xl']).toBe(36);
      expect(typography.fontSize['4xl']).toBe(32);
      expect(typography.fontSize.md).toBe(16);
      expect(typography.fontSize.xs).toBe(12);
    });

    it('deve ter pesos de fonte definidos', () => {
      expect(typography.fontWeight.regular).toBe('400');
      expect(typography.fontWeight.semibold).toBe('600');
      expect(typography.fontWeight.bold).toBe('700');
    });

    it('deve ter estilos pré-definidos', () => {
      expect(typography.styles.h1.fontFamily).toBe('Viga');
      expect(typography.styles.h1.fontSize).toBe(28);
      expect(typography.styles.body.fontSize).toBe(14);
      expect(typography.styles.button.fontWeight).toBe('600');
    });
  });

  describe('Spacing', () => {
    it('deve seguir sistema de 4-point grid', () => {
      expect(spacing.xs).toBe(4);
      expect(spacing.sm).toBe(8);
      expect(spacing.md).toBe(16);
      expect(spacing.lg).toBe(24);
      expect(spacing.xl).toBe(32);
    });

    it('deve ter espaçamentos extras definidos', () => {
      expect(spacing['2xl']).toBe(40);
      expect(spacing['3xl']).toBe(48);
    });
  });

  describe('Border Radius', () => {
    it('deve ter valores de border radius definidos', () => {
      expect(borderRadius.sm).toBe(6);
      expect(borderRadius.md).toBe(8);
      expect(borderRadius.lg).toBe(12);
      expect(borderRadius.xl).toBe(16);
    });

    it('deve ter border radius circular', () => {
      expect(borderRadius.full).toBe(9999);
    });
  });

  describe('Shadows', () => {
    it('deve ter sombra para cards', () => {
      expect(shadows.card.shadowColor).toBe('#000');
      expect(shadows.card.shadowOffset).toEqual({ width: 0, height: 2 });
      expect(shadows.card.elevation).toBe(3);
    });

    it('deve ter sombra para modals', () => {
      expect(shadows.modal.shadowColor).toBe('#000');
      expect(shadows.modal.shadowOffset).toEqual({ width: 0, height: 4 });
      expect(shadows.modal.elevation).toBe(5);
    });

    it('deve ter opção sem sombra', () => {
      expect(shadows.none.shadowOpacity).toBe(0);
      expect(shadows.none.elevation).toBe(0);
    });
  });

  describe('Opacity', () => {
    it('deve ter valores de opacidade definidos', () => {
      expect(opacity[10]).toBe(0.1);
      expect(opacity[25]).toBe(0.25);
      expect(opacity[50]).toBe(0.5);
      expect(opacity[75]).toBe(0.75);
      expect(opacity[90]).toBe(0.9);
    });
  });

  describe('Transitions', () => {
    it('deve ter durações definidas', () => {
      expect(transitions.duration.fast).toBe(150);
      expect(transitions.duration.normal).toBe(250);
      expect(transitions.duration.slow).toBe(350);
    });

    it('deve ter easing functions definidas', () => {
      expect(transitions.easing.easeOut).toBe('cubic-bezier(0, 0, 0.2, 1)');
      expect(transitions.easing.easeIn).toBe('cubic-bezier(0.4, 0, 1, 1)');
      expect(transitions.easing.easeInOut).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
    });
  });

  describe('Z-Index', () => {
    it('deve ter camadas de z-index definidas', () => {
      expect(zIndex.base).toBe(0);
      expect(zIndex.header).toBe(10);
      expect(zIndex.dropdown).toBe(20);
      expect(zIndex.modal).toBe(30);
      expect(zIndex.toast).toBe(40);
      expect(zIndex.tooltip).toBe(50);
      expect(zIndex.max).toBe(9999);
    });

    it('deve ter z-index em ordem crescente', () => {
      expect(zIndex.header).toBeLessThan(zIndex.dropdown);
      expect(zIndex.dropdown).toBeLessThan(zIndex.modal);
      expect(zIndex.modal).toBeLessThan(zIndex.toast);
      expect(zIndex.toast).toBeLessThan(zIndex.tooltip);
    });
  });

  describe('Icons', () => {
    it('deve ter tamanhos de ícones definidos', () => {
      expect(icons.size.sm).toBe(16);
      expect(icons.size.md).toBe(20);
      expect(icons.size.lg).toBe(24);
      expect(icons.size.xl).toBe(32);
    });

    it('deve ter espaçamento padrão com texto', () => {
      expect(icons.spacing).toBe(spacing.sm);
      expect(icons.spacing).toBe(8);
    });
  });

  describe('getBadgeColor', () => {
    it('deve retornar cores para status pendente', () => {
      const result = getBadgeColor('pendente');
      expect(result.background).toBe('#FEF3C7');
      expect(result.text).toBe(colors.warning);
    });

    it('deve retornar cores para status em andamento', () => {
      const result = getBadgeColor('em_andamento');
      expect(result.background).toBe('#DBEAFE');
      expect(result.text).toBe(colors.info);
    });

    it('deve retornar cores para status concluída', () => {
      const result = getBadgeColor('concluida');
      expect(result.background).toBe('#D1FAE5');
      expect(result.text).toBe(colors.success);
    });

    it('deve retornar cores para status cancelada', () => {
      const result = getBadgeColor('cancelada');
      expect(result.background).toBe('#FEE2E2');
      expect(result.text).toBe(colors.error);
    });

    it('deve retornar cores padrão para status inválido', () => {
      // @ts-expect-error - Testing invalid status
      const result = getBadgeColor('invalido');
      expect(result.background).toBe(colors.gray[100]);
      expect(result.text).toBe(colors.gray[600]);
    });
  });

  describe('getStatusColor', () => {
    it('deve retornar cor para status pendente', () => {
      expect(getStatusColor('pendente')).toBe(colors.warning);
    });

    it('deve retornar cor para status em andamento', () => {
      expect(getStatusColor('em_andamento')).toBe(colors.info);
    });

    it('deve retornar cor para status concluída', () => {
      expect(getStatusColor('concluida')).toBe(colors.success);
    });

    it('deve retornar cor para status cancelada', () => {
      expect(getStatusColor('cancelada')).toBe(colors.error);
    });

    it('deve retornar cor padrão para status inválido', () => {
      // @ts-expect-error - Testing invalid status
      expect(getStatusColor('invalido')).toBe(colors.gray[500]);
    });
  });

  describe('getStatusIcon', () => {
    it('deve retornar ícone para status pendente', () => {
      expect(getStatusIcon('pendente')).toBe('time-outline');
    });

    it('deve retornar ícone para status em andamento', () => {
      expect(getStatusIcon('em_andamento')).toBe('play-circle');
    });

    it('deve retornar ícone para status concluída', () => {
      expect(getStatusIcon('concluida')).toBe('checkmark-circle');
    });

    it('deve retornar ícone para status cancelada', () => {
      expect(getStatusIcon('cancelada')).toBe('close-circle');
    });

    it('deve retornar ícone padrão para status inválido', () => {
      // @ts-expect-error - Testing invalid status
      expect(getStatusIcon('invalido')).toBe('ellipse-outline');
    });
  });

  describe('Consistência entre tokens', () => {
    it('deve ter cores de texto consistentes com escala de cinzas', () => {
      expect(colors.text.primary).toBe(colors.gray[900]);
      expect(colors.text.secondary).toBe(colors.gray[500]);
      expect(colors.text.tertiary).toBe(colors.gray[400]);
      expect(colors.text.disabled).toBe(colors.gray[300]);
    });

    it('deve ter cor de link consistente com cor primária', () => {
      expect(colors.text.link).toBe(colors.primary.main);
    });
  });
});
