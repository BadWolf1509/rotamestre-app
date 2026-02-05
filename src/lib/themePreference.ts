import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';

import { logger } from '@/lib/logger';

export type ThemePreference = 'light' | 'dark';
export type ThemeDensityPreference = 'regular' | 'compact';
export type ThemeContrastPreference = 'normal' | 'high';

export type ThemePreferences = {
  mode: ThemePreference;
  density: ThemeDensityPreference;
  contrast: ThemeContrastPreference;
};

const THEME_PREFERENCE_KEY = '@rotamestre:theme_preference';
const DENSITY_PREFERENCE_KEY = '@rotamestre:density_preference';
const CONTRAST_PREFERENCE_KEY = '@rotamestre:contrast_preference';

let cachedPreferences: ThemePreferences | null = null;

function getRuntimeMode(): ThemePreference {
  const runtimeTheme = UnistylesRuntime.themeName;
  if (runtimeTheme?.startsWith('dark')) {
    return 'dark';
  }
  if (runtimeTheme?.startsWith('light')) {
    return 'light';
  }
  return UnistylesRuntime.colorScheme === 'dark' ? 'dark' : 'light';
}

type ThemeName =
  | 'light'
  | 'dark'
  | 'lightCompact'
  | 'darkCompact'
  | 'lightHighContrast'
  | 'darkHighContrast'
  | 'lightCompactHighContrast'
  | 'darkCompactHighContrast';

function resolveThemeName(preferences: ThemePreferences): ThemeName {
  let name: string = preferences.mode;
  if (preferences.density === 'compact') {
    name += 'Compact';
  }
  if (preferences.contrast === 'high') {
    name += 'HighContrast';
  }
  return name as ThemeName;
}

function applyWebTheme(preferences: ThemePreferences) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }

  document.documentElement.setAttribute('data-theme', preferences.mode);
  document.documentElement.setAttribute('data-density', preferences.density);
  document.documentElement.setAttribute('data-contrast', preferences.contrast);
  document.documentElement.style.colorScheme = preferences.mode;
}

export function applyThemePreferences(preferences: ThemePreferences) {
  cachedPreferences = preferences;
  UnistylesRuntime.setAdaptiveThemes(false);
  UnistylesRuntime.setTheme(resolveThemeName(preferences));
  applyWebTheme(preferences);
}

function getCachedPreferences(): ThemePreferences {
  return (
    cachedPreferences ?? {
      mode: getRuntimeMode(),
      density: 'regular',
      contrast: 'normal',
    }
  );
}

export function applyThemePreference(preference: ThemePreference) {
  const base = getCachedPreferences();
  const next = { ...base, mode: preference };
  applyThemePreferences(next);
}

export async function getThemePreferences(): Promise<ThemePreferences | null> {
  try {
    const [storedMode, storedDensity, storedContrast] = await Promise.all([
      AsyncStorage.getItem(THEME_PREFERENCE_KEY),
      AsyncStorage.getItem(DENSITY_PREFERENCE_KEY),
      AsyncStorage.getItem(CONTRAST_PREFERENCE_KEY),
    ]);

    if (!storedMode && !storedDensity && !storedContrast) {
      return null;
    }

    const mode = storedMode === 'dark' || storedMode === 'light' ? storedMode : getRuntimeMode();
    const density = storedDensity === 'compact' ? 'compact' : 'regular';
    const contrast = storedContrast === 'high' ? 'high' : 'normal';

    return { mode, density, contrast };
  } catch (error) {
    logger.warn('Failed to load theme preferences:', error);
  }

  return null;
}

export async function getThemePreference(): Promise<ThemePreference | null> {
  try {
    const stored = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch (error) {
    logger.warn('Failed to load theme preference:', error);
  }

  return null;
}

export async function setThemePreference(preference: ThemePreference): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
    const stored = await getThemePreferences();
    const next = stored ?? { mode: preference, density: 'regular', contrast: 'normal' };
    applyThemePreferences({ ...next, mode: preference });
  } catch (error) {
    logger.warn('Failed to save theme preference:', error);
  }
}

export async function setDensityPreference(preference: ThemeDensityPreference): Promise<void> {
  try {
    await AsyncStorage.setItem(DENSITY_PREFERENCE_KEY, preference);
    const stored = await getThemePreferences();
    const next = stored ?? { mode: getRuntimeMode(), density: preference, contrast: 'normal' };
    applyThemePreferences({ ...next, density: preference });
  } catch (error) {
    logger.warn('Failed to save density preference:', error);
  }
}

export async function setContrastPreference(preference: ThemeContrastPreference): Promise<void> {
  try {
    await AsyncStorage.setItem(CONTRAST_PREFERENCE_KEY, preference);
    const stored = await getThemePreferences();
    const next = stored ?? { mode: getRuntimeMode(), density: 'regular', contrast: preference };
    applyThemePreferences({ ...next, contrast: preference });
  } catch (error) {
    logger.warn('Failed to save contrast preference:', error);
  }
}
