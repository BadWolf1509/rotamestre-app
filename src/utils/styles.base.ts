/**
 * Base Styles - Shared between Native and Web
 *
 * This file contains the defaultTheme that can be used at module level
 * in StyleSheet.create() calls. It has no platform-specific dependencies.
 */

import type { Theme } from './styles.types';

// Default theme (shared between platforms)
export const defaultTheme: Theme = {
  colors: {
    primary: '#284093',
    primaryDark: '#1b2c63',
    primaryLight: '#34699f',
    primaryBg: '#e6ecfb',
    secondary: '#f7a02a',
    secondaryDark: '#c87704',
    secondaryLight: '#ffbf14',
    secondaryBg: '#fff3d6',
    accent: '#fbad02',
    background: '#f9fafb',
    surface: '#ffffff',
    card: '#ffffff',
    border: '#e5e7eb',
    divider: '#e5e7eb',
    text: '#1f2937',
    textSecondary: '#6b7280',
    textTertiary: '#9ca3af',
    textInverse: '#ffffff',
    success: '#10b981',
    successDark: '#047857', // Alto contraste para texto (5.9:1)
    successBg: '#d1fae5',
    warning: '#f59e0b',
    warningText: '#b45309', // Alto contraste para texto (5.1:1)
    warningBg: '#fef3c7',
    error: '#ef4444',
    errorBg: '#fee2e2',
    info: '#3b82f6',
    infoBg: '#dbeafe',
    white: '#ffffff',
    black: '#000000',
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
    disabled: '#d1d5db',
    overlay: 'rgba(0, 0, 0, 0.5)',
    transparent: 'transparent',
    purple: '#8b5cf6',
    purple600: '#7c3aed',
    // Extended colors for status indicators
    blue50: '#eff6ff',
    blue100: '#dbeafe',
    blue500: '#3b82f6',
    green50: '#f0fdf4',
    green100: '#dcfce7',
    green500: '#22c55e',
    red50: '#fef2f2',
    red100: '#fee2e2',
    red500: '#ef4444',
    yellow100: '#fef9c3',
    yellow500: '#eab308',
    indigo100: '#e0e7ff',
    // Additional colors used in components
    orange: '#f97316',
    blue300: '#93c5fd',
    green800: '#166534',
    warningLight: '#fef3c7',
    warningDark: '#d97706',
    errorLight: '#fee2e2',
    successLight: '#d1fae5',
    // KPI Card Colors (Brand-compliant)
    kpiTotalHoje: '#284093',    // Azul Principal
    kpiEmAndamento: '#f7a02a',  // Laranja Principal
    kpiConcluidas: '#34699f',   // Azul Claro
    kpiDistancia: '#ffbf14',    // Laranja Claro
    kpiIncidentes: '#1b2c63',   // Azul Escuro
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
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 10,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
      // Web: boxShadow CSS
      boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      // Web: boxShadow CSS
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
      // Web: boxShadow CSS
      boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.15)',
    },
    // Brand shadows for colored buttons
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.08)',
    },
  },
  layout: {
    sidebarWidth: 264,
    containerMaxWidth: 1280,
  },
};