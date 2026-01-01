import { useCallback } from 'react';
import { UnistylesRuntime } from 'react-native-unistyles';

import {
  ThemeDensityPreference,
  setDensityPreference,
} from '@/lib/themePreference';
import { useUnistyles } from '@/utils/styles';

interface UseThemeDensityReturn {
  /** Current density preference: 'regular' or 'compact' */
  density: ThemeDensityPreference;
  /** Whether current theme is compact */
  isCompact: boolean;
  /** Whether current theme is regular */
  isRegular: boolean;
  /** Density multiplier: 1 for regular, 0.8 for compact (based on Ant Design scale) */
  densityMultiplier: number;
  /** Set the density preference and persist it */
  setDensity: (density: ThemeDensityPreference) => Promise<void>;
  /** Toggle between regular and compact */
  toggleDensity: () => Promise<void>;
}

/**
 * Hook for working with theme density (regular vs compact).
 *
 * Provides:
 * - Current density value and boolean flags
 * - Density multiplier for custom calculations
 * - Functions to change and toggle density
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isCompact, densityMultiplier, toggleDensity } = useThemeDensity();
 *
 *   return (
 *     <View style={{ padding: 16 * densityMultiplier }}>
 *       <Button
 *         title={isCompact ? 'Switch to Regular' : 'Switch to Compact'}
 *         onPress={toggleDensity}
 *       />
 *     </View>
 *   );
 * }
 * ```
 */
export function useThemeDensity(): UseThemeDensityReturn {
  // Subscribe to theme changes to trigger re-renders when theme changes
  useUnistyles();

  // Derive density from current theme name (cheap computation, no need for memoization)
  const themeName = UnistylesRuntime.themeName ?? '';
  const density: ThemeDensityPreference = themeName.toLowerCase().includes('compact') ? 'compact' : 'regular';

  const isCompact = density === 'compact';
  const isRegular = density === 'regular';

  // Based on Ant Design's density scale: compact is ~80% of regular
  const densityMultiplier = isCompact ? 0.8 : 1;

  const setDensity = useCallback(async (newDensity: ThemeDensityPreference) => {
    await setDensityPreference(newDensity);
  }, []);

  const toggleDensity = useCallback(async () => {
    const newDensity = isCompact ? 'regular' : 'compact';
    await setDensityPreference(newDensity);
  }, [isCompact]);

  return {
    density,
    isCompact,
    isRegular,
    densityMultiplier,
    setDensity,
    toggleDensity,
  };
}
