/**
 * Base Styles - Shared between Native and Web
 *
 * This file contains the defaultTheme that can be used at module level
 * in StyleSheet.create() calls. It has no platform-specific dependencies.
 */

import { boxShadow, withOpacity } from './color';

import type { Theme } from './styles.types';

const motionTokens = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 350,
  },
  easing: {
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

const desktopRegular = {
  input: {
    height: 36,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  button: {
    height: 32,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  field: {
    marginBottom: 12,
  },
  section: {
    padding: 12,
    gap: 8,
  },
  // Modal tokens for form modals (Header-Body-Footer pattern)
  modal: {
    headerPadding: 12,
    bodyPadding: 12,
    footerPadding: 12,
    footerGap: 8,
    titleFontSize: 15,
    closeButtonSize: 20,
  },
  // Dialog tokens for centered-icon dialogs (Alert/Confirm)
  dialog: {
    maxWidth: 320,
    containerPadding: 16,
    iconCircleSize: 44,
    iconSize: 22,
    titleFontSize: 16,
    messageFontSize: 13,
    buttonHeight: 36,
    buttonPaddingV: 8,
    buttonPaddingH: 14,
    buttonGap: 10,
  },
};

export const desktopCompact = {
  input: {
    height: 32,
    paddingHorizontal: 8,
    fontSize: 13,
  },
  button: {
    height: 28,
    paddingHorizontal: 10,
    fontSize: 12,
  },
  field: {
    marginBottom: 8,
  },
  section: {
    padding: 10,
    gap: 6,
  },
  modal: {
    headerPadding: 10,
    bodyPadding: 10,
    footerPadding: 10,
    footerGap: 6,
    titleFontSize: 14,
    closeButtonSize: 18,
  },
  dialog: {
    maxWidth: 300,
    containerPadding: 12,
    iconCircleSize: 40,
    iconSize: 20,
    titleFontSize: 15,
    messageFontSize: 12,
    buttonHeight: 32,
    buttonPaddingV: 6,
    buttonPaddingH: 12,
    buttonGap: 8,
  },
};

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
    overlay: withOpacity('#000000', 0.5),
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
    whatsapp: '#25D366',
    // KPI Card Colors (Brand-compliant)
    kpiTotalHoje: '#284093',    // Azul Principal
    kpiEmAndamento: '#f7a02a',  // Laranja Principal
    kpiConcluidas: '#34699f',   // Azul Claro
    kpiDistancia: '#ffbf14',    // Laranja Claro
    kpiIncidentes: '#1b2c63',   // Azul Escuro
    // Incident Categories (semantic colors)
    incident: {
      accident: '#ef4444',     // vermelho - acidentes/incidentes graves
      absent: '#f59e0b',       // amarelo/laranja - cliente ausente
      wrongAddress: '#3b82f6', // azul - endereço incorreto
      blocked: '#8b5cf6',      // roxo - acesso bloqueado
      vehicle: '#ec4899',      // rosa - problema no veículo
      weather: '#06b6d4',      // ciano - condições climáticas
      other: '#6b7280',        // cinza - outros problemas
    },
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
      boxShadow: boxShadow(0, 1, 2, 0, '#000000', 0.05),
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      // Web: boxShadow CSS
      boxShadow: boxShadow(0, 2, 4, 0, '#000000', 0.1),
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
      // Web: boxShadow CSS
      boxShadow: boxShadow(0, 4, 8, 0, '#000000', 0.15),
    },
    // Brand shadows for colored buttons
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
      boxShadow: boxShadow(0, 2, 4, 0, '#000000', 0.08),
    },
  },
  layout: {
    sidebarWidth: 264,
    containerMaxWidth: 1280,
  },
  motion: motionTokens,
  // Desktop density tokens (regular)
  desktop: desktopRegular,
  components: {
    button: {
      size: {
        small: {
          height: 36,
          paddingVertical: 8,
          paddingHorizontal: 12,
          fontSize: 14,
        },
        medium: {
          height: 44,
          paddingVertical: 12,
          paddingHorizontal: 16,
          fontSize: 16,
        },
        large: {
          height: 52,
          paddingVertical: 16,
          paddingHorizontal: 20,
          fontSize: 18,
        },
      },
      radius: 10,
    },
    input: {
      size: {
        small: {
          height: 36,
          paddingHorizontal: 10,
          fontSize: 14,
        },
        medium: {
          height: 44,
          paddingHorizontal: 12,
          fontSize: 16,
        },
        large: {
          height: 52,
          paddingHorizontal: 14,
          fontSize: 18,
        },
      },
      radius: 8,
    },
    modal: {
      headerPadding: 16,
      bodyPadding: 16,
      footerPadding: 16,
    },
    statsCard: {
      padding: 20,
      radius: 12,
      valueFontSize: 28,
      labelFontSize: 13,
      labelLetterSpacing: 0.5,
      iconSize: 20,
      iconContainerSize: 32,
      iconContainerRadius: 8,
      changeFontSize: 13,
    },
    table: {
      headerFontSize: 12,
      rowFontSize: 14,
      cellPaddingX: 8,
      cellPaddingY: 8,
      badgePaddingX: 12,
      badgePaddingY: 4,
      actionButtonPaddingX: 12,
      actionButtonPaddingY: 6,
      actionButtonFontSize: 13,
    },
  },
};

const darkColors = {
  ...defaultTheme.colors,
  primary: '#5a7fcc',
  primaryDark: '#3d5a9e',
  primaryLight: '#7a9bdf',
  primaryBg: '#1e2a4a',
  secondary: '#d4892a',
  secondaryDark: '#a66b20',
  secondaryLight: '#e8a24a',
  secondaryBg: '#3d3020',
  accent: '#d49a20',
  background: '#0f1419',
  surface: '#1a2029',
  card: '#1f2937',
  border: '#374151',
  divider: '#374151',
  text: '#e5e7eb',
  textSecondary: '#9ca3af',
  textTertiary: '#6b7280',
  textInverse: '#111827',
  success: '#34d399',
  successDark: '#10b981',
  successBg: '#064e3b',
  successLight: '#065f46',
  warning: '#fbbf24',
  warningText: '#fbbf24',
  warningBg: '#451a03',
  warningLight: '#78350f',
  warningDark: '#b45309',
  error: '#f87171',
  errorBg: '#450a0a',
  errorLight: '#7f1d1d',
  info: '#60a5fa',
  infoBg: '#1e3a5f',
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
  white: '#1a2029',
  black: '#f9fafb',
  disabled: '#4b5563',
  overlay: withOpacity('#000000', 0.7),
  purple: '#a78bfa',
  purple600: '#8b5cf6',
  orange: '#fb923c',
  blue50: '#1e3a5f',
  blue100: '#1e40af',
  blue300: '#3b82f6',
  blue500: '#60a5fa',
  green50: '#064e3b',
  green100: '#065f46',
  green500: '#34d399',
  green800: '#86efac',
  whatsapp: '#25D366',
  red50: '#450a0a',
  red100: '#7f1d1d',
  red500: '#f87171',
  yellow100: '#422006',
  yellow500: '#fcd34d',
  indigo100: '#312e81',
};

const darkShadows = {
  sm: {
    shadowColor: defaultTheme.colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 1,
    boxShadow: boxShadow(0, 1, 2, 0, defaultTheme.colors.black, 0.3),
  },
  md: {
    shadowColor: defaultTheme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
    boxShadow: boxShadow(0, 2, 4, 0, defaultTheme.colors.black, 0.4),
  },
  lg: {
    shadowColor: defaultTheme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
    boxShadow: boxShadow(0, 4, 8, 0, defaultTheme.colors.black, 0.5),
  },
  card: {
    shadowColor: defaultTheme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    boxShadow: boxShadow(0, 2, 4, 0, defaultTheme.colors.black, 0.2),
  },
};

export const darkTheme: Theme = {
  colors: darkColors,
  spacing: defaultTheme.spacing,
  borderRadius: defaultTheme.borderRadius,
  typography: defaultTheme.typography,
  shadows: darkShadows,
  motion: defaultTheme.motion,
  layout: defaultTheme.layout,
  desktop: defaultTheme.desktop,
  components: defaultTheme.components,
};

const highContrastLightColors = {
  ...defaultTheme.colors,
  background: defaultTheme.colors.white,
  surface: defaultTheme.colors.white,
  card: defaultTheme.colors.white,
  text: defaultTheme.colors.black,
  textSecondary: defaultTheme.colors.gray900,
  textTertiary: defaultTheme.colors.gray800,
  border: defaultTheme.colors.gray500,
  divider: defaultTheme.colors.gray500,
};

const highContrastDarkColors = {
  ...darkTheme.colors,
  text: darkTheme.colors.gray900,
  textSecondary: darkTheme.colors.gray800,
  textTertiary: darkTheme.colors.gray700,
  border: darkTheme.colors.gray700,
  divider: darkTheme.colors.gray700,
};

export const lightCompactTheme: Theme = {
  ...defaultTheme,
  desktop: desktopCompact,
};

export const darkCompactTheme: Theme = {
  ...darkTheme,
  desktop: desktopCompact,
};

export const lightHighContrastTheme: Theme = {
  ...defaultTheme,
  colors: highContrastLightColors,
};

export const darkHighContrastTheme: Theme = {
  ...darkTheme,
  colors: highContrastDarkColors,
};

export const lightCompactHighContrastTheme: Theme = {
  ...lightHighContrastTheme,
  desktop: desktopCompact,
};

export const darkCompactHighContrastTheme: Theme = {
  ...darkHighContrastTheme,
  desktop: desktopCompact,
};
