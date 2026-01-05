/**
 * Shared Theme Type for both Native and Web
 */

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
    successDark: string;
    successBg: string;
    warning: string;
    warningText: string;
    warningBg: string;
    error: string;
    errorDark: string;
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
    purple600: string;
    // Extended colors for status indicators
    blue50: string;
    blue100: string;
    blue500: string;
    green50: string;
    green100: string;
    green500: string;
    red50: string;
    red100: string;
    red500: string;
    yellow100: string;
    yellow500: string;
    indigo100: string;
    // Additional colors used in components
    orange: string;
    blue300: string;
    green800: string;
    warningLight: string;
    warningDark: string;
    errorLight: string;
    successLight: string;
    whatsapp: string;
    // KPI Card Colors (Brand-compliant)
    kpiTotalHoje: string;
    kpiEmAndamento: string;
    kpiConcluidas: string;
    kpiDistancia: string;
    kpiIncidentes: string;
    // Incident Categories (semantic colors)
    incident: {
      accident: string;
      absent: string;
      wrongAddress: string;
      blocked: string;
      vehicle: string;
      weather: string;
      other: string;
    };
  };
  spacing: {
    // Numeric tokens (primary scale - 4px grid)
    '0': number;
    '0.5': number;  // 2px - borders, dividers
    '1': number;    // 4px - icon gaps
    '1.5': number;  // 6px - compact sm
    '2': number;    // 8px - small padding
    '2.5': number;  // 10px - compact md
    '3': number;    // 12px - default padding
    '3.5': number;  // 14px - intermediate
    '4': number;    // 16px - card padding
    '5': number;    // 20px - component margins
    '6': number;    // 24px - container padding
    '7': number;    // 28px - intermediate
    '8': number;    // 32px - sections
    '10': number;   // 40px - content areas
    '12': number;   // 48px - page padding
    '14': number;   // 56px - intermediate
    '16': number;   // 64px - hero sections
    '20': number;   // 80px - max spacing
    '24': number;   // 96px - exceptional
    // Semantic aliases (for backwards compatibility)
    xs: number;     // → '1' (4px)
    sm: number;     // → '2' (8px)
    md: number;     // → '3' (12px)
    lg: number;     // → '4' (16px)
    xl: number;     // → '5' (20px)
    xxl: number;    // → '6' (24px)
    '2xl': number;  // → '6' (24px) - deprecated, use xxl
    '3xl': number;  // → '8' (32px)
    '4xl': number;  // → '10' (40px)
    '5xl': number;  // → '12' (48px)
    '6xl': number;  // → '16' (64px)
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
    md: number;
    base: number;
    lg: number;
    xl: number;
    xxl: number;
    '2xl': number;
    '3xl': number;
    '4xl': number;
  };
  borderRadius: {
    xs: number;   // 4px - small elements (chips, small buttons)
    sm: number;   // 8px - inputs, buttons, cards
    md: number;   // 10px - cards, modals
    lg: number;   // 12px - large cards, dialogs
    xl: number;   // 16px - hero sections
    xxl: number;  // 20px - large modals, sheets
    '2xl': number; // 20px - alias for xxl
    '3xl': number; // 24px - bottom sheets, large dialogs
    '4xl': number; // 32px - full-screen modals
    full: number; // 9999 - circular elements
  };
  shadows: {
    sm: any;
    md: any;
    lg: any;
    card: any;
  };
  motion: {
    duration: {
      fast: number;
      normal: number;
      slow: number;
    };
    easing: {
      easeOut: string;
      easeIn: string;
      easeInOut: string;
    };
  };
  layout: {
    sidebarWidth: number;
    containerMaxWidth: number;
  };
  zIndex: {
    hide: number;
    base: number;
    dropdown: number;
    sticky: number;
    fixed: number;
    overlay: number;
    modal: number;
    popover: number;
    tooltip: number;
    toast: number;
    banner: number;
    max: number;
  };
  desktop: {
    input: {
      height: number;
      paddingHorizontal: number;
      fontSize: number;
    };
    button: {
      height: number;
      paddingHorizontal: number;
      fontSize: number;
    };
    field: {
      marginBottom: number;
    };
    section: {
      padding: number;
      gap: number;
    };
    modal: {
      headerPadding: number;
      bodyPadding: number;
      footerPadding: number;
      footerGap: number;
      titleFontSize: number;
      closeButtonSize: number;
    };
    dialog: {
      maxWidth: number;
      containerPadding: number;
      iconCircleSize: number;
      iconSize: number;
      titleFontSize: number;
      messageFontSize: number;
      buttonHeight: number;
      buttonPaddingV: number;
      buttonPaddingH: number;
      buttonGap: number;
    };
  };
  components: {
    button: {
      size: {
        small: {
          height: number;
          paddingVertical: number;
          paddingHorizontal: number;
          fontSize: number;
        };
        medium: {
          height: number;
          paddingVertical: number;
          paddingHorizontal: number;
          fontSize: number;
        };
        large: {
          height: number;
          paddingVertical: number;
          paddingHorizontal: number;
          fontSize: number;
        };
      };
      radius: number;
    };
    input: {
      size: {
        small: {
          height: number;
          paddingHorizontal: number;
          fontSize: number;
        };
        medium: {
          height: number;
          paddingHorizontal: number;
          fontSize: number;
        };
        large: {
          height: number;
          paddingHorizontal: number;
          fontSize: number;
        };
      };
      radius: number;
    };
    modal: {
      headerPadding: number;
      bodyPadding: number;
      footerPadding: number;
    };
    statsCard: {
      padding: number;
      radius: number;
      valueFontSize: number;
      labelFontSize: number;
      labelLetterSpacing: number;
      iconSize: number;
      iconContainerSize: number;
      iconContainerRadius: number;
      changeFontSize: number;
    };
    table: {
      headerFontSize: number;
      rowFontSize: number;
      cellPaddingX: number;
      cellPaddingY: number;
      badgePaddingX: number;
      badgePaddingY: number;
      actionButtonPaddingX: number;
      actionButtonPaddingY: number;
      actionButtonFontSize: number;
      paginationFontSize: number;
    };
    card: {
      padding: {
        none: number;
        small: number;
        medium: number;
        large: number;
      };
    };
    sidebar: {
      logoHeight: number;
      itemHeight: number;
      itemFontSize: number;
      itemIconSize: number;
      sectionTitleFontSize: number;
      footerFontSize: number;
    };
    pageLayout: {
      contentPadding: number;
      headerTitleFontSize: number;
      headerSubtitleFontSize: number;
      breadcrumbFontSize: number;
    };
    map: {
      markerSize: number;
      clusterSize: number;
      controlButtonSize: number;
      infoBoxPadding: number;
    };
    badge: {
      size: {
        small: {
          paddingHorizontal: number;
          paddingVertical: number;
          fontSize: number;
        };
        medium: {
          paddingHorizontal: number;
          paddingVertical: number;
          fontSize: number;
        };
        large: {
          paddingHorizontal: number;
          paddingVertical: number;
          fontSize: number;
        };
      };
    };
    avatar: {
      size: {
        sm: number;
        md: number;
        lg: number;
        xl: number;
      };
    };
    dialog: {
      maxWidth: number;
      containerPadding: number;
      iconCircleSize: number;
      iconSize: number;
      titleFontSize: number;
      messageFontSize: number;
      buttonHeight: number;
      buttonPaddingV: number;
      buttonPaddingH: number;
      buttonGap: number;
    };
    drawer: {
      avatarSize: number;
      menuIconSize: number;
      menuIconWidth: number;
      headerPadding: number;
      itemPaddingV: number;
      footerPadding: number;
    };
    errorBoundary: {
      containerPadding: number;
      cardPadding: number;
      cardBorderRadius: number;
      iconSize: number;
      titleFontSize: number;
      messageFontSize: number;
      errorDetailFontSize: number;
      buttonPaddingV: number;
      buttonPaddingH: number;
      buttonBorderRadius: number;
      buttonFontSize: number;
      buttonIconSize: number;
    };
    desktopCard: {
      borderRadius: number;
      headerPadding: number;
      contentPadding: number;
      iconContainerSize: number;
      iconContainerRadius: number;
      iconSize: number;
      titleFontSize: number;
      subtitleFontSize: number;
      headerGap: number;
      actionsGap: number;
    };
    connectivityBanner: {
      paddingV: number;
      messageFontSize: number;
      badgePaddingH: number;
      badgePaddingV: number;
      badgeFontSize: number;
      badgeBorderRadius: number;
      dotSize: number;
    };
    sectionHeader: {
      fontSize: number;
      fontWeight: string;
      letterSpacing: number;
      marginBottom: number;
      paddingHorizontal: number;
      textTransform: string;
    };
    hint: {
      fontSize: number;
      lineHeight: number;
      marginTop: number;
    };
    minTouchTarget: number;
    confirmModal: {
      iconCircleSize: number;
      iconSize: number;
      titleFontSize: number;
      messageFontSize: number;
      messageLineHeight: number;
      destructiveLabelFontSize: number;
      destructiveInputFontSize: number;
      destructiveInputPaddingV: number;
      compact: {
        iconCircleSize: number;
        iconSize: number;
        iconMarginRight: number;
        titleFontSize: number;
        messageFontSize: number;
        messageLineHeight: number;
        destructiveLabelFontSize: number;
        destructiveLabelMarginBottom: number;
        destructiveInputFontSize: number;
        destructiveInputPaddingV: number;
      };
    };
  };
}
