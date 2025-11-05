import { Dimensions } from 'react-native';

/**
 * Utilities para design responsivo e Progressive Enhancement
 */

export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  largeDesktop: 1440,
} as const;

/**
 * Retorna o breakpoint atual baseado na largura
 */
export const getCurrentBreakpoint = (): keyof typeof BREAKPOINTS => {
  const width = Dimensions.get('window').width;

  if (width >= BREAKPOINTS.largeDesktop) return 'largeDesktop';
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
};

/**
 * Verifica se a largura atual é >= breakpoint especificado
 */
export const isBreakpoint = (breakpoint: keyof typeof BREAKPOINTS): boolean => {
  const width = Dimensions.get('window').width;
  return width >= BREAKPOINTS[breakpoint];
};

/**
 * Spacing progressivo baseado em breakpoint
 */
export const getResponsiveSpacing = (base: number): number => {
  const width = Dimensions.get('window').width;

  if (width >= BREAKPOINTS.largeDesktop) {
    return base * 2.5; // 40px se base=16
  }
  if (width >= BREAKPOINTS.desktop) {
    return base * 2; // 32px se base=16
  }
  if (width >= BREAKPOINTS.tablet) {
    return base * 1.5; // 24px se base=16
  }
  return base; // 16px
};

/**
 * Typography scaling baseado em viewport
 */
export const getResponsiveFontSize = (baseMobile: number): number => {
  const width = Dimensions.get('window').width;

  if (width >= BREAKPOINTS.largeDesktop) {
    return baseMobile * 1.25; // 20px se base=16
  }
  if (width >= BREAKPOINTS.desktop) {
    return baseMobile * 1.125; // 18px se base=16
  }
  if (width >= BREAKPOINTS.tablet) {
    return baseMobile * 1.0625; // 17px se base=16
  }
  return baseMobile; // 16px
};

/**
 * Retorna número de colunas ideal para grid
 */
export const getGridColumns = (minColumnWidth: number = 300): number => {
  const width = Dimensions.get('window').width;
  const columns = Math.floor(width / minColumnWidth);
  return Math.max(1, Math.min(columns, 4)); // Min 1, max 4 colunas
};

/**
 * Calcula largura ideal para modais baseado em breakpoint
 */
export const getModalWidth = (): number => {
  const width = Dimensions.get('window').width;

  if (width >= BREAKPOINTS.largeDesktop) {
    return 800; // Modais maiores em telas grandes
  }
  if (width >= BREAKPOINTS.desktop) {
    return 600;
  }
  if (width >= BREAKPOINTS.tablet) {
    return 500;
  }
  return width * 0.9; // 90% em mobile
};

/**
 * Densidade de conteúdo (para listas, cards, etc)
 */
export const getContentDensity = (): 'comfortable' | 'normal' | 'compact' => {
  const width = Dimensions.get('window').width;

  if (width >= BREAKPOINTS.largeDesktop) return 'compact';
  if (width >= BREAKPOINTS.desktop) return 'normal';
  return 'comfortable';
};

/**
 * Helper para criar media queries CSS (web only)
 */
export const mediaQuery = {
  tablet: `@media (min-width: ${BREAKPOINTS.tablet}px)`,
  desktop: `@media (min-width: ${BREAKPOINTS.desktop}px)`,
  largeDesktop: `@media (min-width: ${BREAKPOINTS.largeDesktop}px)`,
  hover: '@media (hover: hover)',
};
