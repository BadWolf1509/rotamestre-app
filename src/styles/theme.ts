/**
 * Legacy Theme Wrapper
 * Keeps the old theme shape but derives values from defaultTheme.
 */

import { defaultTheme } from '@/utils/styles.base';

// ===== COLORS =====
export const colors = defaultTheme.colors;

// ===== SPACING =====
export const spacing = defaultTheme.spacing;

// ===== BORDER RADIUS =====
export const borderRadius = {
  sm: defaultTheme.borderRadius.sm,
  md: defaultTheme.borderRadius.md,
  lg: defaultTheme.borderRadius.lg,
  xl: defaultTheme.borderRadius.xl,
  full: defaultTheme.borderRadius.full,
};

// ===== TYPOGRAPHY =====
export const typography = {
  ...defaultTheme.typography,
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

// ===== SHADOWS =====
export const shadows = {
  sm: defaultTheme.shadows.sm,
  md: defaultTheme.shadows.md,
  lg: defaultTheme.shadows.lg,
};

// ===== LAYOUT =====
export const layout = {
  container: {
    mobile: '100%',
    tablet: '100%',
    desktop: defaultTheme.layout.containerMaxWidth,
  },
  sidebar: {
    width: defaultTheme.layout.sidebarWidth,
  },
};

// Export default theme object
export const theme = {
  colors,
  spacing,
  borderRadius,
  typography,
  shadows,
  layout,
};

export default theme;
