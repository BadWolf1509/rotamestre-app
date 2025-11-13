/**
 * React Native Unistyles v3 Configuration
 * Sistema de design responsivo para Rota Mestre
 */

import { StyleSheet } from 'react-native-unistyles';

// ===== BREAKPOINTS =====
export const breakpoints = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

// ===== THEME =====
export const lightTheme = {
  colors: {
    primary: '#284093',
    primaryDark: '#1b2c63',
    primaryLight: '#34699f',
    primaryBg: '#e6ecfb',
    secondary: '#f7a02a',
    secondaryDark: '#c87704',
    secondaryLight: '#ffbf14',
    secondaryBg: '#fff3d6',
    success: '#10b981',
    successBg: '#d1fae5',
    warning: '#f59e0b',
    warningBg: '#fef3c7',
    error: '#ef4444',
    errorBg: '#fee2e2',
    info: '#3b82f6',
    infoBg: '#dbeafe',
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
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',
    purple: '#8b5cf6',
  },
  spacing: {
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
  },
  borderRadius: {
    sm: 8,
    md: 10,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  typography: {
    fontDisplay: 'Viga',
    fontSans: 'NunitoSans-Regular',
    fontSansLight: 'NunitoSans-Light',
    fontSansMedium: 'NunitoSans-Medium',
    fontSansSemiBold: 'NunitoSans-SemiBold',
    fontSansBold: 'NunitoSans-Bold',
    fontSansExtraBold: 'NunitoSans-ExtraBold',
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
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  shadows: {
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
  },
  layout: {
    sidebarWidth: 264,
    containerMaxWidth: 1280,
  },
} as const;

// ===== TYPES =====
type AppBreakpoints = typeof breakpoints;
type AppThemes = {
  light: typeof lightTheme;
};

// Augment TypeScript types
declare module 'react-native-unistyles' {
  export interface UnistylesBreakpoints extends AppBreakpoints {}
  export interface UnistylesThemes extends AppThemes {}
}

// ===== CONFIGURE =====
StyleSheet.configure({
  settings: {
    adaptiveThemes: false,
  },
  themes: {
    light: lightTheme,
  },
  breakpoints,
});
