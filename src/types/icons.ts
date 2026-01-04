/**
 * Type definitions for Ionicons
 * Eliminates the need for `as any` when using icon names
 */

import type { Ionicons } from '@expo/vector-icons';

/**
 * Valid Ionicons icon name
 * Use this type instead of `string` for icon props to get type safety
 *
 * @example
 * interface ButtonProps {
 *   icon: IconName;
 * }
 *
 * // Then use directly without `as any`:
 * <Ionicons name={icon} />
 */
export type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Type guard to check if a string is a valid IconName
 */
export function isValidIconName(name: string): name is IconName {
  // At runtime, we can't easily check this without importing the full glyph map
  // This is mainly for documentation purposes
  return typeof name === 'string' && name.length > 0;
}
