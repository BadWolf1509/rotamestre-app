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
    // KPI Card Colors (Brand-compliant)
    kpiTotalHoje: string;
    kpiEmAndamento: string;
    kpiConcluidas: string;
    kpiDistancia: string;
    kpiIncidentes: string;
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
  layout: {
    sidebarWidth: number;
    containerMaxWidth: number;
  };
}