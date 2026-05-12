/**
 * routeExportPDF - Tests
 */

import { Platform } from "react-native";

import { exportRotaToPDF } from "../routeExportPDF";

import type { RotaParaPDF } from "../routeExportPDF";

// -----------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("@/utils/errorHandling", () => ({
  showError: jest.fn(),
  showWarning: jest.fn(),
  showInfo: jest.fn(),
  showSuccess: jest.fn(),
}));

jest.mock("@/lib/dateUtils", () => ({
  formatDateBR: jest.fn((d: string) => d),
  formatDateTimeBR: jest.fn((d: string) => d),
}));

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "/test-docs/",
  cacheDirectory: "/test-cache/",
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: {
    Base64: "base64",
  },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock pdfmake — the key methods are download() and getBase64()
const mockPdfDoc = {
  download: jest.fn(),
  getBase64: jest.fn().mockResolvedValue("PDF_BASE64_DATA"),
};

jest.mock("pdfmake/build/pdfmake", () => ({
  __esModule: true,
  default: {
    vfs: {},
    createPdf: jest.fn(() => mockPdfDoc),
  },
}));

jest.mock("pdfmake/build/vfs_fonts", () => ({
  __esModule: true,
  default: { pdfMake: { vfs: {} } },
}));

// -----------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------

const mockRota: RotaParaPDF = {
  id: "rota-abc-123",
  titulo: "Entrega Centro",
  motorista: "João Silva",
  data: "2026-01-15",
  paradas: [
    { ordem: 1, endereco: "Rua A, 100", status: "concluida" },
    { ordem: 2, endereco: "Rua B, 200", status: "concluida" },
    { ordem: 3, endereco: "Rua C, 300", status: "pendente" },
  ],
};

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

describe("routeExportPDF", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock return
    mockPdfDoc.getBase64.mockResolvedValue("PDF_BASE64_DATA");
  });

  describe("exportRotaToPDF", () => {
    describe("document content", () => {
      beforeEach(() => {
        // Use web to avoid needing FileSystem + Sharing mocks for this group
        Object.defineProperty(Platform, "OS", { value: "web" });
      });

      it("calls createPdf with content array including title", async () => {
        const pdfMakeModule = require("pdfmake/build/pdfmake").default;

        await exportRotaToPDF(mockRota);

        expect(pdfMakeModule.createPdf).toHaveBeenCalledTimes(1);
        const [docDef] = pdfMakeModule.createPdf.mock.calls[0] as [any];
        expect(docDef.content).toBeDefined();
        expect(Array.isArray(docDef.content)).toBe(true);
        // Title should appear somewhere in the content
        const titleNode = docDef.content.find(
          (node: any) =>
            typeof node === "object" && node.text === "Entrega Centro",
        );
        expect(titleNode).toBeDefined();
      });

      it("includes motorista and date in doc definition", async () => {
        const pdfMakeModule = require("pdfmake/build/pdfmake").default;

        await exportRotaToPDF(mockRota);

        const [docDef] = pdfMakeModule.createPdf.mock.calls[0] as [any];
        const contentStr = JSON.stringify(docDef.content);
        expect(contentStr).toContain("João Silva");
        expect(contentStr).toContain("2026-01-15");
      });

      it("includes a table with paradas rows", async () => {
        const pdfMakeModule = require("pdfmake/build/pdfmake").default;

        await exportRotaToPDF(mockRota);

        const [docDef] = pdfMakeModule.createPdf.mock.calls[0] as [any];
        const tableNode = docDef.content.find((node: any) => node?.table);
        expect(tableNode).toBeDefined();
        // header row + 3 data rows
        expect(tableNode.table.body).toHaveLength(4);
        // First data row should have ordem 1 and the address
        expect(tableNode.table.body[1]).toContain("1");
        expect(tableNode.table.body[1]).toContain("Rua A, 100");
      });

      it("handles empty paradas gracefully", async () => {
        const pdfMakeModule = require("pdfmake/build/pdfmake").default;

        await exportRotaToPDF({ ...mockRota, paradas: [] });

        expect(pdfMakeModule.createPdf).toHaveBeenCalledTimes(1);
        const [docDef] = pdfMakeModule.createPdf.mock.calls[0] as [any];
        const tableNode = docDef.content.find((node: any) => node?.table);
        // Only header row when no paradas
        expect(tableNode.table.body).toHaveLength(1);
      });

      it("uses fallback title when titulo is not provided", async () => {
        const pdfMakeModule = require("pdfmake/build/pdfmake").default;

        await exportRotaToPDF({ ...mockRota, titulo: undefined });

        const [docDef] = pdfMakeModule.createPdf.mock.calls[0] as [any];
        const contentStr = JSON.stringify(docDef.content);
        // Should contain partial id as fallback
        expect(contentStr).toContain("rota-abc");
      });
    });

    describe("web platform", () => {
      beforeEach(() => {
        Object.defineProperty(Platform, "OS", { value: "web" });
      });

      it("calls pdfDoc.download() on web", async () => {
        await exportRotaToPDF(mockRota);

        expect(mockPdfDoc.download).toHaveBeenCalledTimes(1);
        expect(mockPdfDoc.download).toHaveBeenCalledWith(
          expect.stringContaining(".pdf"),
        );
      });

      it("does NOT call shareAsync on web", async () => {
        const Sharing = require("expo-sharing");

        await exportRotaToPDF(mockRota);

        expect(Sharing.shareAsync).not.toHaveBeenCalled();
      });
    });

    describe("mobile platform", () => {
      beforeEach(() => {
        Object.defineProperty(Platform, "OS", { value: "android" });
      });

      it("calls getBase64() on mobile", async () => {
        await exportRotaToPDF(mockRota);

        expect(mockPdfDoc.getBase64).toHaveBeenCalledTimes(1);
      });

      it("writes base64 to file system with .pdf extension", async () => {
        const FileSystem = require("expo-file-system/legacy");

        await exportRotaToPDF(mockRota);

        expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
          expect.stringContaining(".pdf"),
          "PDF_BASE64_DATA",
          { encoding: "base64" },
        );
      });

      it("shares the PDF file with correct mime type", async () => {
        const Sharing = require("expo-sharing");

        await exportRotaToPDF(mockRota);

        expect(Sharing.shareAsync).toHaveBeenCalledWith(
          expect.stringContaining(".pdf"),
          expect.objectContaining({ mimeType: "application/pdf" }),
        );
      });

      it("shows file path when sharing is not available", async () => {
        const Sharing = require("expo-sharing");
        const { showInfo } = require("@/utils/errorHandling");
        Sharing.isAvailableAsync.mockResolvedValueOnce(false);

        await exportRotaToPDF(mockRota);

        expect(showInfo).toHaveBeenCalledWith(
          "Arquivo Salvo",
          expect.stringContaining("/test-cache/"),
        );
      });
    });

    it("handles errors gracefully", async () => {
      Object.defineProperty(Platform, "OS", { value: "web" });
      const pdfMakeModule = require("pdfmake/build/pdfmake").default;
      const { showError } = require("@/utils/errorHandling");
      const { logger } = require("@/lib/logger");

      pdfMakeModule.createPdf.mockImplementationOnce(() => {
        throw new Error("pdfmake failure");
      });

      await exportRotaToPDF(mockRota);

      expect(logger.error).toHaveBeenCalled();
      expect(showError).toHaveBeenCalledWith(
        "Erro",
        "Não foi possível gerar o comprovante em PDF",
      );
    });
  });
});
