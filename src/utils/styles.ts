/**
 * Wrapper para Unistyles compatível com Web
 *
 * - Web: Usa StyleSheet nativo do React Native (sem Unistyles)
 * - Native: Usa Unistyles 3.0 completo
 */

import { StyleSheet as RNStyleSheet, Platform } from 'react-native';

// Theme padrão (deve corresponder ao unistyles.ts)
export interface Theme {
  colors: {
    primary: string;
    primaryDark: string;
    primaryLight: string;
    primaryBg: string;
    secondary: string;
    secondaryDark: string;
    secondaryLight: string;
    secondaryBg: string;
    accent: string;
    background: string;
    surface: string;
    card: string;
    border: string;
    divider: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    textInverse: string;
    success: string;
    successBg: string;
    warning: string;
    warningBg: string;
    error: string;
    errorBg: string;
    info: string;
    infoBg: string;
    white: string;
    black: string;
    gray50: string;
    gray100: string;
    gray200: string;
    gray300: string;
    gray400: string;
    gray500: string;
    gray600: string;
    gray700: string;
    gray800: string;
    gray900: string;
    disabled: string;
    overlay: string;
    transparent: string;
    purple: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    '2xl': number;
    '3xl': number;
    '4xl': number;
    '5xl': number;
    '6xl': number;
  };
  typography: {
    fontDisplay: string;
    fontSans: string;
    fontSansLight: string;
    fontSansMedium: string;
    fontSansSemiBold: string;
    fontSansBold: string;
    fontSansExtraBold: string;
    fontSize: {
      xs: number;
      sm: number;
      base: number;
      lg: number;
      xl: number;
      xxl: number;
      '2xl': number;
      '3xl': number;
      '4xl': number;
    };
    xs: number;
    sm: number;
    base: number;
    lg: number;
    xl: number;
    xxl: number;
    '2xl': number;
    '3xl': number;
    '4xl': number;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };
  shadows: {
    sm: any;
    md: any;
    lg: any;
  };
  layout: {
    sidebarWidth: number;
    containerMaxWidth: number;
  };
}

export const defaultTheme: Theme = {
  colors: {
    primary: '#1e5aa8',
    primaryDark: '#0d5a9c',
    primaryLight: '#3b82f6',
    primaryBg: '#eef5ff',
    secondary: '#f7a02a',
    secondaryDark: '#d68a1d',
    secondaryLight: '#ffc266',
    secondaryBg: '#fff8ed',
    accent: '#f59e0b',
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
    successBg: '#d1fae5',
    warning: '#f59e0b',
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
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24, // Mantido para compatibilidade
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
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  borderRadius: {
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
};

// Declarações condicionais (sem export dentro do if)
let StyleSheetImpl: any;
let useUnistylesImpl: any;

if (Platform.OS === 'web') {
  // Web: StyleSheet básico sem Unistyles (Babel plugin não funciona bem)
  StyleSheetImpl = {
    create: <T extends Record<string, any>>(
      stylesOrFactory: T | ((theme: Theme) => T)
    ): T => {
      if (typeof stylesOrFactory === 'function') {
        const styles = stylesOrFactory(defaultTheme);
        return RNStyleSheet.create(styles) as T;
      }
      return RNStyleSheet.create(stylesOrFactory) as T;
    },
  };

  useUnistylesImpl = () => ({
    theme: defaultTheme,
    breakpoint: 'xs' as const,
  });
} else {
  // Native: Usa Unistyles 3.0 completo
  const Unistyles = require('react-native-unistyles');
  StyleSheetImpl = Unistyles.StyleSheet;
  useUnistylesImpl = Unistyles.useUnistyles;
}

// Exports no top level
export const StyleSheet = StyleSheetImpl;
export const useUnistyles = useUnistylesImpl;
