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
    // Primary colors
    primary: '#284093',
    primaryDark: '#1b2c63',
    primaryLight: '#34699f',
    primaryBg: '#e6ecfb',
    // Secondary colors
    secondary: '#f7a02a',
    secondaryDark: '#c87704',
    secondaryLight: '#ffbf14',
    secondaryBg: '#fff3d6',
    // Accent
    accent: '#fbad02',
    // Backgrounds and surfaces
    background: '#f9fafb',
    surface: '#ffffff',
    card: '#ffffff',
    border: '#e5e7eb',
    divider: '#e5e7eb',
    // Text colors
    text: '#1f2937',
    textSecondary: '#6b7280',
    textTertiary: '#9ca3af',
    textInverse: '#ffffff',
    // Status colors
    success: '#10b981',
    successDark: '#047857', // Alto contraste para texto (5.9:1)
    successBg: '#d1fae5',
    successLight: '#d1fae5',
    warning: '#f59e0b',
    warningText: '#b45309', // Alto contraste para texto (5.1:1)
    warningBg: '#fef3c7',
    warningLight: '#fef3c7',
    warningDark: '#d97706',
    error: '#ef4444',
    errorBg: '#fee2e2',
    errorLight: '#fee2e2',
    info: '#3b82f6',
    infoBg: '#dbeafe',
    // Gray scale
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
    // Basic colors
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',
    disabled: '#d1d5db',
    overlay: 'rgba(0, 0, 0, 0.5)',
    // Extended colors
    purple: '#8b5cf6',
    purple600: '#7c3aed',
    orange: '#f97316',
    // Blue shades
    blue50: '#eff6ff',
    blue100: '#dbeafe',
    blue300: '#93c5fd',
    blue500: '#3b82f6',
    // Green shades
    green50: '#f0fdf4',
    green100: '#dcfce7',
    green500: '#22c55e',
    green800: '#166534',
    // Red shades
    red50: '#fef2f2',
    red100: '#fee2e2',
    red500: '#ef4444',
    // Yellow shades
    yellow100: '#fef9c3',
    yellow500: '#eab308',
    // Indigo
    indigo100: '#e0e7ff',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
    '6xl': 64,
  },
  borderRadius: {
    xs: 4,
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
      xxl: 24,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
    },
    xs: 12,
    sm: 14,
    md: 15,
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
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

// ===== DARK THEME (Otimizado para uso noturno ao dirigir) =====
export const darkTheme = {
  colors: {
    // Primary colors (mantém identidade mas menos saturado)
    primary: '#5a7fcc',
    primaryDark: '#3d5a9e',
    primaryLight: '#7a9bdf',
    primaryBg: '#1e2a4a',
    // Secondary colors (laranja menos brilhante)
    secondary: '#d4892a',
    secondaryDark: '#a66b20',
    secondaryLight: '#e8a24a',
    secondaryBg: '#3d3020',
    // Accent
    accent: '#d49a20',
    // Backgrounds and surfaces (tons escuros para reduzir fadiga ocular)
    background: '#0f1419',
    surface: '#1a2029',
    card: '#1f2937',
    border: '#374151',
    divider: '#374151',
    // Text colors (contraste otimizado para noite)
    text: '#e5e7eb',
    textSecondary: '#9ca3af',
    textTertiary: '#6b7280',
    textInverse: '#111827',
    // Status colors (menos saturados para não distrair)
    success: '#34d399',
    successDark: '#10b981', // Alto contraste para texto em dark mode
    successBg: '#064e3b',
    successLight: '#065f46',
    warning: '#fbbf24',
    warningText: '#fbbf24', // Alto contraste para texto em dark mode
    warningBg: '#451a03',
    warningLight: '#78350f',
    warningDark: '#b45309',
    error: '#f87171',
    errorBg: '#450a0a',
    errorLight: '#7f1d1d',
    info: '#60a5fa',
    infoBg: '#1e3a5f',
    // Gray scale (invertido para dark mode)
    gray50: '#111827',
    gray100: '#1f2937',
    gray200: '#374151',
    gray300: '#4b5563',
    gray400: '#6b7280',
    gray500: '#9ca3af',
    gray600: '#d1d5db',
    gray700: '#e5e7eb',
    gray800: '#f3f4f6',
    gray900: '#f9fafb',
    // Basic colors
    white: '#1a2029',
    black: '#f9fafb',
    transparent: 'transparent',
    disabled: '#4b5563',
    overlay: 'rgba(0, 0, 0, 0.7)',
    // Extended colors
    purple: '#a78bfa',
    purple600: '#8b5cf6',
    orange: '#fb923c',
    // Blue shades
    blue50: '#1e3a5f',
    blue100: '#1e40af',
    blue300: '#3b82f6',
    blue500: '#60a5fa',
    // Green shades
    green50: '#064e3b',
    green100: '#065f46',
    green500: '#34d399',
    green800: '#86efac',
    // Red shades
    red50: '#450a0a',
    red100: '#7f1d1d',
    red500: '#f87171',
    // Yellow shades
    yellow100: '#422006',
    yellow500: '#fcd34d',
    // Indigo
    indigo100: '#312e81',
  },
  spacing: lightTheme.spacing,
  borderRadius: lightTheme.borderRadius,
  typography: lightTheme.typography,
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 5,
    },
  },
  layout: lightTheme.layout,
} as const;

// ===== TYPES =====
type AppBreakpoints = typeof breakpoints;
type AppThemes = {
  light: typeof lightTheme;
  dark: typeof darkTheme;
};

// Augment TypeScript types
declare module 'react-native-unistyles' {
  export interface UnistylesBreakpoints extends AppBreakpoints {}
  export interface UnistylesThemes extends AppThemes {}
}

// ===== CONFIGURE =====
StyleSheet.configure({
  settings: {
    adaptiveThemes: true, // Ativa detecção automática de dark mode
  },
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
  breakpoints,
});
