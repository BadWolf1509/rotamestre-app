/**
 * React Native Unistyles v3 Configuration
 * Responsive design system for Rota Mestre
 */

import { StyleSheet } from 'react-native-unistyles';

import {
  darkCompactHighContrastTheme as baseDarkCompactHighContrastTheme,
  darkCompactTheme as baseDarkCompactTheme,
  darkHighContrastTheme as baseDarkHighContrastTheme,
  darkTheme as baseDarkTheme,
  defaultTheme,
  lightCompactHighContrastTheme as baseLightCompactHighContrastTheme,
  lightCompactTheme as baseLightCompactTheme,
  lightHighContrastTheme as baseLightHighContrastTheme,
} from './utils/styles.base';

// ===== BREAKPOINTS =====
export const breakpoints = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

// ===== THEME =====
export const lightTheme = defaultTheme;
export const lightCompactTheme = baseLightCompactTheme;
export const lightHighContrastTheme = baseLightHighContrastTheme;
export const lightCompactHighContrastTheme = baseLightCompactHighContrastTheme;

// ===== DARK THEME (optimized for night usage) =====
export const darkTheme = baseDarkTheme;
export const darkCompactTheme = baseDarkCompactTheme;
export const darkHighContrastTheme = baseDarkHighContrastTheme;
export const darkCompactHighContrastTheme = baseDarkCompactHighContrastTheme;

// ===== TYPES =====
type AppBreakpoints = typeof breakpoints;
type AppThemes = {
  light: typeof lightTheme;
  dark: typeof darkTheme;
  lightCompact: typeof lightCompactTheme;
  darkCompact: typeof darkCompactTheme;
  lightHighContrast: typeof lightHighContrastTheme;
  darkHighContrast: typeof darkHighContrastTheme;
  lightCompactHighContrast: typeof lightCompactHighContrastTheme;
  darkCompactHighContrast: typeof darkCompactHighContrastTheme;
};

// Augment TypeScript types
declare module 'react-native-unistyles' {
  export interface UnistylesBreakpoints extends AppBreakpoints {}
  export interface UnistylesThemes extends AppThemes {}
}

// ===== CONFIGURE =====
StyleSheet.configure({
  settings: {
    adaptiveThemes: false, // respect user's saved preference from AsyncStorage
  },
  themes: {
    light: lightTheme,
    dark: darkTheme,
    lightCompact: lightCompactTheme,
    darkCompact: darkCompactTheme,
    lightHighContrast: lightHighContrastTheme,
    darkHighContrast: darkHighContrastTheme,
    lightCompactHighContrast: lightCompactHighContrastTheme,
    darkCompactHighContrast: darkCompactHighContrastTheme,
  },
  breakpoints,
});
