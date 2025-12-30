import {
  darkHighContrastTheme,
  darkTheme,
  defaultTheme,
  lightHighContrastTheme,
} from '@/utils/styles.base';

import {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  opacity,
  motion,
  transitions,
  zIndex,
  icons,
  getBadgeColor,
  getStatusColor,
  getStatusIcon,
} from '../design-tokens';

const toLinear = (value: number) => {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const parseHex = (hex: string) => {
  const raw = hex.replace('#', '');
  const normalized = raw.length === 3
    ? raw.split('').map((value) => `${value}${value}`).join('')
    : raw;
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return { red, green, blue };
};

const contrastRatio = (foreground: string, background: string) => {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  const fgLum = 0.2126 * toLinear(fg.red) + 0.7152 * toLinear(fg.green) + 0.0722 * toLinear(fg.blue);
  const bgLum = 0.2126 * toLinear(bg.red) + 0.7152 * toLinear(bg.green) + 0.0722 * toLinear(bg.blue);
  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);
  return (lighter + 0.05) / (darker + 0.05);
};

describe('Design Tokens', () => {
  describe('Colors', () => {
    it('has primary colors', () => {
      expect(colors.primary.main).toBe('#284093');
      expect(colors.primary.dark).toBe('#1b2c63');
      expect(colors.primary.light).toBe('#34699f');
    });

    it('has secondary colors', () => {
      expect(colors.secondary.main).toBe('#f7a02a');
      expect(colors.secondary.dark).toBe('#c87704');
      expect(colors.secondary.light).toBe('#ffbf14');
    });

    it('has semantic colors', () => {
      expect(colors.success).toBe('#10b981');
      expect(colors.warning).toBe('#f59e0b');
      expect(colors.error).toBe('#ef4444');
      expect(colors.info).toBe('#3b82f6');
    });

    it('has gray scale', () => {
      expect(colors.gray[50]).toBe('#f9fafb');
      expect(colors.gray[100]).toBe('#f3f4f6');
      expect(colors.gray[900]).toBe('#111827');
    });

    it('has text colors', () => {
      expect(colors.text.primary).toBe('#1f2937');
      expect(colors.text.secondary).toBe('#6b7280');
      expect(colors.text.inverse).toBe('#ffffff');
      expect(colors.text.link).toBe('#284093');
    });
  });

  describe('Typography', () => {
    it('has font families', () => {
      expect(typography.fontFamily.display).toBe('Viga');
      expect(typography.fontFamily.body).toBe('NunitoSans-Regular');
    });

    it('has font sizes', () => {
      expect(typography.fontSize['5xl']).toBe(40);
      expect(typography.fontSize['4xl']).toBe(36);
      expect(typography.fontSize.md).toBe(16);
      expect(typography.fontSize.xs).toBe(12);
    });

    it('has font weights', () => {
      expect(typography.fontWeight.regular).toBe('400');
      expect(typography.fontWeight.semibold).toBe('600');
      expect(typography.fontWeight.bold).toBe('700');
    });

    it('has preset styles', () => {
      expect(typography.styles.h1.fontFamily).toBe('Viga');
      expect(typography.styles.h1.fontSize).toBe(30);
      expect(typography.styles.body.fontSize).toBe(14);
      expect(typography.styles.button.fontWeight).toBe('600');
    });
  });

  describe('Spacing', () => {
    it('follows 4-point grid', () => {
      expect(spacing.xs).toBe(4);
      expect(spacing.sm).toBe(8);
      expect(spacing.md).toBe(12);
      expect(spacing.lg).toBe(16);
      expect(spacing.xl).toBe(20);
    });

    it('has extended spacing', () => {
      expect(spacing['2xl']).toBe(24);
      expect(spacing['3xl']).toBe(32);
    });
  });

  describe('Border Radius', () => {
    it('has radius values', () => {
      expect(borderRadius.sm).toBe(8);
      expect(borderRadius.md).toBe(10);
      expect(borderRadius.lg).toBe(12);
      expect(borderRadius.xl).toBe(16);
    });

    it('has full radius', () => {
      expect(borderRadius.full).toBe(9999);
    });
  });

  describe('Shadows', () => {
    it('has card shadow', () => {
      expect(shadows.card.shadowColor).toBe('#000');
      expect(shadows.card.shadowOffset).toEqual({ width: 0, height: 2 });
      expect(shadows.card.elevation).toBe(2);
    });

    it('has modal shadow', () => {
      expect(shadows.modal.shadowColor).toBe('#000');
      expect(shadows.modal.shadowOffset).toEqual({ width: 0, height: 4 });
      expect(shadows.modal.elevation).toBe(5);
    });

    it('has no shadow option', () => {
      expect(shadows.none.shadowOpacity).toBe(0);
      expect(shadows.none.elevation).toBe(0);
    });
  });

  describe('Opacity', () => {
    it('has opacity values', () => {
      expect(opacity[10]).toBe(0.1);
      expect(opacity[25]).toBe(0.25);
      expect(opacity[50]).toBe(0.5);
      expect(opacity[75]).toBe(0.75);
      expect(opacity[90]).toBe(0.9);
    });
  });

  describe('Motion', () => {
    it('has motion durations', () => {
      expect(motion.duration.fast).toBe(150);
      expect(motion.duration.normal).toBe(250);
      expect(motion.duration.slow).toBe(350);
    });

    it('has motion easing', () => {
      expect(motion.easing.easeOut).toBe('cubic-bezier(0, 0, 0.2, 1)');
      expect(motion.easing.easeIn).toBe('cubic-bezier(0.4, 0, 1, 1)');
      expect(motion.easing.easeInOut).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
    });
  });

  describe('Transitions', () => {
    it('has durations', () => {
      expect(transitions.duration.fast).toBe(150);
      expect(transitions.duration.normal).toBe(250);
      expect(transitions.duration.slow).toBe(350);
    });

    it('has easing functions', () => {
      expect(transitions.easing.easeOut).toBe('cubic-bezier(0, 0, 0.2, 1)');
      expect(transitions.easing.easeIn).toBe('cubic-bezier(0.4, 0, 1, 1)');
      expect(transitions.easing.easeInOut).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
    });
  });

  describe('Z-Index', () => {
    it('has z-index layers', () => {
      expect(zIndex.base).toBe(0);
      expect(zIndex.header).toBe(10);
      expect(zIndex.dropdown).toBe(20);
      expect(zIndex.modal).toBe(30);
      expect(zIndex.toast).toBe(40);
      expect(zIndex.tooltip).toBe(50);
      expect(zIndex.max).toBe(9999);
    });

    it('has ascending z-index order', () => {
      expect(zIndex.header).toBeLessThan(zIndex.dropdown);
      expect(zIndex.dropdown).toBeLessThan(zIndex.modal);
      expect(zIndex.modal).toBeLessThan(zIndex.toast);
      expect(zIndex.toast).toBeLessThan(zIndex.tooltip);
    });
  });

  describe('Icons', () => {
    it('has icon sizes', () => {
      expect(icons.size.sm).toBe(16);
      expect(icons.size.md).toBe(20);
      expect(icons.size.lg).toBe(24);
      expect(icons.size.xl).toBe(32);
    });

    it('uses spacing for icon/text gaps', () => {
      expect(icons.spacing).toBe(spacing.sm);
      expect(icons.spacing).toBe(8);
    });
  });

  describe('getBadgeColor', () => {
    it('returns colors for pending', () => {
      const result = getBadgeColor('pendente');
      expect(result.background).toBe('#fef3c7');
      expect(result.text).toBe(colors.warning);
    });

    it('returns colors for in progress', () => {
      const result = getBadgeColor('em_andamento');
      expect(result.background).toBe('#dbeafe');
      expect(result.text).toBe(colors.info);
    });

    it('returns colors for completed', () => {
      const result = getBadgeColor('concluida');
      expect(result.background).toBe('#d1fae5');
      expect(result.text).toBe(colors.success);
    });

    it('returns colors for canceled', () => {
      const result = getBadgeColor('cancelada');
      expect(result.background).toBe('#fee2e2');
      expect(result.text).toBe(colors.error);
    });

    it('returns defaults for invalid status', () => {
      // @ts-expect-error - Testing invalid status
      const result = getBadgeColor('invalido');
      expect(result.background).toBe(colors.gray[100]);
      expect(result.text).toBe(colors.gray[600]);
    });
  });

  describe('getStatusColor', () => {
    it('returns color for pending', () => {
      expect(getStatusColor('pendente')).toBe(colors.warning);
    });

    it('returns color for in progress', () => {
      expect(getStatusColor('em_andamento')).toBe(colors.info);
    });

    it('returns color for completed', () => {
      expect(getStatusColor('concluida')).toBe(colors.success);
    });

    it('returns color for canceled', () => {
      expect(getStatusColor('cancelada')).toBe(colors.error);
    });

    it('returns default for invalid status', () => {
      // @ts-expect-error - Testing invalid status
      expect(getStatusColor('invalido')).toBe(colors.gray[500]);
    });
  });

  describe('getStatusIcon', () => {
    it('returns icon for pending', () => {
      expect(getStatusIcon('pendente')).toBe('time-outline');
    });

    it('returns icon for in progress', () => {
      expect(getStatusIcon('em_andamento')).toBe('play-circle');
    });

    it('returns icon for completed', () => {
      expect(getStatusIcon('concluida')).toBe('checkmark-circle');
    });

    it('returns icon for canceled', () => {
      expect(getStatusIcon('cancelada')).toBe('close-circle');
    });

    it('returns default icon for invalid status', () => {
      // @ts-expect-error - Testing invalid status
      expect(getStatusIcon('invalido')).toBe('ellipse-outline');
    });
  });

  describe('Token consistency', () => {
    it('aligns text colors with gray scale', () => {
      expect(colors.text.primary).toBe(colors.gray[800]);
      expect(colors.text.secondary).toBe(colors.gray[500]);
      expect(colors.text.tertiary).toBe(colors.gray[400]);
      expect(colors.text.disabled).toBe(colors.gray[300]);
    });

    it('aligns link color with primary', () => {
      expect(colors.text.link).toBe(colors.primary.main);
    });
  });

  describe('Accessibility', () => {
    it('meets contrast ratio for default themes', () => {
      const lightRatio = contrastRatio(defaultTheme.colors.text, defaultTheme.colors.background);
      const darkRatio = contrastRatio(darkTheme.colors.text, darkTheme.colors.background);
      expect(lightRatio).toBeGreaterThanOrEqual(4.5);
      expect(darkRatio).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps high contrast themes above default contrast', () => {
      const baseLight = contrastRatio(defaultTheme.colors.text, defaultTheme.colors.background);
      const highLight = contrastRatio(
        lightHighContrastTheme.colors.text,
        lightHighContrastTheme.colors.background
      );
      const baseDark = contrastRatio(darkTheme.colors.text, darkTheme.colors.background);
      const highDark = contrastRatio(
        darkHighContrastTheme.colors.text,
        darkHighContrastTheme.colors.background
      );
      expect(highLight).toBeGreaterThanOrEqual(baseLight);
      expect(highDark).toBeGreaterThanOrEqual(baseDark);
    });
  });
});
