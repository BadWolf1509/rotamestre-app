/**
 * Lightweight hook for motorista real-time location — MapLibre web version.
 *
 * Unlike `useMotoristaTracking` (which is Google Maps-specific and manages
 * marker DOM elements internally), this hook only fetches and subscribes to
 * location data. The caller is responsible for rendering the map marker.
 *
 * Rules-of-hooks safe: always called unconditionally; when `rotaId` is
 * undefined the hook is a no-op and returns `{ location: null }`.
 */

import { useEffect, useState } from "react";

import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type { MotoristaLocation } from "@/types/notifications";

interface UseMotoristaLocationMapLibreResult {
  location: MotoristaLocation | null;
}

export function useMotoristaLocationMapLibre(
  rotaId: string | undefined,
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
          .from("motorista_locations")
          .select("*")
          .eq("rota_id", rotaId)
          .order("timestamp", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          // PGRST116 = no rows returned — expected when route has no locations yet
          if (error.code !== "PGRST116") {
            logger.warn(
              "[useMotoristaLocationMapLibre] Location not available:",
              error.code,
            );
          }
          return;
        }

        if (data) {
          setLocation(data as MotoristaLocation);
        }
      } catch {
        logger.warn("[useMotoristaLocationMapLibre] Location unavailable");
      }
    };

    loadLastLocation();

    return () => {
      cancelled = true;
    };
  }, [rotaId]);

  // Subscribe to real-time INSERT events for this route
  useEffect(() => {
    if (!rotaId) return;

    const channel = supabase
      .channel(`motorista-maplibre-${rotaId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "motorista_locations",
          filter: `rota_id=eq.${rotaId}`,
        },
        (payload) => {
          setLocation(payload.new as MotoristaLocation);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rotaId]);

  return { location };
}
