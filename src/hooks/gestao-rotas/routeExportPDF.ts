/**
 * Route export utilities (PDF — delivery proof)
 *
 * Generates a per-route PDF with:
 *  - Header: route title, driver name, date
 *  - Summary: total stops vs completed stops
 *  - Table: order, address, status for each stop
 *
 * TODO (v2): Embed delivery proof photos. In v1 photos are skipped to keep
 * the PDF generation synchronous and dependency-light. Implementing this would
 * require fetching each foto_url as a data-URL and passing it to pdfmake as an
 * image node — straightforward but adds async complexity and file size.
 *
 * NOTE: pdfmake + vfs_fonts are loaded lazily via require() at function entry
 * so the ~0.5 MB gzip weight is deferred until the user actually exports a PDF.
 * This is safe with jest.mock() because Babel/jest-expo transforms ESM imports
 * to require() at test time, so jest.mock("pdfmake/...", ...) intercepts both
 * top-level imports and inline require() calls.
 *
 * Per-route wiring: exportRotaToPDF(rota) is intentionally a per-route function.
 * The list-level bulk PDF was removed (see useGestaoRotas.ts) because mapping
 * routes into the "paradas" field produced a misleading delivery-proof document.
 * Future: wire this from a route-detail screen or per-row action.
 */

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { formatDateBR } from "@/lib/dateUtils";
import { logger } from "@/lib/logger";
import { showError, showInfo } from "@/utils/errorHandling";

import type { TDocumentDefinitions } from "pdfmake/interfaces";

// -----------------------------------------------------------------------
// MIME type constant
// -----------------------------------------------------------------------
const PDF_MIME_TYPE = "application/pdf";

// -----------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------

export interface ParadaParaPDF {
  ordem: number;
  endereco: string;
  status: string;
  foto_url?: string;
}

export interface RotaParaPDF {
  id: string;
  titulo?: string;
  motorista?: string;
  data?: string;
  paradas: ParadaParaPDF[];
}

// -----------------------------------------------------------------------
// Main export function
// -----------------------------------------------------------------------

/**
 * Export a single route as a PDF delivery-proof document.
 * Handles both web (browser download) and mobile (expo-sharing).
 *
 * Intended to be called per-route (e.g. from a route detail screen or a
 * per-row action in the route list). The list-level bulk PDF export has
 * been removed because it produced a misleading document.
 */
export async function exportRotaToPDF(rota: RotaParaPDF): Promise<void> {
  try {
    // Lazy-load pdfmake: defers ~0.5 MB gzip from initial bundle to export-time.
    // jest.mock("pdfmake/build/pdfmake", ...) intercepts this require() in tests.
    //
    // pdfmake ships as a CommonJS module, but when bundled through Babel/metro
    // it may appear as either { default: ... } (ESM interop) or the object itself.
    // We normalise to whichever has createPdf.
    const pdfMakeRaw = require("pdfmake/build/pdfmake");
    const pdfFonts = require("pdfmake/build/vfs_fonts");

    // Handle both CJS (pdfMakeRaw.createPdf) and ESM-interop (pdfMakeRaw.default.createPdf)
    const pdfMake = (pdfMakeRaw?.default ?? pdfMakeRaw) as typeof pdfMakeRaw & {
      vfs: unknown;
    };
    pdfMake.vfs =
      (pdfFonts as any).pdfMake?.vfs ??
      (pdfFonts as any).default?.pdfMake?.vfs ??
      (pdfFonts as any).vfs ??
      pdfFonts;

    const docDefinition = buildDocDefinition(rota);
    const pdfDoc = pdfMake.createPdf(docDefinition);

    const dataAtual = new Date()
      .toLocaleDateString("pt-BR")
      .replace(/\//g, "-");
    const nomeArquivo = `comprovante-rota-${dataAtual}.pdf`;

    if (Platform.OS === "web") {
      pdfDoc.download(nomeArquivo);
    } else {
      await sharePDFMobile(pdfDoc, nomeArquivo);
    }
  } catch (error) {
    logger.error("Erro ao exportar PDF:", error);
    showError("Erro", "Não foi possível gerar o comprovante em PDF");
  }
}

// -----------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------

/**
 * Build the pdfmake document definition for a route.
 */
function buildDocDefinition(rota: RotaParaPDF): TDocumentDefinitions {
  const paradasConcluidas = rota.paradas.filter(
    (p) => p.status === "concluida",
  ).length;
  const totalParadas = rota.paradas.length;

  const titulo = rota.titulo || `Rota ${rota.id.substring(0, 8)}`;
  const motorista = rota.motorista || "Sem motorista";
  const data = rota.data ? formatDateBR(rota.data) : "-";

  // Table body: header row + data rows
  const tableBody = [
    // Header row
    [
      { text: "#", bold: true },
      { text: "Endereço", bold: true },
      { text: "Status", bold: true },
    ],
    // Data rows
    ...rota.paradas.map((parada) => [
      String(parada.ordem),
      parada.endereco,
      parada.status === "concluida"
        ? "Concluída"
        : parada.status === "pulada"
          ? "Pulada"
          : parada.status === "pendente"
            ? "Pendente"
            : parada.status,
    ]),
  ];

  return {
    content: [
      // ---- Title ----
      { text: titulo, style: "title" },
      { text: "\n" },

      // ---- Header info ----
      { text: [{ text: "Motorista: ", bold: true }, motorista] },
      { text: [{ text: "Data: ", bold: true }, data] },
      { text: "\n" },

      // ---- Summary ----
      { text: "Resumo", style: "sectionHeader" },
      {
        text: [
          { text: "Paradas concluídas: ", bold: true },
          `${paradasConcluidas} de ${totalParadas}`,
        ],
      },
      { text: "\n" },

      // ---- Stops table ----
      { text: "Paradas", style: "sectionHeader" },
      {
        table: {
          headerRows: 1,
          widths: [30, "*", 70],
          body: tableBody,
        },
        layout: "lightHorizontalLines",
      },
    ],
    styles: {
      title: {
        fontSize: 18,
        bold: true,
        margin: [0, 0, 0, 8],
      },
      sectionHeader: {
        fontSize: 13,
        bold: true,
        margin: [0, 8, 0, 4],
      },
    },
    defaultStyle: {
      fontSize: 11,
    },
  };
}

/**
 * Get base64 content from pdfmake document (returns a Promise).
 * pdfDoc typed as any because pdfmake's createPdf return type is complex and
 * the lazy-require pattern makes ReturnType<...> inference awkward.
 */

function getPDFBase64(pdfDoc: any): Promise<string> {
  return pdfDoc.getBase64();
}

/**
 * Write PDF to cache dir and share via expo-sharing.
 */

async function sharePDFMobile(pdfDoc: any, fileName: string): Promise<void> {
  const base64 = await getPDFBase64(pdfDoc);
  const fileUri = FileSystem.cacheDirectory + fileName;

  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(fileUri, {
      mimeType: PDF_MIME_TYPE,
      dialogTitle: "Exportar Comprovante de Entrega",
      UTI: "com.adobe.pdf",
    });
  } else {
    showInfo("Arquivo Salvo", `O arquivo foi salvo em: ${fileUri}`);
  }
}
