import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export interface ResponsiveHook {
  /** Largura atual da janela */
  width: number;
  /** Altura atual da janela */
  height: number;
  /** É mobile? (< 768px) */
  isMobile: boolean;
  /** É tablet? (768px - 1023px) */
  isTablet: boolean;
  /** É desktop? (≥ 1024px) */
  isDesktop: boolean;
  /** É plataforma web? */
  isWeb: boolean;
  /** É plataforma nativa? (iOS ou Android) */
  isNative: boolean;
  /** Breakpoint atual */
  breakpoint: Breakpoint;
  /** Orientação (portrait ou landscape) */
  orientation: 'portrait' | 'landscape';
}

/**
 * Hook para detecção de responsividade e plataforma
 *
 * Breakpoints:
 * - Mobile: < 768px
 * - Tablet: 768px - 1023px
 * - Desktop: ≥ 1024px
 *
 * ✅ FIX: Usar useMemo para evitar recriação do objeto em cada render
 * Isso previne loops infinitos causados por mudanças de referência
 *
 * @example
 * ```tsx
 * const { isMobile, isDesktop, breakpoint } = useResponsive();
 *
 * return (
 *   <View>
 *     {isDesktop ? <SidebarLayout /> : <MobileLayout />}
 *   </View>
 * );
 * ```
 */
export function useResponsive(): ResponsiveHook {
  const { width, height } = useWindowDimensions();
  const platform = Platform.OS;

  // ✅ FIX: Memoizar o resultado para evitar recriação desnecessária do objeto
  // Apenas recria quando width, height ou platform mudam
  return useMemo(() => {
    // Calcular breakpoint baseado na largura
    const getBreakpoint = (w: number): Breakpoint => {
      if (w < 768) return 'mobile';
      if (w < 1024) return 'tablet';
      return 'desktop';
    };

    // Calcular orientação
    const getOrientation = (w: number, h: number): 'portrait' | 'landscape' => {
      return h > w ? 'portrait' : 'landscape';
    };

    const breakpoint = getBreakpoint(width);
    const orientation = getOrientation(width, height);

    return {
      width,
      height,
      isMobile: breakpoint === 'mobile',
      isTablet: breakpoint === 'tablet',
      isDesktop: breakpoint === 'desktop',
      isWeb: platform === 'web',
      isNative: platform === 'ios' || platform === 'android',
      breakpoint,
      orientation,
    };
  }, [width, height, platform]); // Apenas recria quando essas dependências mudam
}

/**
 * Helper para criar estilos responsivos
 *
 * @example
 * ```tsx
 * const { width } = useResponsive();
 * const styles = createResponsiveStyles(width);
 * ```
 */
export function createResponsiveStyles(width: number) {
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  return {
    isMobile,
    isTablet,
    isDesktop,
    // Grid columns
    gridColumns: isMobile ? 1 : isTablet ? 2 : isDesktop ? 4 : 4,
    // Container max width
    containerMaxWidth: isMobile ? '100%' : isTablet ? '100%' : 1280,
    // Padding horizontal
    paddingHorizontal: isMobile ? 16 : isTablet ? 24 : 32,
    // Card width
    cardWidth: isMobile ? '100%' : isTablet ? '48%' : '23%',
    // Font sizes
    fontSize: {
      h1: isMobile ? 24 : isTablet ? 28 : 32,
      h2: isMobile ? 20 : isTablet ? 22 : 24,
      h3: isMobile ? 18 : isTablet ? 20 : 20,
      body: isMobile ? 14 : 16,
      small: isMobile ? 12 : 14,
    },
  };
}
