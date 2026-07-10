import { defaultTheme } from '@/utils/styles.base';

/**
 * Semantic colors for map status helpers (web).
 */
export const INFO_WINDOW_COLORS = {
  text: {
    primary: defaultTheme.colors.text,
    secondary: defaultTheme.colors.textSecondary,
    link: defaultTheme.colors.primary,
  },
  background: {
    surface: defaultTheme.colors.gray50,
    border: defaultTheme.colors.gray200,
    info: defaultTheme.colors.infoBg,
  },
  brand: {
    primary: defaultTheme.colors.primary,
    primaryDark: defaultTheme.colors.primaryDark,
  },
  status: {
    success: defaultTheme.colors.success,
    info: defaultTheme.colors.info,
    warning: defaultTheme.colors.warning,
    error: defaultTheme.colors.error,
    muted: defaultTheme.colors.gray500,
  },
} as const;
