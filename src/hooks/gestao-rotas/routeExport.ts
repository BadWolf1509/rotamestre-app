/**
 * Route export utilities (CSV)
 */

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { formatDateBR, formatDateTimeBR } from "@/lib/dateUtils";
import { logger } from "@/lib/logger";
import { ROTA_STATUS_LABELS, type FiltroStatus } from "@/lib/statusLabels";
import { supabase } from "@/lib/supabase";
import {
  showError,
  showInfo,
  showSuccess,
  showWarning,
} from "@/utils/errorHandling";

import type { RotaHistorico } from "./types";

interface ExportOptions {
  rotas: RotaHistorico[];
  filtroStatus: FiltroStatus;
  userId?: string;
}

/**
 * Export routes to CSV file
 * Handles both web (download) and mobile (share) platforms
 */
export async function exportRotasToCSV({
  rotas,
  filtroStatus,
  userId,
}: ExportOptions): Promise<void> {
  try {
    if (rotas.length === 0) {
      showWarning("Atenção", "Não há rotas para exportar");
      return;
    }

    const csvContent = buildCSVContent(rotas);
    const dataAtual = new Date()
      .toLocaleDateString("pt-BR")
      .replace(/\//g, "-");
    const nomeArquivo = `gestao-rotas-${dataAtual}.csv`;

    if (Platform.OS === "web") {
      downloadCSVWeb(csvContent, nomeArquivo);
    } else {
      await shareCSVMobile(csvContent, nomeArquivo);
    }

    // Log the export action
    if (userId) {
      logExportAction(userId, rotas.length, filtroStatus);
    }

    if (Platform.OS === "web") {
      showSuccess("Sucesso", `${rotas.length} rotas exportadas com sucesso!`);
    }
  } catch (error) {
    logger.error("Erro ao exportar:", error);
    showError("Erro", "Não foi possível exportar os dados");
  }
}

/**
 * Build CSV content from routes
 */
function buildCSVContent(rotas: RotaHistorico[]): string {
  const headers = [
    "Data",
    "Motorista",
    "Paradas Concluídas",
    "Total Paradas",
    "Distância (km)",
    "Iniciada em",
    "Concluída em",
    "Status",
  ];

  const rows = rotas.map((rota) => [
    formatDateBR(rota.data),
    rota.motorista_nome || "Sem motorista",
    rota.paradas_concluidas,
    rota.paradas_count,
    rota.distancia_total ? rota.distancia_total.toFixed(1) : "-",
    formatDateTimeBR(rota.iniciada_em, { showYear: true }),
    formatDateTimeBR(rota.concluida_em, { showYear: true }),
    ROTA_STATUS_LABELS[rota.status] || rota.status,
  ]);

  // BOM for UTF-8 compatibility with Excel
  return (
    "\uFEFF" +
    [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")
  );
}

/**
 * Download CSV file on web platform
 */
function downloadCSVWeb(csvContent: string, fileName: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Share CSV file on mobile platform
 */
async function shareCSVMobile(
  csvContent: string,
  fileName: string,
): Promise<void> {
  const fileUri = FileSystem.documentDirectory + fileName;

  await FileSystem.writeAsStringAsync(fileUri, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(fileUri, {
      mimeType: "text/csv",
      dialogTitle: "Exportar Relatório de Rotas",
      UTI: "public.comma-separated-values-text",
    });
  } else {
    showInfo("Arquivo Salvo", `O arquivo foi salvo em: ${fileUri}`);
  }
}

/**
 * Log export action to database
 */
function logExportAction(
  userId: string,
  totalRotas: number,
  filtroStatus: FiltroStatus,
): void {
  supabase
    .from("logs")
    .insert({
      usuario_id: userId,
      evento: "exportacao_rotas",
      detalhes: {
        total_rotas: totalRotas,
        filtro_status: filtroStatus,
        formato: "csv",
        plataforma: Platform.OS,
      },
    })
    .then(({ error }) => {
      if (error)
        logger.warn("Falha ao registrar log de exportação:", error.message);
    });
}
