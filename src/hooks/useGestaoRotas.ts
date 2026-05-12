/**
 * Hook de gerenciamento de rotas para a tela de Gestão de Rotas
 *
 * Encapsula toda a lógica de estado e ações:
 * - Carregamento de rotas via Supabase
 * - Filtragem por status e busca textual
 * - Exclusão de rotas com confirmação
 * - Exportação para CSV e XLSX
 * - Atualização em tempo real
 * - Cache local para melhor UX (stale-while-revalidate)
 *
 * NOTE: PDF export is intentionally NOT exposed here. exportRotaToPDF() is a
 * per-route delivery-proof function (with real stop addresses). A list-level
 * bulk PDF would misuse that function by stuffing route summaries into the
 * paradas field. Wire exportRotaToPDF from a route-detail screen or per-row
 * action in a future PR — it is already exported from gestao-rotas/index.ts.
 *
 * Modular architecture:
 * - gestao-rotas/useRotasCache.ts: Cache management
 * - gestao-rotas/useRotasFiltering.ts: Filter and sort logic
 * - gestao-rotas/routeExport.ts: CSV export utility
 * - gestao-rotas/routeExportXLSX.ts: XLSX export utility
 * - gestao-rotas/routeExportPDF.ts: Per-route PDF export utility
 */

import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";

import { useRealtimeRoutes } from "@/hooks/useRealtimeRoutes";
import { useToast } from "@/hooks/useToast";
import { useUnidadeAtiva } from "@/hooks/useUnidadeAtiva";
import { useUser } from "@/hooks/useUser";
import { logger } from "@/lib/logger";
import {
  ROTA_STATUS_LABELS,
  FILTRO_STATUS_OPTIONS as FILTRO_OPTIONS,
  getRotaStatusLabel,
  type RotaStatus,
  type FiltroStatus,
} from "@/lib/statusLabels";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

import {
  useRotasCache,
  useRotasFiltering,
  exportRotasToCSV,
  exportRotasToXLSX,
} from "./gestao-rotas";

import type { RotaHistorico } from "./gestao-rotas";

// Re-export types for backwards compatibility
export type { RotaStatus, FiltroStatus, RotaHistorico };

// Constants (re-exports for backwards compatibility)
export const STATUS_LABELS = ROTA_STATUS_LABELS;
export const FILTRO_STATUS_OPTIONS = FILTRO_OPTIONS;

interface UseGestaoRotasOptions {
  statusColorMap: Record<RotaStatus, string>;
  defaultStatusColor: string;
}

export function useGestaoRotas(options: UseGestaoRotasOptions) {
  const { statusColorMap, defaultStatusColor } = options;

  const router = useRouter();
  const { userData } = useUser();
  const { unidadeAtiva } = useUnidadeAtiva();
  const { toast: toastState, showToast, hideToast, withToast } = useToast();

  // ============================================
  // STATE
  // ============================================

  const [rotas, setRotas] = useState<RotaHistorico[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state for delete confirmation
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [rotaToDelete, setRotaToDelete] = useState<RotaHistorico | null>(null);

  // Ref for AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  // ============================================
  // EXTRACTED HOOKS
  // ============================================

  // Cache management
  const { loadFromCache, saveToCache } = useRotasCache({
    unidadeId: unidadeAtiva,
  });

  // Filtering and sorting
  const {
    rotasFiltradas,
    filtroStatus,
    setFiltroStatus,
    searchQuery,
    setSearchQuery,
    sortColumn,
    sortDirection,
    handleSort,
  } = useRotasFiltering({ rotas });

  // ============================================
  // DATA LOADING
  // ============================================

  const loadRotas = useCallback(async () => {
    if (!unidadeAtiva) return;

    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Stale-while-revalidate: show cache first
    const cachedData = await loadFromCache();
    if (cachedData && cachedData.length > 0) {
      setRotas(cachedData);
      setLoading(false);
      // Continue to fetch fresh data in background
    }

    try {
      // Only show loading if no cache
      if (!cachedData || cachedData.length === 0) {
        setLoading(true);
      }

      // MOCK DATA FOR E2E/CI
      if (!isSupabaseConfigured) {
        logger.warn("[GestaoRotas] Mocking data for E2E/CI");
        await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate delay

        const mockRotas: RotaHistorico[] = [
          {
            id: "rota-1",
            data: new Date().toISOString(),
            status: "em_andamento",
            distancia_total: 15.5,
            iniciada_em: new Date().toISOString(),
            concluida_em: undefined,
            motorista_id: "mot-1",
            motorista_nome: "Motorista Teste 1",
            paradas_count: 10,
            paradas_concluidas: 4,
          },
          {
            id: "rota-2",
            data: new Date(Date.now() - 86400000).toISOString(),
            status: "concluida",
            distancia_total: 12.0,
            iniciada_em: new Date(Date.now() - 90000000).toISOString(),
            concluida_em: new Date(Date.now() - 86400000).toISOString(),
            motorista_id: "mot-2",
            motorista_nome: "Motorista Teste 2",
            paradas_count: 8,
            paradas_concluidas: 8,
          },
          {
            id: "rota-3",
            data: new Date().toISOString(),
            status: "pendente",
            distancia_total: 8.2,
            iniciada_em: undefined,
            concluida_em: undefined,
            motorista_id: undefined,
            motorista_nome: "Sem motorista",
            paradas_count: 5,
            paradas_concluidas: 0,
          },
        ];

        setRotas(mockRotas);
        setLoading(false);
        return;
      }

      // Fetch routes and stops in parallel (2 queries instead of N+1)
      const [rotasResult, paradasResult] = await Promise.all([
        supabase
          .from("rotas")
          .select(
            "id, data, status, distancia_total, iniciada_em, concluida_em, motorista_id, usuarios!rotas_motorista_id_fkey(id, nome)",
          )
          .eq("unidade_id", unidadeAtiva)
          .order("data", { ascending: false })
          .limit(100)
          .abortSignal(abortControllerRef.current.signal),
        supabase
          .from("paradas")
          .select("rota_id, status, is_checkpoint, rotas!inner(unidade_id)")
          .eq("rotas.unidade_id", unidadeAtiva)
          .abortSignal(abortControllerRef.current.signal),
      ]);

      if (rotasResult.error) throw rotasResult.error;

      // Create count map by rota_id
      const paradasPorRota = new Map<
        string,
        { total: number; concluidas: number }
      >();

      if (!paradasResult.error && paradasResult.data) {
        for (const parada of paradasResult.data) {
          if (parada.is_checkpoint === false) continue;

          const rotaId = parada.rota_id;
          if (!paradasPorRota.has(rotaId)) {
            paradasPorRota.set(rotaId, { total: 0, concluidas: 0 });
          }

          const stats = paradasPorRota.get(rotaId)!;
          stats.total++;
          if (parada.status === "concluida") {
            stats.concluidas++;
          }
        }
      }

      // Build final result
      const rotasComParadas: RotaHistorico[] = (rotasResult.data || []).map(
        (rota) => {
          const motorista = Array.isArray(rota.usuarios)
            ? rota.usuarios[0]
            : rota.usuarios;
          const stats = paradasPorRota.get(rota.id) || {
            total: 0,
            concluidas: 0,
          };

          return {
            id: rota.id,
            data: rota.data,
            status: rota.status,
            distancia_total: rota.distancia_total,
            iniciada_em: rota.iniciada_em,
            concluida_em: rota.concluida_em,
            motorista_id: motorista?.id,
            motorista_nome: motorista?.nome,
            paradas_count: stats.total,
            paradas_concluidas: stats.concluidas,
          };
        },
      );

      setRotas(rotasComParadas);

      // Save to cache for future use
      await saveToCache(rotasComParadas);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      // Only show error if no cached data
      if (!cachedData || cachedData.length === 0) {
        logger.error("Erro ao carregar rotas:", error);
        Alert.alert("Erro", "Não foi possível carregar as rotas");
      }
    } finally {
      setLoading(false);
    }
  }, [unidadeAtiva, loadFromCache, saveToCache]);

  // ============================================
  // EFFECTS
  // ============================================

  // Load routes on mount/unit change
  useEffect(() => {
    loadRotas();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadRotas]);

  // Realtime: Update when routes/stops change
  useRealtimeRoutes({
    enabled: !!unidadeAtiva,
    onRouteUpdate: () => {
      loadRotas();
    },
  });

  // ============================================
  // ACTIONS
  // ============================================

  const verDetalhes = useCallback(
    (rota: RotaHistorico) => {
      router.push({
        pathname: "/gestor/mapa-rota",
        params: { id: rota.id },
      });
    },
    [router],
  );

  const executarExclusao = useCallback(
    async (rota: RotaHistorico) => {
      if (!userData?.id) {
        showToast("Erro de autenticação. Faça login novamente.", "error");
        return;
      }

      const usuarioId = userData.id;

      try {
        await withToast(
          async () => {
            const { error } = await supabase
              .from("rotas")
              .delete()
              .eq("id", rota.id);

            if (error) throw error;

            await supabase.from("logs").insert({
              usuario_id: usuarioId,
              rota_id: rota.id,
              evento: "rota_excluida",
              detalhes: {
                motivo: "Excluída pelo gestor",
                motorista: rota.motorista_nome,
                paradas_count: rota.paradas_count,
                status_anterior: rota.status,
              },
            });
          },
          {
            loading: "Excluindo rota...",
            success: "Rota excluída com sucesso!",
            error: "Não foi possível excluir a rota",
          },
        );

        loadRotas();
      } catch (error) {
        logger.error("Erro ao excluir rota:", error);
      }
    },
    [userData?.id, showToast, withToast, loadRotas],
  );

  const excluirRota = useCallback(
    (rota: RotaHistorico) => {
      // Validation: don't allow deleting routes in progress
      if (rota.status === "em_andamento") {
        if (Platform.OS === "web") {
          showToast(
            "Não é possível excluir uma rota em andamento. Aguarde a conclusão ou cancele a rota primeiro.",
            "error",
            5000,
          );
        } else {
          Alert.alert(
            "Ação não permitida",
            "Não é possível excluir uma rota em andamento. Aguarde a conclusão ou cancele a rota primeiro.",
          );
        }
        return;
      }

      // Web: use custom modal
      if (Platform.OS === "web") {
        setRotaToDelete(rota);
        setShowConfirmModal(true);
      } else {
        // Mobile: use native Alert.alert
        const mensagem = `Tem certeza que deseja excluir esta rota?\n\nMotorista: ${rota.motorista_nome || "Sem motorista"}\nParadas: ${rota.paradas_count}\n\nEsta ação não pode ser desfeita.`;
        Alert.alert("Confirmar Exclusão", mensagem, [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Excluir",
            style: "destructive",
            onPress: () => executarExclusao(rota),
          },
        ]);
      }
    },
    [showToast, executarExclusao],
  );

  const handleConfirmDelete = useCallback(() => {
    setShowConfirmModal(false);
    if (rotaToDelete) {
      executarExclusao(rotaToDelete);
      setRotaToDelete(null);
    }
  }, [rotaToDelete, executarExclusao]);

  const handleCancelDelete = useCallback(() => {
    setShowConfirmModal(false);
    setRotaToDelete(null);
  }, []);

  const exportarParaCSV = useCallback(async () => {
    await exportRotasToCSV({
      rotas: rotasFiltradas,
      filtroStatus,
      userId: userData?.id,
    });
  }, [rotasFiltradas, filtroStatus, userData?.id]);

  const exportarParaXLSX = useCallback(async () => {
    await exportRotasToXLSX({
      rotas: rotasFiltradas,
      filtroStatus,
      userId: userData?.id,
    });
  }, [rotasFiltradas, filtroStatus, userData?.id]);

  // ============================================
  // HELPERS
  // ============================================

  const getStatusLabel = useCallback((status: RotaStatus | string): string => {
    return getRotaStatusLabel(status);
  }, []);

  const getStatusColor = useCallback(
    (status: RotaStatus | string): string => {
      return statusColorMap[status as RotaStatus] ?? defaultStatusColor;
    },
    [statusColorMap, defaultStatusColor],
  );

  // ============================================
  // RETURN
  // ============================================

  return {
    // State
    rotas,
    rotasFiltradas,
    loading,
    filtroStatus,
    searchQuery,
    showConfirmModal,
    rotaToDelete,
    userData,

    // State Setters
    setFiltroStatus,
    setSearchQuery,

    // Sorting
    sortColumn,
    sortDirection,
    handleSort,

    // Actions
    loadRotas,
    verDetalhes,
    excluirRota,
    handleConfirmDelete,
    handleCancelDelete,
    exportarParaCSV,
    exportarParaXLSX,

    // Helpers
    getStatusLabel,
    getStatusColor,

    // Toast
    toastState,
    showToast,
    hideToast,
  };
}
