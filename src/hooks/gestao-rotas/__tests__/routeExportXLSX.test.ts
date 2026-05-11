/**
 * routeExportXLSX - Tests
 */

import { Platform } from "react-native";

import { exportRotasToXLSX } from "../routeExportXLSX";

import type { RotaHistorico } from "../types";

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

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

jest.mock("@/utils/errorHandling", () => ({
  showError: jest.fn(),
  showWarning: jest.fn(),
  showInfo: jest.fn(),
  showSuccess: jest.fn(),
}));

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "/test-docs/",
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: {
    Base64: "base64",
  },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock xlsx (SheetJS) — simulates the lazy-loaded module.
// The factory MUST be inline (no external variable refs) because jest.mock is hoisted.
jest.mock("xlsx", () => ({
  utils: {
    book_new: jest.fn(() => ({})),
    aoa_to_sheet: jest.fn(() => ({})),
    book_append_sheet: jest.fn(),
  },
  write: jest.fn(() => "BASE64_OR_ARRAY"),
}));

// -----------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------

const mockRota: RotaHistorico = {
  id: "route-1",
  data: "2026-01-15",
  status: "concluida",
  distancia_total: 42.5,
  iniciada_em: "2026-01-15T08:00:00Z",
  concluida_em: "2026-01-15T12:30:00Z",
  motorista_id: "driver-1",
  motorista_nome: "João Silva",
  paradas_count: 10,
  paradas_concluidas: 10,
};

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

describe("routeExportXLSX", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("exportRotasToXLSX", () => {
    it("shows warning when no routes to export", async () => {
      const { showWarning } = require("@/utils/errorHandling");

      await exportRotasToXLSX({ rotas: [], filtroStatus: "todas" });

      expect(showWarning).toHaveBeenCalledWith(
        "Atenção",
        "Não há rotas para exportar",
      );
    });

    it("handles empty array without throwing", async () => {
      await expect(
        exportRotasToXLSX({ rotas: [], filtroStatus: "todas" }),
      ).resolves.not.toThrow();
    });

    describe("workbook construction", () => {
      beforeEach(() => {
        Object.defineProperty(Platform, "OS", { value: "web" });
        (global as any).document = {
          createElement: jest.fn(() => ({
            setAttribute: jest.fn(),
            click: jest.fn(),
            style: {},
          })),
          body: {
            appendChild: jest.fn(),
            removeChild: jest.fn(),
          },
        };
        (global as any).URL = {
          createObjectURL: jest.fn(() => "blob:test"),
          revokeObjectURL: jest.fn(),
        };
        (global as any).Blob = jest.fn((content, opts) => ({
          content,
          type: opts?.type,
        }));
      });

      afterEach(() => {
        delete (global as any).document;
        delete (global as any).URL;
        delete (global as any).Blob;
      });

      it("creates a new workbook with header + data rows", async () => {
        const XLSX = require("xlsx");

        await exportRotasToXLSX({ rotas: [mockRota], filtroStatus: "todas" });

        expect(XLSX.utils.book_new).toHaveBeenCalledTimes(1);

        // aoa_to_sheet receives array with header row + data row
        expect(XLSX.utils.aoa_to_sheet).toHaveBeenCalledTimes(1);
        const [sheetData] = XLSX.utils.aoa_to_sheet.mock.calls[0] as [
          unknown[][],
        ];
        expect(sheetData).toHaveLength(2); // header + 1 data row
        expect(sheetData[0]).toContain("Data");
        expect(sheetData[0]).toContain("Motorista");
        expect(sheetData[0]).toContain("Status");
        // Data row should include driver name
        expect(sheetData[1]).toContain("João Silva");
      });

      it("appends the sheet to the workbook", async () => {
        const XLSX = require("xlsx");

        await exportRotasToXLSX({ rotas: [mockRota], filtroStatus: "todas" });

        expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith(
          expect.any(Object), // workbook
          expect.any(Object), // sheet
          "Rotas",
        );
      });
    });

    describe("web platform", () => {
      beforeEach(() => {
        Object.defineProperty(Platform, "OS", { value: "web" });
        (global as any).document = {
          createElement: jest.fn(() => ({
            setAttribute: jest.fn(),
            click: jest.fn(),
            style: {},
          })),
          body: {
            appendChild: jest.fn(),
            removeChild: jest.fn(),
          },
        };
        (global as any).URL = {
          createObjectURL: jest.fn(() => "blob:test"),
          revokeObjectURL: jest.fn(),
        };
        (global as any).Blob = jest.fn((content, opts) => ({
          content,
          type: opts?.type,
        }));
      });

      afterEach(() => {
        delete (global as any).document;
        delete (global as any).URL;
        delete (global as any).Blob;
      });

      it("writes workbook as array type for Blob on web", async () => {
        const XLSX = require("xlsx");

        await exportRotasToXLSX({ rotas: [mockRota], filtroStatus: "todas" });

        expect(XLSX.write).toHaveBeenCalledWith(expect.any(Object), {
          bookType: "xlsx",
          type: "array",
        });
      });

      it("creates Blob with correct XLSX mime type", async () => {
        await exportRotasToXLSX({ rotas: [mockRota], filtroStatus: "todas" });

        expect((global as any).Blob).toHaveBeenCalledWith([expect.anything()], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
      });

      it("creates and triggers an anchor download link", async () => {
        await exportRotasToXLSX({ rotas: [mockRota], filtroStatus: "todas" });

        expect((global as any).document.createElement).toHaveBeenCalledWith(
          "a",
        );
        expect((global as any).URL.createObjectURL).toHaveBeenCalled();
      });

      it("shows success message after export", async () => {
        const { showSuccess } = require("@/utils/errorHandling");

        await exportRotasToXLSX({ rotas: [mockRota], filtroStatus: "todas" });

        expect(showSuccess).toHaveBeenCalledWith(
          "Sucesso",
          "1 rotas exportadas com sucesso!",
        );
      });

      it("logs export action when userId is provided", async () => {
        const { supabase } = require("@/lib/supabase");

        await exportRotasToXLSX({
          rotas: [mockRota],
          filtroStatus: "concluidas",
          userId: "user-123",
        });

        expect(supabase.from).toHaveBeenCalledWith("logs");
      });
    });

    describe("mobile platform", () => {
      beforeEach(() => {
        Object.defineProperty(Platform, "OS", { value: "ios" });
      });

      it("writes workbook as base64 for mobile", async () => {
        const XLSX = require("xlsx");

        await exportRotasToXLSX({ rotas: [mockRota], filtroStatus: "todas" });

        expect(XLSX.write).toHaveBeenCalledWith(expect.any(Object), {
          bookType: "xlsx",
          type: "base64",
        });
      });

      it("writes base64 string to file system", async () => {
        const FileSystem = require("expo-file-system/legacy");

        await exportRotasToXLSX({ rotas: [mockRota], filtroStatus: "todas" });

        expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
          expect.stringContaining("/test-docs/"),
          "BASE64_OR_ARRAY",
          { encoding: "base64" },
        );
      });

      it("shares XLSX file with correct mime type", async () => {
        const Sharing = require("expo-sharing");

        await exportRotasToXLSX({ rotas: [mockRota], filtroStatus: "todas" });

        expect(Sharing.shareAsync).toHaveBeenCalledWith(
          expect.stringContaining(".xlsx"),
          expect.objectContaining({
            mimeType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        );
      });

      it("shows file path when sharing is not available", async () => {
        const Sharing = require("expo-sharing");
        const { showInfo } = require("@/utils/errorHandling");
        Sharing.isAvailableAsync.mockResolvedValueOnce(false);

        await exportRotasToXLSX({ rotas: [mockRota], filtroStatus: "todas" });

        expect(showInfo).toHaveBeenCalledWith(
          "Arquivo Salvo",
          expect.stringContaining("/test-docs/"),
        );
      });
    });

    it("handles export errors gracefully", async () => {
      Object.defineProperty(Platform, "OS", { value: "web" });
      const { showError } = require("@/utils/errorHandling");
      // Remove document so Blob / anchor creation throws
      delete (global as any).document;
      delete (global as any).Blob;

      await exportRotasToXLSX({ rotas: [mockRota], filtroStatus: "todas" });

      const { logger } = require("@/lib/logger");
      expect(logger.error).toHaveBeenCalled();
      expect(showError).toHaveBeenCalledWith(
        "Erro",
        "Não foi possível exportar os dados",
      );
    });
  });
});
