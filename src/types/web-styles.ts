/**
 * Web-specific CSS style types for React Native Web
 *
 * These types extend React Native styles with web-specific CSS properties
 * that are only available when running on the web platform.
 */

import type { ViewStyle, TextStyle } from 'react-native';

/**
 * Web-specific CSS properties for ViewStyle
 */
export interface WebViewStyle {
  // Cursor styles
  cursor?:
    | 'auto'
    | 'default'
    | 'pointer'
    | 'wait'
    | 'text'
    | 'move'
    | 'not-allowed'
    | 'grab'
    | 'grabbing';

  // CSS Transitions
  transitionProperty?: string;
  transitionDuration?: string;
  transitionTimingFunction?: string;
  transitionDelay?: string;
  transition?: string;

  // Box shadow (string format for web)
  boxShadow?: string;

  // Outline (for focus states)
  outlineWidth?: number;
  outlineStyle?: 'none' | 'solid' | 'dashed' | 'dotted';
  outlineColor?: string;
  outlineOffset?: number;
  outline?: string;

  // User interaction
  userSelect?: 'none' | 'auto' | 'text' | 'all';
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';

  // Overflow
  overflowX?: 'visible' | 'hidden' | 'scroll' | 'auto';
  overflowY?: 'visible' | 'hidden' | 'scroll' | 'auto';

  // Scroll behavior
  scrollBehavior?: 'auto' | 'smooth';

  // Touch action
  touchAction?: 'auto' | 'none' | 'pan-x' | 'pan-y' | 'manipulation';
}

/**
 * Web-specific CSS properties for TextStyle
 */
export interface WebTextStyle {
  // Text rendering
  textRendering?: 'auto' | 'optimizeSpeed' | 'optimizeLegibility' | 'geometricPrecision';

  // Font smoothing
  WebkitFontSmoothing?: 'auto' | 'none' | 'antialiased' | 'subpixel-antialiased';
  MozOsxFontSmoothing?: 'auto' | 'grayscale';

  // Text overflow
  textOverflow?: 'clip' | 'ellipsis';
  whiteSpace?: 'normal' | 'nowrap' | 'pre' | 'pre-wrap' | 'pre-line';

  // Word break
  wordBreak?: 'normal' | 'break-all' | 'keep-all' | 'break-word';
  overflowWrap?: 'normal' | 'break-word' | 'anywhere';
}

/**
 * Combined style type for web platform
 * Use this when you need both React Native and web-specific styles
 */
export type WebCompatibleViewStyle = ViewStyle & WebViewStyle;
export type WebCompatibleTextStyle = TextStyle & WebTextStyle;

/**
 * PressableState with web-specific hovered property
 * React Native Web extends PressableStateCallbackType with hovered
 */
export interface PressableStateWithHover {
  pressed: boolean;
  hovered?: boolean;
}
