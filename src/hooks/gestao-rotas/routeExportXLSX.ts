/**
 * Route export utilities (XLSX / Excel)
 *
 * xlsx is loaded lazily via require() at function entry so that the ~0.6 MB
 * gzip weight is only paid when the user actually triggers an export.
 * require() inside an async function is compatible with jest.mock() because
 * Babel/jest-expo transforms ESM imports to require() calls at test time, so
 * jest.mock("xlsx", ...) intercepts both top-level imports and inline require().
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

// -----------------------------------------------------------------------
// MIME type constant so it is never duplicated across the file
// -----------------------------------------------------------------------
const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

interface ExportOptions {
  rotas: RotaHistorico[];
  filtroStatus: FiltroStatus;
  userId?: string;
}

/**
 * Export routes to XLSX (Excel) file.
 * Handles both web (Blob download) and mobile (base64 + expo-sharing).
 */
export async function exportRotasToXLSX({
  rotas,
  filtroStatus,
  userId,
}: ExportOptions): Promise<void> {
  try {
    if (rotas.length === 0) {
      showWarning("Atenção", "Não há rotas para exportar");
      return;
    }

    // Lazy-load xlsx: defers ~0.6 MB gzip from initial bundle to export-time.
    // jest.mock("xlsx", ...) intercepts this require() correctly in tests.
    const XLSX = require("xlsx") as typeof import("xlsx");

    const sheetData = buildSheetData(rotas);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, "Rotas");

    const dataAtual = new Date()
      .toLocaleDateString("pt-BR")
      .replace(/\//g, "-");
    const nomeArquivo = `gestao-rotas-${dataAtual}.xlsx`;

    if (Platform.OS === "web") {
      downloadXLSXWeb(XLSX, wb, nomeArquivo);
    } else {
      await shareXLSXMobile(XLSX, wb, nomeArquivo);
    }

    if (userId) {
      logExportAction(userId, rotas.length, filtroStatus);
    }

    if (Platform.OS === "web") {
      showSuccess("Sucesso", `${rotas.length} rotas exportadas com sucesso!`);
    }
  } catch (error) {
    logger.error("Erro ao exportar XLSX:", error);
    showError("Erro", "Não foi possível exportar os dados");
  }
}

// -----------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------

/**
 * Build the array-of-arrays for the worksheet (header + data rows).
 * Column names are in PT-BR to match the CSV export style.
 */
function buildSheetData(rotas: RotaHistorico[]): unknown[][] {
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
    rota.distancia_total ? Number(rota.distancia_total.toFixed(1)) : null,
    formatDateTimeBR(rota.iniciada_em, { showYear: true }),
    formatDateTimeBR(rota.concluida_em, { showYear: true }),
    ROTA_STATUS_LABELS[rota.status] || rota.status,
  ]);

  return [headers, ...rows];
}

/**
 * Trigger browser download of the workbook as .xlsx.
 */
function downloadXLSXWeb(
  XLSX: typeof import("xlsx"),
  wb: import("xlsx").WorkBook,
  fileName: string,
): void {
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], { type: XLSX_MIME_TYPE });
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
 * Write the workbook to a temp file and share it via expo-sharing.
 */
async function shareXLSXMobile(
  XLSX: typeof import("xlsx"),
  wb: import("xlsx").WorkBook,
  fileName: string,
): Promise<void> {
  const base64 = XLSX.write(wb, { bookType: "xlsx", type: "base64" }) as string;
  const fileUri = FileSystem.documentDirectory + fileName;

  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(fileUri, {
      mimeType: XLSX_MIME_TYPE,
      dialogTitle: "Exportar Relatório de Rotas (Excel)",
      UTI: "org.openxmlformats.spreadsheetml.sheet",
    });
  } else {
    showInfo("Arquivo Salvo", `O arquivo foi salvo em: ${fileUri}`);
  }
}

/**
 * Log the XLSX export action to the audit table.
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
        formato: "xlsx",
        plataforma: Platform.OS,
      },
    })
    .then(({ error }) => {
      if (error)
        logger.warn(
          "Falha ao registrar log de exportação XLSX:",
          error.message,
        );
    });
}
