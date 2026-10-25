/**
 * Posição em tempo real do motorista para o mapa do gestor — web
 * (`MapaWebMapLibre`) e nativo (`MotoristaMarker`) usam este mesmo hook.
 *
 * Só busca e assina a posição; quem chama desenha o marcador. Entre a atual e
 * uma que chegou vale a de `timestamp` do GPS maior (`posicaoMaisRecente`): a
 * fila offline reenvia posições antigas, e a carga inicial pode chegar depois
 * de um INSERT mais novo.
 *
 * Rules-of-hooks safe: always called unconditionally; when `rotaId` is
 * undefined the hook is a no-op and returns `{ location: null }`.
 */

import { useEffect, useState } from 'react';

import { logger } from '@/lib/logger';
import { posicaoMaisRecente } from '@/lib/motorista/posicaoDoMotorista';
import { nomeDeCanalUnico } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import type { MotoristaLocation } from '@/types/notifications';

interface UseMotoristaLocationMapLibreResult {
  location: MotoristaLocation | null;
}

interface UseMotoristaLocationMapLibreOptions {
  /** false = só a última posição conhecida, sem assinar o realtime. */
  realtime?: boolean;
}

export function useMotoristaLocationMapLibre(
  rotaId: string | undefined,
  { realtime = true }: UseMotoristaLocationMapLibreOptions = {},
): UseMotoristaLocationMapLibreResult {
  const [location, setLocation] = useState<MotoristaLocation | null>(null);

  // Load last known location when rotaId becomes available
  useEffect(() => {
    if (!rotaId) {
      setLocation(null);
      return;
    }

    let cancelled = false;

    const loadLastLocation = async () => {
      try {
        const { data, error } = await supabase
          .from('motorista_locations')
          .select('*')
          .eq('rota_id', rotaId)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          // maybeSingle() returns { data: null, error: null } when zero rows found — no PGRST116 guard needed
          logger.warn(
            '[useMotoristaLocationMapLibre] Location not available:',
            error.code,
          );
          return;
        }

        if (data) {
          const carregada = data as MotoristaLocation;
          setLocation((atual) => posicaoMaisRecente(atual, carregada));
        }
      } catch {
        logger.warn('[useMotoristaLocationMapLibre] Location unavailable');
      }
    };

    loadLastLocation();

    return () => {
      cancelled = true;
    };
  }, [rotaId]);

  // Subscribe to real-time INSERT events for this route
  useEffect(() => {
    if (!rotaId || !realtime) return;

    const channel = supabase
      .channel(nomeDeCanalUnico(`motorista-maplibre-${rotaId}`))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'motorista_locations',
          filter: `rota_id=eq.${rotaId}`,
        },
        (payload) => {
          const chegou = payload.new as MotoristaLocation;
          setLocation((atual) => posicaoMaisRecente(atual, chegou));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rotaId, realtime]);

  return { location };
}
