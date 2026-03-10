/**
 * useTimelineLastSeen - Hook para gerenciar "último visto" na timeline
 *
 * Persiste o timestamp do último evento visto por rota usando AsyncStorage.
 * Permite identificar quais eventos são "novos" para o usuário.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect, useCallback } from "react";

import { logger } from "@/lib/logger";

const STORAGE_KEY_PREFIX = "@timeline_last_seen_";

interface UseTimelineLastSeenResult {
  /** Timestamp do último evento visto (ISO string) */
  lastSeenTimestamp: string | null;
  /** Se está carregando do storage */
  loading: boolean;
  /** Verifica se um timestamp é "novo" (mais recente que o último visto) */
  isNewEvent: (eventTimestamp: string) => boolean;
  /** Marca todos os eventos até o timestamp como vistos */
  markAsSeen: (timestamp: string) => Promise<void>;
  /** Marca o evento mais recente da lista como visto */
  markAllAsSeen: (events: Array<{ timestamp: string }>) => Promise<void>;
  /** Quantidade de eventos novos */
  countNewEvents: (events: Array<{ timestamp: string }>) => number;
}

/**
 * Hook para gerenciar estado de "último visto" na timeline
 *
 * @param rotaId - ID da rota para persistência isolada por rota
 * @param fallbackTimestamp - Timestamp de fallback quando não há lastSeen (ex: created_at da rota)
 * @returns Funções e estado para gerenciar eventos novos
 */
export function useTimelineLastSeen(
  rotaId: string,
  fallbackTimestamp?: string | null,
): UseTimelineLastSeenResult {
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const storageKey = `${STORAGE_KEY_PREFIX}${rotaId}`;

  // Timestamp efetivo: usa o salvo no storage, ou fallback (created_at da rota)
  const effectiveTimestamp = lastSeenTimestamp || fallbackTimestamp || null;

  // Carregar último visto do AsyncStorage
  useEffect(() => {
    async function loadLastSeen() {
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          setLastSeenTimestamp(stored);
        }
      } catch (error) {
        logger.error("[useTimelineLastSeen] Erro ao carregar:", error);
      } finally {
        setLoading(false);
      }
    }

    if (rotaId) {
      loadLastSeen();
    } else {
      setLoading(false);
    }
  }, [rotaId, storageKey]);

  /**
   * Verifica se um evento é "novo" (não visto ainda)
   * Usa effectiveTimestamp que pode ser:
   * 1. lastSeenTimestamp (salvo no storage) - prioridade
   * 2. fallbackTimestamp (created_at da rota) - quando não há storage
   * 3. null - retorna false (sem referência para comparar)
   */
  const isNewEvent = useCallback(
    (eventTimestamp: string): boolean => {
      if (!effectiveTimestamp) {
        // Sem timestamp de referência: não é possível determinar se é novo
        return false;
      }

      const eventDate = new Date(eventTimestamp).getTime();
      const referenceDate = new Date(effectiveTimestamp).getTime();

      return eventDate > referenceDate;
    },
    [effectiveTimestamp],
  );

  /**
   * Marca eventos até um timestamp como vistos
   */
  const markAsSeen = useCallback(
    async (timestamp: string): Promise<void> => {
      try {
        // Só atualiza se for mais recente que o atual
        if (
          !lastSeenTimestamp ||
          new Date(timestamp) > new Date(lastSeenTimestamp)
        ) {
          await AsyncStorage.setItem(storageKey, timestamp);
          setLastSeenTimestamp(timestamp);
        }
      } catch (error) {
        logger.error("[useTimelineLastSeen] Erro ao salvar:", error);
      }
    },
    [storageKey, lastSeenTimestamp],
  );

  /**
   * Marca todos os eventos da lista como vistos (usa o mais recente)
   */
  const markAllAsSeen = useCallback(
    async (events: Array<{ timestamp: string }>): Promise<void> => {
      if (events.length === 0) return;

      // Encontrar o timestamp mais recente
      const mostRecent = events.reduce((latest, event) => {
        const eventTime = new Date(event.timestamp).getTime();
        const latestTime = new Date(latest.timestamp).getTime();
        return eventTime > latestTime ? event : latest;
      }, events[0]);

      await markAsSeen(mostRecent.timestamp);
    },
    [markAsSeen],
  );

  /**
   * Conta quantos eventos são novos
   * Usa effectiveTimestamp como referência
   */
  const countNewEvents = useCallback(
    (events: Array<{ timestamp: string }>): number => {
      if (!effectiveTimestamp) {
        // Sem timestamp de referência: não é possível contar novos
        return 0;
      }

      return events.filter((event) => isNewEvent(event.timestamp)).length;
    },
    [effectiveTimestamp, isNewEvent],
  );

  return {
    lastSeenTimestamp,
    loading,
    isNewEvent,
    markAsSeen,
    markAllAsSeen,
    countNewEvents,
  };
}

/**
 * Limpa o cache de "último visto" para uma rota específica
 * Útil quando uma rota é deletada ou para debug
 */
export async function clearTimelineLastSeen(rotaId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${STORAGE_KEY_PREFIX}${rotaId}`);
  } catch (error) {
    logger.error("[clearTimelineLastSeen] Erro:", error);
  }
}

/**
 * Limpa todo o cache de "último visto" (todas as rotas)
 * Útil para logout ou reset completo
 */
export async function clearAllTimelineLastSeen(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const timelineKeys = allKeys.filter((key) =>
      key.startsWith(STORAGE_KEY_PREFIX),
    );
    if (timelineKeys.length > 0) {
      await Promise.all(timelineKeys.map((k) => AsyncStorage.removeItem(k)));
    }
  } catch (error) {
    logger.error("[clearAllTimelineLastSeen] Erro:", error);
  }
}
