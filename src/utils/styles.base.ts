/**
 * Base Styles - Shared between Native and Web
 *
 * This file contains the defaultTheme that can be used at module level
 * in StyleSheet.create() calls.
 */

import { Platform } from "react-native";

import { boxShadow, withOpacity } from "@/utils/color";

import type { Theme } from "./styles.types";

/**
 * Creates platform-specific shadow styles.
 * - Web: Uses only boxShadow (CSS)
 * - Native/Test: Uses shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation
 */
function createShadow(
  offsetY: number,
  blur: number,
  opacity: number,
  elevation: number,
) {
  // Safe check for Platform.OS (may be undefined in test environments)
  if (Platform?.OS === "web") {
    return {
      boxShadow: boxShadow(0, offsetY, blur, 0, "#000000", opacity),
    };
  }
  return {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: blur / 2,
    elevation,
  };
}

const motionTokens = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 350,
  },
  easing: {
    easeOut: "cubic-bezier(0, 0, 0.2, 1)",
    easeIn: "cubic-bezier(0.4, 0, 1, 1)",
    easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
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

/**
 * Compact Spacing Scale (snap-to-grid)
 * Uses 4px grid with reduced values for dense UIs
 * Maps: regular → compact (snap down to nearest 4px multiple)
 */
export const spacingCompact = {
  // Numeric tokens
  "0": 0,
  "0.5": 2, // Keep 2px for fine adjustments
  "1": 4, // 4 → 4
  "1.5": 4, // 6 → snap to 4
  "2": 8, // 8 → 8
  "2.5": 8, // 10 → snap to 8
  "3": 8, // 12 → snap to 8
  "3.5": 12, // 14 → snap to 12
  "4": 12, // 16 → snap to 12
  "5": 16, // 20 → snap to 16
  "6": 20, // 24 → snap to 20
  "7": 24, // 28 → snap to 24
  "8": 24, // 32 → snap to 24
  "10": 32, // 40 → snap to 32
  "12": 40, // 48 → snap to 40
  "14": 48, // 56 → snap to 48
  "16": 52, // 64 → snap to 52
  "20": 64, // 80 → snap to 64
  "24": 80, // 96 → snap to 80
  // Semantic aliases
  xs: 4, // 4 → 4
  sm: 4, // 8 → snap to 4 (compact tight)
  md: 8, // 12 → snap to 8
  lg: 12, // 16 → snap to 12
  xl: 16, // 20 → snap to 16
  xxl: 20, // 24 → snap to 20
  "2xl": 20, // 24 → snap to 20
  "3xl": 24, // 32 → snap to 24
  "4xl": 32, // 40 → snap to 32
  "5xl": 40, // 48 → snap to 40
  "6xl": 52, // 64 → snap to 52
};

export const desktopCompact = {
  input: {
    height: 32,
    paddingHorizontal: 8, // snap to 8 (was 10)
    fontSize: 13,
  },
  button: {
    height: 28,
    paddingHorizontal: 8, // snap to 8 (was 10)
    fontSize: 12,
  },
  field: {
    marginBottom: 8,
  },
  section: {
    padding: 8, // snap to 8 (was 10)
    gap: 4, // snap to 4 (was 6)
  },
  modal: {
    headerPadding: 8, // snap to 8 (was 10)
    bodyPadding: 8, // snap to 8 (was 10)
    footerPadding: 8, // snap to 8 (was 10)
    footerGap: 4, // snap to 4 (was 6)
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
    buttonPaddingV: 4, // snap to 4 (was 6)
    buttonPaddingH: 12,
    buttonGap: 8,
  },
};

// Compact components tokens - snap-to-grid values (4px multiples)
// Min touch target: 36px (WCAG 2.5.8 AA + 12px buffer)
// Min font size: 12px (readability)
export const componentsCompact = {
  button: {
    size: {
      small: {
        height: 36, // Min touch target
        paddingVertical: 4, // snap to 4 (was 6)
        paddingHorizontal: 8, // snap to 8 (was 10)
        fontSize: 12, // Min readable size
      },
      medium: {
        height: 36, // Min touch target
        paddingVertical: 8, // on grid
        paddingHorizontal: 12, // snap to 12 (was 13)
        fontSize: 12, // Min readable size
      },
      large: {
        height: 36, // Min touch target
        paddingVertical: 8, // snap to 8 (was 10)
        paddingHorizontal: 24, // snap to 24 (was 26)
        fontSize: 13,
      },
    },
    radius: 6,
  },
  input: {
    size: {
      small: {
        height: 36, // Min touch target
        paddingHorizontal: 8, // snap to 8 (was 10)
        fontSize: 12, // Min readable size
      },
      medium: {
        height: 36, // Min touch target
        paddingHorizontal: 8, // snap to 8 (was 10)
        fontSize: 12, // Min readable size
      },
      large: {
        height: 36, // Min touch target
        paddingHorizontal: 12, // snap to 12 (was 11)
        fontSize: 13,
      },
    },
    radius: 4,
  },
  modal: {
    headerPadding: 12, // snap to 12 (was 13)
    bodyPadding: 12, // snap to 12 (was 13)
    footerPadding: 12, // snap to 12 (was 13)
  },
  statsCard: {
    padding: 16, // on grid
    radius: 8, // snap to 8 (was 10)
    valueFontSize: 22,
    labelFontSize: 12, // Min readable
    labelLetterSpacing: 0.4,
    iconSize: 16, // on grid
    iconContainerSize: 24, // snap to 24 (was 26)
    iconContainerRadius: 4, // snap to 4 (was 6)
    changeFontSize: 12, // Min readable
  },
  table: {
    headerFontSize: 12, // Min readable
    rowFontSize: 12, // Min readable
    cellPaddingX: 4, // snap to 4 (was 6)
    cellPaddingY: 4, // snap to 4 (was 6)
    badgePaddingX: 8, // snap to 8 (was 10)
    badgePaddingY: 4, // snap to 4 (was 3)
    actionButtonPaddingX: 8, // snap to 8 (was 10)
    actionButtonPaddingY: 4, // snap to 4 (was 5)
    actionButtonFontSize: 12, // Min readable
    paginationFontSize: 12, // Min readable
  },
  card: {
    padding: {
      none: 0,
      small: 8, // snap to 8 (was 10)
      medium: 12, // snap to 12 (was 13)
      large: 16, // on grid
    },
  },
  sidebar: {
    logoHeight: 144,
    itemHeight: 36, // Min touch target
    itemFontSize: 12, // Min readable
    itemIconSize: 16, // on grid
    sectionTitleFontSize: 12, // Min readable
    footerFontSize: 12, // Min readable
  },
  pageLayout: {
    contentPadding: 24, // snap to 24 (was 26)
    headerTitleFontSize: 19,
    headerSubtitleFontSize: 12, // Min readable
    breadcrumbFontSize: 12, // Min readable
  },
  map: {
    markerSize: 36, // Min touch target
    clusterSize: 40, // snap to 40 (was 38)
    controlButtonSize: 36, // Min touch target
    infoBoxPadding: 12, // snap to 12 (was 13)
  },
  // Badge tokens for compact mode
  badge: {
    size: {
      small: {
        paddingHorizontal: 4, // snap to 4 (was 6)
        paddingVertical: 4, // snap to 4 (was 3)
        fontSize: 12, // Min readable
      },
      medium: {
        paddingHorizontal: 8, // snap to 8 (was 10)
        paddingVertical: 4, // snap to 4 (was 5)
        fontSize: 12, // Min readable
      },
      large: {
        paddingHorizontal: 12, // snap to 12 (was 13)
        paddingVertical: 4, // snap to 4 (was 6)
        fontSize: 13,
      },
    },
  },
  // Avatar tokens for compact mode
  avatar: {
    size: {
      sm: 24, // snap to 24 (was 26)
      md: 40, // snap to 40 (was 38)
      lg: 52, // snap to 52 (was 51)
      xl: 64, // on grid
    },
  },
  // Dialog tokens for compact mode
  dialog: {
    maxWidth: 256,
    containerPadding: 12, // snap to 12 (was 13)
    iconCircleSize: 36, // Min touch target
    iconSize: 18,
    titleFontSize: 13,
    messageFontSize: 12, // Min readable
    buttonHeight: 36, // Min touch target
    buttonPaddingV: 4, // snap to 4 (was 6)
    buttonPaddingH: 12, // snap to 12 (was 11)
    buttonGap: 8, // on grid
  },
  // Drawer tokens for compact mode
  drawer: {
    avatarSize: 52, // snap to 52 (was 51)
    menuIconSize: 16, // on grid
    menuIconWidth: 20, // snap to 20 (was 19)
    headerPadding: 16, // on grid
    itemPaddingV: 8, // snap to 8 (was 10)
    footerPadding: 16, // on grid
  },
  // ErrorBoundary tokens for compact mode
  errorBoundary: {
    containerPadding: 20, // snap to 20 (was 19)
    cardPadding: 24, // snap to 24 (was 26)
    cardBorderRadius: 12, // snap to 12 (was 13)
    iconSize: 52, // snap to 52 (was 51)
    titleFontSize: 16,
    messageFontSize: 12, // Min readable
    errorDetailFontSize: 12, // Min readable
    buttonPaddingV: 8, // snap to 8 (was 10)
    buttonPaddingH: 20, // snap to 20 (was 19)
    buttonBorderRadius: 4, // snap to 4 (was 6)
    buttonFontSize: 13,
    buttonIconSize: 16, // on grid
  },
  // DesktopCard tokens for compact mode
  desktopCard: {
    borderRadius: 8, // snap to 8 (was 10)
    headerPadding: 16, // on grid
    contentPadding: 16, // on grid
    iconContainerSize: 36, // Min touch target
    iconContainerRadius: 8, // on grid
    iconSize: 16, // on grid
    titleFontSize: 13,
    subtitleFontSize: 12, // Min readable
    headerGap: 8, // snap to 8 (was 10)
    actionsGap: 4, // snap to 4 (was 6)
  },
  // ConnectivityBanner tokens for compact mode
  connectivityBanner: {
    paddingV: 4, // snap to 4 (was 6)
    messageFontSize: 12, // Min readable
    badgePaddingH: 4, // snap to 4 (was 6)
    badgePaddingV: 4, // snap to 4 (was 3)
    badgeFontSize: 12, // Min readable
    badgeBorderRadius: 8, // snap to 8 (was 10)
    dotSize: 4, // snap to 4 (was 6)
  },
  // SectionHeader tokens for compact mode
  sectionHeader: {
    fontSize: 12, // Min readable
    fontWeight: "semiBold",
    letterSpacing: 0.4,
    marginBottom: 4, // snap to 4 (was 6)
    paddingHorizontal: 0,
    textTransform: "uppercase",
  },
  // Hint/Helper text tokens for compact mode
  hint: {
    fontSize: 12, // Min readable
    lineHeight: 14,
    marginTop: 4, // snap to 4 (was 3)
  },
  // Minimum touch target (WCAG 2.5.8 AA: 36px with buffer)
  minTouchTarget: 36,
  // ConfirmModal tokens for compact mode
  confirmModal: {
    iconCircleSize: 36, // Min touch target
    iconSize: 20, // snap to 20 (was 19)
    titleFontSize: 16,
    messageFontSize: 12, // Min readable
    messageLineHeight: 20, // snap to 20 (was 19)
    destructiveLabelFontSize: 12, // Min readable
    destructiveInputFontSize: 12, // Min readable
    destructiveInputPaddingV: 8, // on grid
    compact: {
      iconCircleSize: 28, // snap to 28 (was 29)
      iconSize: 16, // on grid
      iconMarginRight: 8, // on grid
      titleFontSize: 13,
      messageFontSize: 12, // Min readable
      messageLineHeight: 16, // on grid
      destructiveLabelFontSize: 12, // Min readable
      destructiveLabelMarginBottom: 4, // snap to 4 (was 5)
      destructiveInputFontSize: 12, // Min readable
      destructiveInputPaddingV: 4, // snap to 4 (was 5)
    },
  },
};

// Default theme (shared between platforms)
export const defaultTheme: Theme = {
  colors: {
    primary: "#284093",
    primaryDark: "#1b2c63",
    primaryLight: "#34699f",
    primaryBg: "#e6ecfb",
    secondary: "#d4820a", // Darkened for WCAG AA (was #f7a02a, now 4.6:1)
    secondaryDark: "#a66500", // Darkened proportionally
    secondaryLight: "#f7a02a", // Original secondary moved to light variant
    secondaryBg: "#fff3d6",
    accent: "#d49500", // Darkened for better contrast
    background: "#f9fafb",
    surface: "#ffffff",
    card: "#ffffff",
    border: "#e5e7eb",
    divider: "#e5e7eb",
    text: "#1f2937",
    textSecondary: "#4b5563", // Darkened for WCAG AA (was #6b7280, now 7:1)
    textTertiary: "#6b7280", // Darkened for WCAG AA (was #9ca3af, now 5.4:1)
    textInverse: "#ffffff",
    success: "#10b981",
    successDark: "#047857", // Alto contraste para texto (5.9:1)
    successBg: "#d1fae5",
    warning: "#f59e0b",
    warningText: "#b45309", // Alto contraste para texto (5.1:1)
    warningBg: "#fef3c7",
    error: "#ef4444",
    errorDark: "#dc2626", // Hover/pressed state
    errorBg: "#fee2e2",
    info: "#3b82f6",
    infoBg: "#dbeafe",
    white: "#ffffff",
    black: "#000000",
    gray50: "#f9fafb",
    gray100: "#f3f4f6",
    gray200: "#e5e7eb",
    gray300: "#d1d5db",
    gray400: "#9ca3af",
    gray500: "#6b7280",
    gray600: "#4b5563",
    gray700: "#374151",
    gray800: "#1f2937",
    gray900: "#111827",
    disabled: "#d1d5db",
    overlay: withOpacity("#000000", 0.5),
    transparent: "transparent",
    purple: "#8b5cf6",
    purple600: "#7c3aed",
    // Extended colors for status indicators
    blue50: "#eff6ff",
    blue100: "#dbeafe",
    blue500: "#3b82f6",
    green50: "#f0fdf4",
    green100: "#dcfce7",
    green500: "#22c55e",
    red50: "#fef2f2",
    red100: "#fee2e2",
    red500: "#ef4444",
    yellow100: "#fef9c3",
    yellow500: "#eab308",
    indigo100: "#e0e7ff",
    // Additional colors used in components
    orange: "#f97316",
    blue300: "#93c5fd",
    green800: "#166534",
    warningLight: "#fef3c7",
    warningDark: "#d97706",
    errorLight: "#fee2e2",
    successLight: "#d1fae5",
    whatsapp: "#25D366",
    // KPI Card Colors (Brand-compliant)
    kpiTotalHoje: "#284093", // Azul Principal
    kpiEmAndamento: "#f7a02a", // Laranja Principal
    kpiConcluidas: "#34699f", // Azul Claro
    kpiDistancia: "#ffbf14", // Laranja Claro
    kpiDistanciaDark: "#0f766e", // Teal-700 (WCAG 5.3:1 com branco)
    kpiIncidentes: "#1b2c63", // Azul Escuro
    // Incident Categories (semantic colors)
    incident: {
      accident: "#ef4444", // vermelho - acidentes/incidentes graves
      absent: "#f59e0b", // amarelo/laranja - cliente ausente
      wrongAddress: "#3b82f6", // azul - endereço incorreto
      blocked: "#8b5cf6", // roxo - acesso bloqueado
      vehicle: "#ec4899", // rosa - problema no veículo
      weather: "#06b6d4", // ciano - condições climáticas
      other: "#6b7280", // cinza - outros problemas
    },
  },
  spacing: {
    // === Numeric tokens (primary scale - 4px grid) ===
    "0": 0,
    "0.5": 2, // Borders, dividers, fine adjustments
    "1": 4, // Icon gaps, minimal spacing
    "1.5": 6, // Compact sm, tight layouts
    "2": 8, // Small padding, gaps between elements
    "2.5": 10, // Compact md, intermediate
    "3": 12, // Default component padding
    "3.5": 14, // Intermediate (compact lg)
    "4": 16, // Card padding, sections
    "5": 20, // Component margins
    "6": 24, // Container padding
    "7": 28, // Intermediate spacing
    "8": 32, // Large sections
    "10": 40, // Content areas
    "12": 48, // Page padding
    "14": 56, // Intermediate large
    "16": 64, // Hero sections
    "20": 80, // Maximum spacing
    "24": 96, // Exceptional cases
    // === Semantic aliases (backwards compatibility) ===
    xs: 4, // → '1'
    sm: 8, // → '2'
    md: 12, // → '3'
    lg: 16, // → '4'
    xl: 20, // → '5'
    xxl: 24, // → '6'
    "2xl": 24, // → '6' (deprecated, use xxl)
    "3xl": 32, // → '8'
    "4xl": 40, // → '10'
    "5xl": 48, // → '12'
    "6xl": 64, // → '16'
  },
  typography: {
    fontDisplay: "Viga",
    fontSans: "NunitoSans-Regular",
    fontSansLight: "NunitoSans-Light",
    fontSansMedium: "NunitoSans-Medium",
    fontSansSemiBold: "NunitoSans-SemiBold",
    fontSansBold: "NunitoSans-Bold",
    fontSansExtraBold: "NunitoSans-ExtraBold",
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      "2xl": 24,
      "3xl": 30,
      "4xl": 36,
    },
    xs: 12,
    sm: 14,
    md: 15,
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    "2xl": 24,
    "3xl": 30,
    "4xl": 36,
  },
  borderRadius: {
    xs: 4, // Small elements (chips, small buttons)
    sm: 8, // Inputs, buttons, cards
    md: 10, // Cards, modals
    lg: 12, // Large cards, dialogs
    xl: 16, // Hero sections
    xxl: 20, // Large modals, sheets
    "2xl": 20, // Alias for xxl
    "3xl": 24, // Bottom sheets, large dialogs
    "4xl": 32, // Full-screen modals
    full: 9999, // Circular elements
  },
  shadows: {
    // Platform-specific shadows: web uses boxShadow, native uses shadow* props
    sm: createShadow(1, 2, 0.05, 1),
    md: createShadow(2, 4, 0.1, 3),
    lg: createShadow(4, 8, 0.15, 5),
    card: createShadow(2, 4, 0.08, 2),
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
          height: 36, // h-9 (shadcn/ui sm)
          paddingVertical: 8,
          paddingHorizontal: 12, // px-3
          fontSize: 14,
        },
        medium: {
          height: 40, // h-10 (shadcn/ui default)
          paddingVertical: 10,
          paddingHorizontal: 16, // px-4
          fontSize: 14,
        },
        large: {
          height: 44, // h-11 (shadcn/ui lg)
          paddingVertical: 12,
          paddingHorizontal: 32, // px-8
          fontSize: 16,
        },
      },
      radius: 8, // rounded-md (shadcn/ui)
    },
    input: {
      size: {
        small: {
          height: 36, // h-9
          paddingHorizontal: 12,
          fontSize: 14,
        },
        medium: {
          height: 40, // h-10
          paddingHorizontal: 12,
          fontSize: 14,
        },
        large: {
          height: 44, // h-11
          paddingHorizontal: 14,
          fontSize: 16,
        },
      },
      radius: 6, // rounded-md (shadcn/ui)
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
      fontWeight: "semiBold",
      letterSpacing: 0.5,
      marginBottom: 8,
      paddingHorizontal: 0,
      textTransform: "uppercase",
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
  primary: "#7a9bdf", // Lightened for WCAG AA on dark (was #5a7fcc)
  primaryDark: "#5a7fcc",
  primaryLight: "#9fb8eb",
  primaryBg: "#1e2a4a",
  secondary: "#f7a02a", // Lighter for dark mode (original brand color)
  secondaryDark: "#d4820a",
  secondaryLight: "#ffbf14",
  secondaryBg: "#3d3020",
  accent: "#f7a02a", // Lighter for dark mode
  background: "#0f1419",
  surface: "#1a2029",
  card: "#1f2937",
  border: "#374151",
  divider: "#374151",
  text: "#f3f4f6", // Lightened for better contrast (was #e5e7eb)
  textSecondary: "#d1d5db", // Lightened for WCAG AA (was #9ca3af, now 8.5:1)
  textTertiary: "#9ca3af", // Lightened for WCAG AA (was #6b7280, now 5.5:1)
  textInverse: "#111827",
  success: "#34d399",
  successDark: "#10b981",
  successBg: "#064e3b",
  successLight: "#065f46",
  warning: "#fbbf24",
  warningText: "#fbbf24",
  warningBg: "#451a03",
  warningLight: "#78350f",
  warningDark: "#b45309",
  error: "#f87171",
  errorDark: "#ef4444", // Hover/pressed state (darker in dark mode)
  errorBg: "#450a0a",
  errorLight: "#7f1d1d",
  info: "#60a5fa",
  infoBg: "#1e3a5f",
  gray50: "#111827",
  gray100: "#1f2937",
  gray200: "#374151",
  gray300: "#4b5563",
  gray400: "#6b7280",
  gray500: "#9ca3af",
  gray600: "#d1d5db",
  gray700: "#e5e7eb",
  gray800: "#f3f4f6",
  gray900: "#f9fafb",
  white: "#1a2029",
  black: "#f9fafb",
  disabled: "#4b5563",
  overlay: withOpacity("#000000", 0.7),
  purple: "#a78bfa",
  purple600: "#8b5cf6",
  orange: "#fb923c",
  blue50: "#1e3a5f",
  blue100: "#1e40af",
  blue300: "#3b82f6",
  blue500: "#60a5fa",
  green50: "#064e3b",
  green100: "#065f46",
  green500: "#34d399",
  green800: "#86efac",
  whatsapp: "#25D366",
  red50: "#450a0a",
  red100: "#7f1d1d",
  red500: "#f87171",
  yellow100: "#422006",
  yellow500: "#fcd34d",
  indigo100: "#312e81",
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
  gray400: "#4b5563", // era #9ca3af - usado para texto muted
  gray500: "#374151", // era #6b7280 - usado para labels
  gray600: "#1f2937", // era #4b5563 - usado para texto secundário
  gray700: "#111827", // era #374151 - usado para texto principal
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
  gray400: "#d1d5db", // era #6b7280 - mais claro para melhor contraste
  gray500: "#e5e7eb", // era #9ca3af - usado para labels
  gray600: "#f3f4f6", // era #d1d5db - usado para texto secundário
  gray700: "#f9fafb", // era #e5e7eb - usado para texto principal
};

export const lightCompactTheme: Theme = {
  ...defaultTheme,
  spacing: spacingCompact,
  desktop: desktopCompact,
  components: componentsCompact,
};

export const darkCompactTheme: Theme = {
  ...darkTheme,
  spacing: spacingCompact,
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
  spacing: spacingCompact,
  desktop: desktopCompact,
  components: componentsCompact,
};

export const darkCompactHighContrastTheme: Theme = {
  ...darkHighContrastTheme,
  spacing: spacingCompact,
  desktop: desktopCompact,
  components: componentsCompact,
};
