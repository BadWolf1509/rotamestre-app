/**
 * Sistema de Design Tokens - Rota Mestre
 * Cores, espaçamentos, tipografia e utilitários de estilo
 */

// ===== CORES =====
export const colors = {
  // Primary (Azul)
  primary: '#284093',
  primaryDark: '#1b2c63',
  primaryLight: '#34699f',
  primaryBg: '#e6ecfb',

  // Secondary (Laranja)
  secondary: '#f7a02a',
  secondaryDark: '#c87704',
  secondaryLight: '#ffbf14',
  secondaryBg: '#fff3d6',

  // Feedback
  success: '#10b981',
  successBg: '#d1fae5',
  warning: '#f59e0b',
  warningBg: '#fef3c7',
  error: '#ef4444',
  errorBg: '#fee2e2',
  info: '#3b82f6',
  infoBg: '#dbeafe',

  // Grays
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',

  // Special
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',

  // Purple (usado nos stats)
  purple: '#8b5cf6',
};

// ===== ESPAÇAMENTOS =====
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
};

// ===== BORDER RADIUS =====
export const borderRadius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  full: 9999,
};

// ===== TIPOGRAFIA =====
export const typography = {
  // Font Families
  fontDisplay: 'Viga',
  fontSans: 'NunitoSans-Regular',
  fontSansLight: 'NunitoSans-Light',
  fontSansMedium: 'NunitoSans-Medium',
  fontSansSemiBold: 'NunitoSans-SemiBold',
  fontSansBold: 'NunitoSans-Bold',
  fontSansExtraBold: 'NunitoSans-ExtraBold',

  // Font Sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },

  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

// ===== SOMBRAS =====
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
};

// ===== UTILITÁRIOS DE LAYOUT =====
export const layout = {
  container: {
    mobile: '100%',
    tablet: '100%',
    desktop: 1280,
  },
  sidebar: {
    width: 264,
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
