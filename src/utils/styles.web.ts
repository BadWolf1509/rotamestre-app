/**
 * Web Styles
 *
 * Este arquivo usa StyleSheet nativo do React Native Web.
 * Não usa Unistyles para evitar problemas de compatibilidade.
 */

import { StyleSheet as RNStyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';

import { defaultTheme } from './styles.base';

import type { Theme } from './styles.types';

// Re-export for consistency
export { defaultTheme };

// Type for named styles - matches React Native's NamedStyles
type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

// Web StyleSheet wrapper that preserves literal types
export const StyleSheet = {
  create: <T extends NamedStyles<T> | NamedStyles<any>>(
    stylesOrFactory: T | ((_theme: Theme) => T)
  ): T => {
    if (typeof stylesOrFactory === 'function') {
      const styles = stylesOrFactory(defaultTheme);
      return RNStyleSheet.create(styles as any) as T;
    }
    return RNStyleSheet.create(stylesOrFactory as any) as T;
  },
  // Re-export absoluteFillObject from React Native
  absoluteFillObject: RNStyleSheet.absoluteFillObject,
  absoluteFill: RNStyleSheet.absoluteFill,
  hairlineWidth: RNStyleSheet.hairlineWidth,
  flatten: RNStyleSheet.flatten,
};

// Web useUnistyles hook
export const useUnistyles = () => ({
  theme: defaultTheme,
  breakpoint: 'xs' as const,
});

// Re-export Theme type
export type { Theme };