/**
 * Design Tokens - RotaMestre
 * Derived from defaultTheme to keep a single source of truth.
 */

import { withOpacity } from '@/utils/color';
import { defaultTheme } from '@/utils/styles.base';

// ============================================
// 1. COLORS
// ============================================

export const colors = {
  primary: {
    main: defaultTheme.colors.primary,
    dark: defaultTheme.colors.primaryDark,
    light: defaultTheme.colors.primaryLight,
  },
  secondary: {
    main: defaultTheme.colors.secondary,
    dark: defaultTheme.colors.secondaryDark,
    light: defaultTheme.colors.secondaryLight,
    accent: defaultTheme.colors.accent,
  },
  kpi: {
    totalHoje: defaultTheme.colors.kpiTotalHoje,
    emAndamento: defaultTheme.colors.kpiEmAndamento,
    concluidas: defaultTheme.colors.kpiConcluidas,
    distancia: defaultTheme.colors.kpiDistancia,
    incidentes: defaultTheme.colors.kpiIncidentes,
  },
  success: defaultTheme.colors.success,
  warning: defaultTheme.colors.warning,
  error: defaultTheme.colors.error,
  info: defaultTheme.colors.info,
  gray: {
    50: defaultTheme.colors.gray50,
    100: defaultTheme.colors.gray100,
    200: defaultTheme.colors.gray200,
    300: defaultTheme.colors.gray300,
    400: defaultTheme.colors.gray400,
    500: defaultTheme.colors.gray500,
    600: defaultTheme.colors.gray600,
    700: defaultTheme.colors.gray700,
    800: defaultTheme.colors.gray800,
    900: defaultTheme.colors.gray900,
  },
  background: {
    primary: defaultTheme.colors.surface,
    secondary: defaultTheme.colors.background,
    tertiary: defaultTheme.colors.gray100,
  },
  border: {
    light: defaultTheme.colors.border,
    medium: defaultTheme.colors.gray300,
    dark: defaultTheme.colors.gray400,
  },
  overlay: {
    light: withOpacity(defaultTheme.colors.black, 0.1),
    medium: defaultTheme.colors.overlay,
    dark: withOpacity(defaultTheme.colors.black, 0.8),
  },
  text: {
    primary: defaultTheme.colors.text,
    secondary: defaultTheme.colors.textSecondary,
    tertiary: defaultTheme.colors.textTertiary,
    disabled: defaultTheme.colors.disabled,
    inverse: defaultTheme.colors.textInverse,
    link: defaultTheme.colors.primary,
  },
  incident: {
    accident: defaultTheme.colors.incident.accident,
    absent: defaultTheme.colors.incident.absent,
    wrongAddress: defaultTheme.colors.incident.wrongAddress,
    blocked: defaultTheme.colors.incident.blocked,
    vehicle: defaultTheme.colors.incident.vehicle,
    weather: defaultTheme.colors.incident.weather,
    other: defaultTheme.colors.incident.other,
  },
  social: {
    whatsapp: defaultTheme.colors.whatsapp,
  },
  white: defaultTheme.colors.white,
  black: defaultTheme.colors.black,
} as const;

// ============================================
// 2. TYPOGRAPHY
// ============================================

export const typography = {
  fontFamily: {
    display: defaultTheme.typography.fontDisplay,
    body: defaultTheme.typography.fontSans,
    regular: defaultTheme.typography.fontSans,
    medium: defaultTheme.typography.fontSansMedium,
    semibold: defaultTheme.typography.fontSansSemiBold,
    bold: defaultTheme.typography.fontSansBold,
    extrabold: defaultTheme.typography.fontSansExtraBold,
  },
  fontSize: {
    xs: defaultTheme.typography.fontSize.xs,
    sm: defaultTheme.typography.fontSize.sm,
    md: defaultTheme.typography.fontSize.base,
    lg: defaultTheme.typography.fontSize.lg,
    xl: defaultTheme.typography.fontSize.xl,
    '2xl': defaultTheme.typography.fontSize['2xl'],
    '3xl': defaultTheme.typography.fontSize['3xl'],
    '4xl': defaultTheme.typography.fontSize['4xl'],
    '5xl': defaultTheme.typography.fontSize['4xl'] + 4,
  },
  fontWeight: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  styles: {
    h1: {
      fontFamily: defaultTheme.typography.fontDisplay,
      fontSize: defaultTheme.typography.fontSize['3xl'],
      fontWeight: '400' as const,
      lineHeight: 36,
      color: colors.text.primary,
    },
    h2: {
      fontFamily: defaultTheme.typography.fontSans,
      fontSize: defaultTheme.typography.fontSize.xl,
      fontWeight: '700' as const,
      lineHeight: 28,
      color: colors.text.primary,
    },
    h3: {
      fontFamily: defaultTheme.typography.fontSans,
      fontSize: defaultTheme.typography.fontSize.base,
      fontWeight: '600' as const,
      lineHeight: 24,
      color: colors.text.primary,
    },
    body: {
      fontFamily: defaultTheme.typography.fontSans,
      fontSize: defaultTheme.typography.fontSize.sm,
      fontWeight: '400' as const,
      lineHeight: 20,
      color: colors.text.secondary,
    },
    caption: {
      fontFamily: defaultTheme.typography.fontSans,
      fontSize: defaultTheme.typography.fontSize.xs,
      fontWeight: '400' as const,
      lineHeight: 16,
      color: colors.text.tertiary,
    },
    button: {
      fontFamily: defaultTheme.typography.fontSans,
      fontSize: defaultTheme.typography.fontSize.base,
      fontWeight: '600' as const,
      lineHeight: 24,
    },
  },
} as const;

// ============================================
// 3. SPACING (4-point grid)
// ============================================

export const spacing = {
  xs: defaultTheme.spacing.xs,
  sm: defaultTheme.spacing.sm,
  md: defaultTheme.spacing.md,
  lg: defaultTheme.spacing.lg,
  xl: defaultTheme.spacing.xl,
  xxl: defaultTheme.spacing.xxl,
  '2xl': defaultTheme.spacing['2xl'],
  '3xl': defaultTheme.spacing['3xl'],
  '4xl': defaultTheme.spacing['4xl'],
  '5xl': defaultTheme.spacing['5xl'],
  '6xl': defaultTheme.spacing['6xl'],
} as const;

// ============================================
// 4. BORDER RADIUS
// ============================================

export const borderRadius = {
  xs: defaultTheme.borderRadius.xs,
  sm: defaultTheme.borderRadius.sm,
  md: defaultTheme.borderRadius.md,
  lg: defaultTheme.borderRadius.lg,
  xl: defaultTheme.borderRadius.xl,
  full: defaultTheme.borderRadius.full,
} as const;

// ============================================
// 5. SHADOWS
// ============================================

export const shadows = {
  sm: defaultTheme.shadows.sm,
  md: defaultTheme.shadows.md,
  lg: defaultTheme.shadows.lg,
  card: defaultTheme.shadows.card,
  modal: defaultTheme.shadows.lg,
  floating: defaultTheme.shadows.lg,
  none: {
    shadowColor: defaultTheme.colors.transparent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
} as const;

// ============================================
// 6. OPACITY
// ============================================

export const opacity = {
  10: 0.1,
  25: 0.25,
  50: 0.5,
  75: 0.75,
  90: 0.9,
} as const;

// ============================================
// 7. MOTION
// ============================================

export const motion = defaultTheme.motion;

// ============================================
// 8. TRANSITIONS
// ============================================

export const transitions = {
  duration: defaultTheme.motion.duration,
  easing: defaultTheme.motion.easing,
} as const;

// ============================================
// 9. Z-INDEX
// ============================================

export const zIndex = {
  base: 0,
  header: 10,
  dropdown: 20,
  modal: 30,
  toast: 40,
  tooltip: 50,
  max: 9999,
} as const;

// ============================================
// 10. ICONS
// ============================================

export const icons = {
  size: {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
  },
  spacing: spacing.sm,
} as const;

// ============================================
// 11. COMPONENTS
// ============================================

export const components = {
  button: defaultTheme.components.button,
  input: defaultTheme.components.input,
  modal: defaultTheme.components.modal,
} as const;

// ============================================
// 12. UTILITIES
// ============================================

export function getBadgeColor(
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'
): { background: string; text: string } {
  switch (status) {
    case 'pendente':
      return {
        background: defaultTheme.colors.warningBg,
        text: colors.warning,
      };
    case 'em_andamento':
      return {
        background: defaultTheme.colors.infoBg,
        text: colors.info,
      };
    case 'concluida':
      return {
        background: defaultTheme.colors.successBg,
        text: colors.success,
      };
    case 'cancelada':
      return {
        background: defaultTheme.colors.errorBg,
        text: colors.error,
      };
    default:
      return {
        background: colors.gray[100],
        text: colors.gray[600],
      };
  }
}

export function getStatusColor(
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'
): string {
  switch (status) {
    case 'pendente':
      return colors.warning;
    case 'em_andamento':
      return colors.info;
    case 'concluida':
      return colors.success;
    case 'cancelada':
      return colors.error;
    default:
      return colors.gray[500];
  }
}

export function getStatusIcon(
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'
): string {
  switch (status) {
    case 'pendente':
      return 'time-outline';
    case 'em_andamento':
      return 'play-circle';
    case 'concluida':
      return 'checkmark-circle';
    case 'cancelada':
      return 'close-circle';
    default:
      return 'ellipse-outline';
  }
}

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
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
  components,
  getBadgeColor,
  getStatusColor,
  getStatusIcon,
};
