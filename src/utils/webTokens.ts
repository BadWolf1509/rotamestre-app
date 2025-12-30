import { boxShadow, dropShadow } from '@/utils/color';
import { defaultTheme } from '@/utils/styles.base';

/**
 * CSS animation for map InfoWindows.
 */
export const INFO_WINDOW_ANIMATION_CSS = `
  @keyframes infoWindowFadeIn {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

/**
 * Semantic colors for InfoWindows (web).
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

export const MAP_WEB_SHADOWS = {
  markerHover: boxShadow(0, 4, 12, 0, defaultTheme.colors.black, 0.35),
  markerDefault: boxShadow(0, 3, 8, 0, defaultTheme.colors.black, 0.25),
  checkpoint: dropShadow(0, 2, 4, defaultTheme.colors.black, 0.25),
  checkpointHover: dropShadow(0, 4, 8, defaultTheme.colors.black, 0.3),
  motorista: dropShadow(0, 3, 6, defaultTheme.colors.black, 0.3),
  motoristaHover: dropShadow(0, 4, 10, defaultTheme.colors.black, 0.4),
  legend: boxShadow(0, 2, 8, 0, defaultTheme.colors.black, 0.08),
} as const;
