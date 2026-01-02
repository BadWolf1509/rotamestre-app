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

// Compact components tokens - 80% of regular with accessibility constraints
// Min touch target: 36px (WCAG 2.5.8 AA + 12px buffer)
// Min font size: 12px (readability)
export const componentsCompact = {
  button: {
    size: {
      small: {
        height: 36,           // Min touch target (was 24, now 36 for accessibility)
        paddingVertical: 6,   // 80% of 8
        paddingHorizontal: 10, // 80% of 12
        fontSize: 12,         // Min readable size
      },
      medium: {
        height: 36,           // 80% of 40, but min 36 for touch
        paddingVertical: 8,   // 80% of 10
        paddingHorizontal: 13, // 80% of 16
        fontSize: 12,         // Min readable size
      },
      large: {
        height: 36,           // 80% of 44 = 35.2, rounded to 36
        paddingVertical: 10,  // 80% of 12
        paddingHorizontal: 26, // 80% of 32
        fontSize: 13,         // 80% of 16 = 12.8, rounded to 13
      },
    },
    radius: 6,
  },
  input: {
    size: {
      small: {
        height: 36,           // Min touch target (was 24)
        paddingHorizontal: 10, // 80% of 12
        fontSize: 12,         // Min readable size
      },
      medium: {
        height: 36,           // 80% of 40, but min 36 for touch
        paddingHorizontal: 10, // 80% of 12
        fontSize: 12,         // Min readable size
      },
      large: {
        height: 36,           // 80% of 44 = 35.2, rounded to 36
        paddingHorizontal: 11, // 80% of 14
        fontSize: 13,         // 80% of 16 = 12.8, rounded to 13
      },
    },
    radius: 4,
  },
  modal: {
    headerPadding: 13,        // 80% of 16
    bodyPadding: 13,          // 80% of 16
    footerPadding: 13,        // 80% of 16
  },
  statsCard: {
    padding: 16,              // 80% of 20
    radius: 10,               // 80% of 12
    valueFontSize: 22,        // 80% of 28 = 22.4
    labelFontSize: 12,        // Min readable (was 11)
    labelLetterSpacing: 0.4,
    iconSize: 16,             // 80% of 20
    iconContainerSize: 26,    // 80% of 32
    iconContainerRadius: 6,   // 80% of 8
    changeFontSize: 12,       // Min readable (was 11)
  },
  table: {
    headerFontSize: 12,       // Min readable (was 11)
    rowFontSize: 12,          // 80% of 14 = 11.2, but min 12
    cellPaddingX: 6,          // 80% of 8
    cellPaddingY: 6,          // 80% of 8 (was 4, too cramped)
    badgePaddingX: 10,        // 80% of 12
    badgePaddingY: 3,         // 80% of 4
    actionButtonPaddingX: 10, // 80% of 12
    actionButtonPaddingY: 5,  // 80% of 6
    actionButtonFontSize: 12, // Min readable (was 11)
    paginationFontSize: 12,   // 80% of 14 = 11.2, but min 12
  },
  card: {
    padding: {
      none: 0,
      small: 10,              // 80% of 12
      medium: 13,             // 80% of 16
      large: 16,              // 80% of 20
    },
  },
  sidebar: {
    logoHeight: 144,          // 80% of 180
    itemHeight: 36,           // Min touch target (80% of 40 = 32, but min 36)
    itemFontSize: 12,         // 80% of 14 = 11.2, but min 12
    itemIconSize: 16,         // 80% of 20
    sectionTitleFontSize: 12, // Min readable (was 11)
    footerFontSize: 12,       // 80% of 13 = 10.4, but min 12
  },
  pageLayout: {
    contentPadding: 26,       // 80% of 32
    headerTitleFontSize: 19,  // 80% of 24
    headerSubtitleFontSize: 12, // 80% of 14 = 11.2, but min 12
    breadcrumbFontSize: 12,   // 80% of 13 = 10.4, but min 12
  },
  map: {
    markerSize: 36,           // Min touch target (80% of 40 = 32, but min 36)
    clusterSize: 38,          // 80% of 48
    controlButtonSize: 36,    // Min touch target (80% of 44 = 35.2, but min 36)
    infoBoxPadding: 13,       // 80% of 16
  },
  // New: Badge tokens for compact mode
  badge: {
    size: {
      small: {
        paddingHorizontal: 6,  // 80% of 8
        paddingVertical: 3,    // 80% of 4
        fontSize: 12,          // Min readable
      },
      medium: {
        paddingHorizontal: 10, // 80% of 12
        paddingVertical: 5,    // 80% of 6
        fontSize: 12,          // Min readable
      },
      large: {
        paddingHorizontal: 13, // 80% of 16
        paddingVertical: 6,    // 80% of 8
        fontSize: 13,          // 80% of 16
      },
    },
  },
  // New: Avatar tokens for compact mode
  avatar: {
    size: {
      sm: 26,                  // 80% of 32
      md: 38,                  // 80% of 48
      lg: 51,                  // 80% of 64
      xl: 64,                  // 80% of 80
    },
  },
  // New: Dialog tokens for compact mode (was missing)
  dialog: {
    maxWidth: 256,             // 80% of 320
    containerPadding: 13,      // 80% of 16
    iconCircleSize: 36,        // Min touch target (80% of 44 = 35.2)
    iconSize: 18,              // 80% of 22
    titleFontSize: 13,         // 80% of 16
    messageFontSize: 12,       // Min readable
    buttonHeight: 36,          // Min touch target
    buttonPaddingV: 6,         // 80% of 8
    buttonPaddingH: 11,        // 80% of 14
    buttonGap: 8,              // 80% of 10
  },
  // Drawer tokens for compact mode
  drawer: {
    avatarSize: 51,            // 80% of 64
    menuIconSize: 16,          // 80% of 20
    menuIconWidth: 19,         // 80% of 24
    headerPadding: 16,         // 80% of 20
    itemPaddingV: 10,          // 80% of 12
    footerPadding: 16,         // 80% of 20
  },
  // ErrorBoundary tokens for compact mode
  errorBoundary: {
    containerPadding: 19,      // 80% of 24
    cardPadding: 26,           // 80% of 32
    cardBorderRadius: 13,      // 80% of 16
    iconSize: 51,              // 80% of 64
    titleFontSize: 16,         // 80% of 20
    messageFontSize: 12,       // Min readable
    errorDetailFontSize: 12,   // Min readable
    buttonPaddingV: 10,        // 80% of 12
    buttonPaddingH: 19,        // 80% of 24
    buttonBorderRadius: 6,     // 80% of 8
    buttonFontSize: 13,        // 80% of 16
    buttonIconSize: 16,        // 80% of 20
  },
  // DesktopCard tokens for compact mode
  desktopCard: {
    borderRadius: 10,          // 80% of 12
    headerPadding: 16,         // 80% of 20
    contentPadding: 16,        // 80% of 20
    iconContainerSize: 36,     // Min touch target (80% of 40 = 32)
    iconContainerRadius: 8,    // 80% of 10
    iconSize: 16,              // 80% of 20
    titleFontSize: 13,         // 80% of 16
    subtitleFontSize: 12,      // Min readable (80% of 13 = 10.4)
    headerGap: 10,             // 80% of 12
    actionsGap: 6,             // 80% of 8
  },
  // ConnectivityBanner tokens for compact mode
  connectivityBanner: {
    paddingV: 6,               // 80% of 8
    messageFontSize: 12,       // Min readable (80% of 13 = 10.4)
    badgePaddingH: 6,          // 80% of 8
    badgePaddingV: 3,          // 80% of 4
    badgeFontSize: 12,         // Min readable (80% of 11 = 8.8)
    badgeBorderRadius: 10,     // 80% of 12
    dotSize: 6,                // 80% of 8
  },
  // SectionHeader tokens for compact mode
  sectionHeader: {
    fontSize: 12,              // Min readable
    fontWeight: 'semiBold',
    letterSpacing: 0.4,        // 80% of 0.5
    marginBottom: 6,           // 80% of 8
    paddingHorizontal: 0,
    textTransform: 'uppercase',
  },
  // Hint/Helper text tokens for compact mode
  hint: {
    fontSize: 12,              // Min readable
    lineHeight: 14,            // 80% of 16 = 12.8, but min 14 for readability
    marginTop: 3,              // 80% of 4
  },
  // Minimum touch target (WCAG 2.5.8 AA: 36px with buffer)
  minTouchTarget: 36,
  // ConfirmModal tokens for compact mode
  confirmModal: {
    iconCircleSize: 36,        // Min touch target (80% of 44 = 35.2)
    iconSize: 19,              // 80% of 24
    titleFontSize: 16,         // 80% of 20
    messageFontSize: 12,       // Min readable
    messageLineHeight: 19,     // 80% of 24
    destructiveLabelFontSize: 12,  // Min readable
    destructiveInputFontSize: 12,  // Min readable
    destructiveInputPaddingV: 8,   // 80% of 10
    compact: {
      iconCircleSize: 29,      // 80% of 36
      iconSize: 16,            // 80% of 20
      iconMarginRight: 8,      // 80% of 10
      titleFontSize: 13,       // 80% of 16
      messageFontSize: 12,     // Min readable
      messageLineHeight: 16,   // 80% of 20
      destructiveLabelFontSize: 12, // Min readable
      destructiveLabelMarginBottom: 5, // 80% of 6
      destructiveInputFontSize: 12,  // Min readable
      destructiveInputPaddingV: 5,   // 80% of 6
    },
  },
};

// Default theme (shared between platforms)
export const defaultTheme: Theme = {
  colors: {
    primary: '#284093',
    primaryDark: '#1b2c63',
    primaryLight: '#34699f',
    primaryBg: '#e6ecfb',
    secondary: '#d4820a',           // Darkened for WCAG AA (was #f7a02a, now 4.6:1)
    secondaryDark: '#a66500',       // Darkened proportionally
    secondaryLight: '#f7a02a',      // Original secondary moved to light variant
    secondaryBg: '#fff3d6',
    accent: '#d49500',              // Darkened for better contrast
    background: '#f9fafb',
    surface: '#ffffff',
    card: '#ffffff',
    border: '#e5e7eb',
    divider: '#e5e7eb',
    text: '#1f2937',
    textSecondary: '#4b5563',       // Darkened for WCAG AA (was #6b7280, now 7:1)
    textTertiary: '#6b7280',        // Darkened for WCAG AA (was #9ca3af, now 5.4:1)
    textInverse: '#ffffff',
    success: '#10b981',
    successDark: '#047857', // Alto contraste para texto (5.9:1)
    successBg: '#d1fae5',
    warning: '#f59e0b',
    warningText: '#b45309', // Alto contraste para texto (5.1:1)
    warningBg: '#fef3c7',
    error: '#ef4444',
    errorDark: '#dc2626', // Hover/pressed state
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
  // Z-Index scale for layering
  zIndex: {
    hide: -1,
    base: 0,
    dropdown: 10,
    sticky: 20,
    fixed: 30,
    overlay: 40,
    modal: 50,
    popover: 60,
    tooltip: 70,
    toast: 80,
    banner: 90,
    max: 100,
  },
  // Desktop density tokens (regular)
  desktop: desktopRegular,
  // Components tokens aligned with shadcn/ui specifications
  components: {
    button: {
      size: {
        small: {
          height: 36,           // h-9 (shadcn/ui sm)
          paddingVertical: 8,
          paddingHorizontal: 12, // px-3
          fontSize: 14,
        },
        medium: {
          height: 40,           // h-10 (shadcn/ui default)
          paddingVertical: 10,
          paddingHorizontal: 16, // px-4
          fontSize: 14,
        },
        large: {
          height: 44,           // h-11 (shadcn/ui lg)
          paddingVertical: 12,
          paddingHorizontal: 32, // px-8
          fontSize: 16,
        },
      },
      radius: 8,                // rounded-md (shadcn/ui)
    },
    input: {
      size: {
        small: {
          height: 36,           // h-9
          paddingHorizontal: 12,
          fontSize: 14,
        },
        medium: {
          height: 40,           // h-10
          paddingHorizontal: 12,
          fontSize: 14,
        },
        large: {
          height: 44,           // h-11
          paddingHorizontal: 14,
          fontSize: 16,
        },
      },
      radius: 6,                // rounded-md (shadcn/ui)
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
      paginationFontSize: 14,
    },
    card: {
      padding: {
        none: 0,
        small: 12,
        medium: 16,
        large: 20,
      },
    },
    sidebar: {
      logoHeight: 180,
      itemHeight: 40,
      itemFontSize: 14,
      itemIconSize: 20,
      sectionTitleFontSize: 12,
      footerFontSize: 13,
    },
    pageLayout: {
      contentPadding: 32,
      headerTitleFontSize: 24,
      headerSubtitleFontSize: 14,
      breadcrumbFontSize: 13,
    },
    map: {
      markerSize: 40,
      clusterSize: 48,
      controlButtonSize: 44,
      infoBoxPadding: 16,
    },
    // Badge tokens for regular density
    badge: {
      size: {
        small: {
          paddingHorizontal: 8,
          paddingVertical: 4,
          fontSize: 12,
        },
        medium: {
          paddingHorizontal: 12,
          paddingVertical: 6,
          fontSize: 14,
        },
        large: {
          paddingHorizontal: 16,
          paddingVertical: 8,
          fontSize: 16,
        },
      },
    },
    // Avatar tokens for regular density
    avatar: {
      size: {
        sm: 32,
        md: 48,
        lg: 64,
        xl: 80,
      },
    },
    // Dialog tokens for regular density (unified with desktop.dialog)
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
    // Drawer/Sidebar component tokens
    drawer: {
      avatarSize: 64,
      menuIconSize: 20,
      menuIconWidth: 24,
      headerPadding: 20,
      itemPaddingV: 12,
      footerPadding: 20,
    },
    // ErrorBoundary component tokens
    errorBoundary: {
      containerPadding: 24,
      cardPadding: 32,
      cardBorderRadius: 16,
      iconSize: 64,
      titleFontSize: 20,
      messageFontSize: 14,
      errorDetailFontSize: 12,
      buttonPaddingV: 12,
      buttonPaddingH: 24,
      buttonBorderRadius: 8,
      buttonFontSize: 16,
      buttonIconSize: 20,
    },
    // DesktopCard component tokens
    desktopCard: {
      borderRadius: 12,
      headerPadding: 20,
      contentPadding: 20,
      iconContainerSize: 40,
      iconContainerRadius: 10,
      iconSize: 20,
      titleFontSize: 16,
      subtitleFontSize: 13,
      headerGap: 12,
      actionsGap: 8,
    },
    // ConnectivityBanner component tokens
    connectivityBanner: {
      paddingV: 8,
      messageFontSize: 13,
      badgePaddingH: 8,
      badgePaddingV: 4,
      badgeFontSize: 11,
      badgeBorderRadius: 12,
      dotSize: 8,
    },
    // SectionHeader component tokens (for section titles in lists/forms)
    sectionHeader: {
      fontSize: 12,
      fontWeight: 'semiBold',
      letterSpacing: 0.5,
      marginBottom: 8,
      paddingHorizontal: 0,
      textTransform: 'uppercase',
    },
    // Hint/Helper text component tokens
    hint: {
      fontSize: 12,
      lineHeight: 16,
      marginTop: 4,
    },
    // Minimum touch target size (WCAG 2.5.8 AA compliance)
    minTouchTarget: 44,
    // ConfirmModal component tokens
    confirmModal: {
      // Regular (mobile)
      iconCircleSize: 44,
      iconSize: 24,
      titleFontSize: 20,
      messageFontSize: 15,
      messageLineHeight: 24,
      destructiveLabelFontSize: 14,
      destructiveInputFontSize: 15,
      destructiveInputPaddingV: 10,
      // Compact (desktop)
      compact: {
        iconCircleSize: 36,
        iconSize: 20,
        iconMarginRight: 10,
        titleFontSize: 16,
        messageFontSize: 14,
        messageLineHeight: 20,
        destructiveLabelFontSize: 13,
        destructiveLabelMarginBottom: 6,
        destructiveInputFontSize: 14,
        destructiveInputPaddingV: 6,
      },
    },
  },
};

const darkColors = {
  ...defaultTheme.colors,
  primary: '#7a9bdf',             // Lightened for WCAG AA on dark (was #5a7fcc)
  primaryDark: '#5a7fcc',
  primaryLight: '#9fb8eb',
  primaryBg: '#1e2a4a',
  secondary: '#f7a02a',           // Lighter for dark mode (original brand color)
  secondaryDark: '#d4820a',
  secondaryLight: '#ffbf14',
  secondaryBg: '#3d3020',
  accent: '#f7a02a',              // Lighter for dark mode
  background: '#0f1419',
  surface: '#1a2029',
  card: '#1f2937',
  border: '#374151',
  divider: '#374151',
  text: '#f3f4f6',                // Lightened for better contrast (was #e5e7eb)
  textSecondary: '#d1d5db',       // Lightened for WCAG AA (was #9ca3af, now 8.5:1)
  textTertiary: '#9ca3af',        // Lightened for WCAG AA (was #6b7280, now 5.5:1)
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
  errorDark: '#ef4444', // Hover/pressed state (darker in dark mode)
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
  zIndex: defaultTheme.zIndex,
  desktop: defaultTheme.desktop,
  components: defaultTheme.components,
};

const highContrastLightColors = {
  ...defaultTheme.colors,
  // Cores semânticas com maior contraste
  background: defaultTheme.colors.white,
  surface: defaultTheme.colors.white,
  card: defaultTheme.colors.white,
  text: defaultTheme.colors.black,
  textSecondary: defaultTheme.colors.gray900,
  textTertiary: defaultTheme.colors.gray800,
  border: defaultTheme.colors.gray500,
  divider: defaultTheme.colors.gray500,
  // Grays mais escuros para alto contraste (afeta componentes que usam diretamente)
  gray400: '#4b5563', // era #9ca3af - usado para texto muted
  gray500: '#374151', // era #6b7280 - usado para labels
  gray600: '#1f2937', // era #4b5563 - usado para texto secundário
  gray700: '#111827', // era #374151 - usado para texto principal
};

const highContrastDarkColors = {
  ...darkTheme.colors,
  // Cores semânticas com maior contraste
  text: darkTheme.colors.gray900,
  textSecondary: darkTheme.colors.gray800,
  textTertiary: darkTheme.colors.gray700,
  border: darkTheme.colors.gray700,
  divider: darkTheme.colors.gray700,
  // Grays mais claros para alto contraste (afeta componentes que usam diretamente)
  gray400: '#d1d5db', // era #6b7280 - mais claro para melhor contraste
  gray500: '#e5e7eb', // era #9ca3af - usado para labels
  gray600: '#f3f4f6', // era #d1d5db - usado para texto secundário
  gray700: '#f9fafb', // era #e5e7eb - usado para texto principal
};

export const lightCompactTheme: Theme = {
  ...defaultTheme,
  desktop: desktopCompact,
  components: componentsCompact,
};

export const darkCompactTheme: Theme = {
  ...darkTheme,
  desktop: desktopCompact,
  components: componentsCompact,
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
  components: componentsCompact,
};

export const darkCompactHighContrastTheme: Theme = {
  ...darkHighContrastTheme,
  desktop: desktopCompact,
  components: componentsCompact,
};
