import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = '@rotamestre:pip_position';

interface PiPPosition {
  x: number;
  y: number;
}

interface UsePiPPositionReturn {
  /** Posição salva (pode ser undefined se não houver posição salva) */
  savedPosition: PiPPosition | undefined;
  /** Salvar nova posição */
  savePosition: (position: PiPPosition) => Promise<void>;
  /** Se está carregando a posição inicial */
  isLoading: boolean;
  /** Limpar posição salva */
  clearPosition: () => Promise<void>;
}

/**
 * Hook para persistir a posição preferida do PiP
 * Usa AsyncStorage para salvar a última posição após drag
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
        console.warn('usePiPPosition: Erro ao carregar posição:', error);
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
      console.warn('usePiPPosition: Erro ao salvar posição:', error);
    }
  }, []);

  // Limpar posição salva
  const clearPosition = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setSavedPosition(undefined);
    } catch (error) {
      console.warn('usePiPPosition: Erro ao limpar posição:', error);
    }
  }, []);

  return {
    savedPosition,
    savePosition,
    isLoading,
    clearPosition,
  };
}
