import { useState, useEffect } from 'react';
import { Dimensions, Platform } from 'react-native';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'largeDesktop';

export interface BreakpointState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isWeb: boolean;
}

/**
 * Hook para detecção de breakpoints responsivos
 *
 * Breakpoints:
 * - mobile: < 768px
 * - tablet: 768px - 1023px
 * - desktop: 1024px - 1439px
 * - largeDesktop: >= 1440px
 *
 * @example
 * const { isDesktop, isMobile, width } = useBreakpoint();
 *
 * if (isDesktop) {
 *   // Render desktop layout
 * }
 */
export const useBreakpoint = (): BreakpointState => {
  const [dimensions, setDimensions] = useState({
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({
        width: window.width,
        height: window.height,
      });
    });

    return () => {
      if (subscription?.remove) {
        subscription.remove();
      }
    };
  }, []);

  const { width, height } = dimensions;

  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024 && width < 1440;
  const isLargeDesktop = width >= 1440;

  let breakpoint: Breakpoint = 'mobile';
  if (isLargeDesktop) breakpoint = 'largeDesktop';
  else if (isDesktop) breakpoint = 'desktop';
  else if (isTablet) breakpoint = 'tablet';

  return {
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    width,
    height,
    breakpoint,
    isWeb: Platform.OS === 'web',
  };
};

/**
 * Retorna valores diferentes baseado no breakpoint atual
 *
 * @example
 * const spacing = useResponsiveValue({ mobile: 16, tablet: 24, desktop: 32 });
 */
export const useResponsiveValue = <T,>(values: {
  mobile: T;
  tablet?: T;
  desktop?: T;
  largeDesktop?: T;
}): T => {
  const { isTablet, isDesktop, isLargeDesktop } = useBreakpoint();

  if (isLargeDesktop && values.largeDesktop !== undefined) {
    return values.largeDesktop;
  }
  if (isDesktop && values.desktop !== undefined) {
    return values.desktop;
  }
  if (isTablet && values.tablet !== undefined) {
    return values.tablet;
  }
  return values.mobile;
};
