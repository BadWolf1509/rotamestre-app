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
const breakpoints = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

// ===== THEME =====
const lightTheme = defaultTheme;
const lightCompactTheme = baseLightCompactTheme;
const lightHighContrastTheme = baseLightHighContrastTheme;
const lightCompactHighContrastTheme = baseLightCompactHighContrastTheme;

// ===== DARK THEME (optimized for night usage) =====
const darkTheme = baseDarkTheme;
const darkCompactTheme = baseDarkCompactTheme;
const darkHighContrastTheme = baseDarkHighContrastTheme;
const darkCompactHighContrastTheme = baseDarkCompactHighContrastTheme;

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
    initialTheme: 'light', // required when adaptiveThemes is false
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
