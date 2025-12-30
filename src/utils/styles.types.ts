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
    xs: number;
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
    };
  };
}
