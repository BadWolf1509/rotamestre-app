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
 * NOTE: pdfmake is imported at the top level (not lazily) for the same reason as
 * xlsx — the Jest CommonJS VM environment does not support native dynamic import().
 * Bundle-size limits in .size-limit.json have been bumped accordingly.
 */

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { Platform } from "react-native";

import { formatDateBR } from "@/lib/dateUtils";
import { logger } from "@/lib/logger";
import { showError, showInfo } from "@/utils/errorHandling";

// Bootstrap pdfmake with the bundled Roboto fonts
pdfMake.vfs = (pdfFonts as any).pdfMake?.vfs ?? pdfFonts;

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
 */
export async function exportRotaToPDF(rota: RotaParaPDF): Promise<void> {
  try {
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
function buildDocDefinition(rota: RotaParaPDF): object {
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
 */
function getPDFBase64(
  pdfDoc: ReturnType<typeof pdfMake.createPdf>,
): Promise<string> {
  return pdfDoc.getBase64();
}

/**
 * Write PDF to cache dir and share via expo-sharing.
 */
async function sharePDFMobile(
  pdfDoc: ReturnType<typeof pdfMake.createPdf>,
  fileName: string,
): Promise<void> {
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
