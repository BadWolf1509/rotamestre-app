/**
 * usePiPPosition - PiP Position Persistence Hook
 *
 * Persists the user's preferred PiP (Picture-in-Picture) window position
 * across app sessions using AsyncStorage. When the user drags the PiP
 * to a new position, it's saved and restored on next app launch.
 *
 * ## Features
 * - **Persistence**: Saves position to AsyncStorage
 * - **Validation**: Validates loaded data has correct structure
 * - **Error handling**: Graceful fallback on storage errors
 * - **Loading state**: Indicates when initial position is being loaded
 *
 * ## Storage Key
 * `@rotamestre:pip_position`
 *
 * ## Data Format
 * ```json
 * { "x": 200, "y": 100 }
 * ```
 *
 * @example
 * ```tsx
 * function MyPiPComponent() {
 *   const { savedPosition, savePosition, isLoading } = usePiPPosition();
 *
 *   // Use savedPosition as initial position
 *   const [position, setPosition] = useState(
 *     savedPosition ?? { x: 100, y: 100 }
 *   );
 *
 *   // Save on drag end
 *   const handleDragEnd = (newPos) => {
 *     setPosition(newPos);
 *     savePosition(newPos);
 *   };
 * }
 * ```
 *
 * @see PictureInPictureMap for usage context
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { logger } from '@/lib/logger';

/** Storage key for PiP position */
const STORAGE_KEY = '@rotamestre:pip_position';

/** Screen position coordinates */
interface PiPPosition {
  /** X coordinate (pixels from left edge) */
  x: number;
  /** Y coordinate (pixels from top edge) */
  y: number;
}

/** Return type for usePiPPosition hook */
interface UsePiPPositionReturn {
  /** Saved position (undefined if no saved position or still loading) */
  savedPosition: PiPPosition | undefined;
  /** Save a new position to storage */
  savePosition: (position: PiPPosition) => Promise<void>;
  /** Whether initial position is being loaded from storage */
  isLoading: boolean;
  /** Clear saved position from storage */
  clearPosition: () => Promise<void>;
}

/**
 * Hook for persisting PiP window position across sessions.
 *
 * @returns Object containing saved position, save/clear functions, and loading state
 */
export function usePiPPosition(): UsePiPPositionReturn {
  const [savedPosition, setSavedPosition] = useState<PiPPosition | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar posição salva ao montar
  useEffect(() => {
    const loadPosition = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as PiPPosition;
          // Validar que é um objeto com x e y numéricos
          if (
            typeof parsed === 'object' &&
            typeof parsed.x === 'number' &&
            typeof parsed.y === 'number'
          ) {
            setSavedPosition(parsed);
          }
        }
      } catch (error) {
        logger.warn('usePiPPosition: Erro ao carregar posição:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPosition();
  }, []);

  // Salvar nova posição
  const savePosition = useCallback(async (position: PiPPosition) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(position));
      setSavedPosition(position);
    } catch (error) {
      logger.warn('usePiPPosition: Erro ao salvar posição:', error);
    }
  }, []);

  // Limpar posição salva
  const clearPosition = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setSavedPosition(undefined);
    } catch (error) {
      logger.warn('usePiPPosition: Erro ao limpar posição:', error);
    }
  }, []);

  return {
    savedPosition,
    savePosition,
    isLoading,
    clearPosition,
  };
}
