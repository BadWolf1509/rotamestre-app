/**
 * Hook para gerenciar exibição inteligente do swipe hint
 * Mostra o hint apenas nas primeiras interações, depois apenas ícones sutis
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = '@rotamestre:swipe_count';
const MAX_HINTS = 5; // Número máximo de vezes para mostrar o hint completo

interface UseSwipeHintResult {
  showFullHint: boolean; // Se deve mostrar o hint completo com texto
  showIconOnly: boolean; // Se deve mostrar apenas ícones
  hideCompletely: boolean; // Se deve esconder completamente (após muitas interações)
  swipeCount: number;
  incrementSwipeCount: () => Promise<void>;
  isLoading: boolean;
}

export function useSwipeHint(): UseSwipeHintResult {
  const [swipeCount, setSwipeCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar contagem do AsyncStorage
  useEffect(() => {
    const loadCount = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setSwipeCount(parseInt(stored, 10));
        }
      } catch (error) {
        console.error('Error loading swipe count:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCount();
  }, []);

  // Incrementar contagem após um swipe bem-sucedido
  const incrementSwipeCount = useCallback(async () => {
    try {
      const newCount = swipeCount + 1;
      setSwipeCount(newCount);
      await AsyncStorage.setItem(STORAGE_KEY, newCount.toString());
    } catch (error) {
      console.error('Error saving swipe count:', error);
    }
  }, [swipeCount]);

  // Determinar o que mostrar
  const showFullHint = swipeCount < MAX_HINTS;
  const showIconOnly = swipeCount >= MAX_HINTS && swipeCount < MAX_HINTS * 2;
  const hideCompletely = swipeCount >= MAX_HINTS * 2;

  return {
    showFullHint,
    showIconOnly,
    hideCompletely,
    swipeCount,
    incrementSwipeCount,
    isLoading,
  };
}

/**
 * Reseta o contador de swipe (útil para testes ou reset de preferências)
 */
export async function resetSwipeHint(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error resetting swipe hint:', error);
  }
}
