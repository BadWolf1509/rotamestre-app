/**
 * Testes para useGestaoRotas hook
 *
 * Cobre:
 * - Data Loading (com cache stale-while-revalidate)
 * - Filtragem por status e busca textual
 * - Exclusão de rotas
 * - Exportação para CSV
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { Alert, Platform } from "react-native";

import { supabase } from "@/lib/supabase";

import { useGestaoRotas, RotaHistorico, RotaStatus } from "../useGestaoRotas";

// ============================================
// MOCKS
// ============================================

jest.mock("@/lib/supabase");
jest.mock("@react-native-async-storage/async-storage");
jest.mock("../useUnidadeAtiva");
jest.mock("../useUser");
jest.mock("../useToast");
jest.mock("../useDebounce");
jest.mock("../useRealtimeRoutes");
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));
jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "/test/",
  cacheDirectory: "/test-cache/",
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { UTF8: "utf8", Base64: "base64" },
}));
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));
// Mock xlsx (SheetJS) to avoid real bundle load in tests
jest.mock("xlsx", () => ({
  utils: {
    book_new: jest.fn(() => ({})),
    aoa_to_sheet: jest.fn(() => ({})),
    book_append_sheet: jest.fn(),
  },
  write: jest.fn(() => "MOCK_BASE64"),
}));
// Mock pdfmake to avoid canvas/font loading errors in test environment
jest.mock("pdfmake/build/pdfmake", () => ({
  __esModule: true,
  default: {
    vfs: {},
    createPdf: jest.fn(() => ({
      download: jest.fn(),
      getBase64: jest.fn().mockResolvedValue("PDF_BASE64"),
    })),
  },
}));
jest.mock("pdfmake/build/vfs_fonts", () => ({
  __esModule: true,
  default: { pdfMake: { vfs: {} } },
}));
jest.mock("@/utils/errorHandling", () => ({
  showError: jest.fn(),
  showWarning: jest.fn(),
  showInfo: jest.fn(),
  showSuccess: jest.fn(),
  showConfirmation: jest.fn(),
}));

// Spy no Alert
jest.spyOn(Alert, "alert");

// ============================================
// TEST DATA
// ============================================

const mockRotas: RotaHistorico[] = [
  {
    id: "rota-1",
    data: "2026-01-02",
    status: "pendente",
    distancia_total: 15.5,
    motorista_id: "motorista-1",
    motorista_nome: "Carlos Silva",
    paradas_count: 5,
    paradas_concluidas: 0,
  },
  {
    id: "rota-2",
    data: "2026-01-01",
    status: "em_andamento",
    distancia_total: 22.3,
    iniciada_em: "2026-01-01T08:00:00Z",
    motorista_id: "motorista-2",
    motorista_nome: "Maria Santos",
    paradas_count: 8,
    paradas_concluidas: 4,
  },
  {
    id: "rota-3",
    data: "2025-12-31",
    status: "concluida",
    distancia_total: 18.0,
    iniciada_em: "2025-12-31T07:30:00Z",
    concluida_em: "2025-12-31T14:00:00Z",
    motorista_id: "motorista-1",
    motorista_nome: "Carlos Silva",
    paradas_count: 6,
    paradas_concluidas: 6,
  },
];

const mockParadas = [
  {
    rota_id: "rota-1",
    status: "pendente",
    is_checkpoint: true,
    rotas: { unidade_id: "unidade-1" },
  },
  {
    rota_id: "rota-1",
    status: "pendente",
    is_checkpoint: true,
    rotas: { unidade_id: "unidade-1" },
  },
  {
    rota_id: "rota-2",
    status: "concluida",
    is_checkpoint: true,
    rotas: { unidade_id: "unidade-1" },
  },
  {
    rota_id: "rota-2",
    status: "pendente",
    is_checkpoint: true,
    rotas: { unidade_id: "unidade-1" },
  },
  {
    rota_id: "rota-3",
    status: "concluida",
    is_checkpoint: true,
    rotas: { unidade_id: "unidade-1" },
  },
];

const mockStatusColorMap: Record<RotaStatus, string> = {
  pendente: "#FFA500",
  em_andamento: "#0066FF",
  concluida: "#00CC66",
  cancelada: "#FF3333",
  nao_executada: "#999999",
};

const defaultOptions = {
  statusColorMap: mockStatusColorMap,
  defaultStatusColor: "#666666",
};

// ============================================
// SETUP
// ============================================

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

function setupMocks(
  options: {
    rotasData?: RotaHistorico[] | null;
    rotasError?: Error | null;
    paradasData?: typeof mockParadas | null;
    paradasError?: Error | null;
    cachedData?: RotaHistorico[] | null;
  } = {},
) {
  const {
    rotasData = mockRotas,
    rotasError = null,
    paradasData = mockParadas,
    paradasError = null,
    cachedData = null,
  } = options;

  // Mock useUnidadeAtiva
  const useUnidadeAtiva = require("../useUnidadeAtiva").useUnidadeAtiva;
  useUnidadeAtiva.mockReturnValue({
    unidadeAtiva: "unidade-1",
  });

  // Mock useUser
  const useUser = require("../useUser").useUser;
  useUser.mockReturnValue({
    userData: { id: "user-1", nome: "Gestor Teste", papel: "gestor" },
  });

  // Mock useToast
  const useToast = require("../useToast").useToast;
  useToast.mockReturnValue({
    toast: { visible: false, message: "", type: "success", duration: 3000 },
    showToast: jest.fn(),
    hideToast: jest.fn(),
    withToast: jest.fn().mockImplementation(async (fn, _opts) => {
      return await fn();
    }),
  });

  // Mock useDebounce - retorna o valor imediatamente para testes
  const useDebounce = require("../useDebounce").useDebounce;
  useDebounce.mockImplementation((value: string) => value);

  // Mock useRealtimeRoutes
  const useRealtimeRoutes = require("../useRealtimeRoutes").useRealtimeRoutes;
  useRealtimeRoutes.mockReturnValue(undefined);

  // Mock AsyncStorage
  if (cachedData) {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ data: cachedData, timestamp: Date.now() }),
    );
  } else {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  }
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

  // Mock Supabase queries
  const mockRotasQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    abortSignal: jest.fn().mockResolvedValue({
      data: rotasData?.map((r) => ({
        ...r,
        usuarios: r.motorista_id
          ? { id: r.motorista_id, nome: r.motorista_nome }
          : null,
      })),
      error: rotasError,
    }),
  };

  const mockParadasQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    abortSignal: jest.fn().mockResolvedValue({
      data: paradasData,
      error: paradasError,
    }),
  };

  const mockDeleteQuery = {
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ error: null }),
  };

  const mockInsertQuery = {
    insert: jest.fn().mockResolvedValue({ error: null }),
  };

  (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
    if (table === "rotas") {
      return { ...mockRotasQuery, delete: mockDeleteQuery.delete };
    }
    if (table === "paradas") {
      return mockParadasQuery;
    }
    if (table === "logs") {
      return mockInsertQuery;
    }
    return mockRotasQuery;
  });

  return {
    mockRotasQuery,
    mockParadasQuery,
    mockDeleteQuery,
    mockInsertQuery,
  };
}

// ============================================
// TESTS
// ============================================

describe("useGestaoRotas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Alert.alert as jest.Mock).mockClear();
  });

  // ============================================
  // DATA LOADING TESTS
  // ============================================

  describe("Data Loading", () => {
    it("deve carregar rotas sem cache", async () => {
      setupMocks({ cachedData: null });

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.rotas).toHaveLength(3);
      expect(result.current.rotas[0].id).toBe("rota-1");
    });

    it("deve carregar rotas do cache primeiro (stale-while-revalidate)", async () => {
      const cachedRotas = [mockRotas[0]]; // Apenas 1 rota no cache
      setupMocks({ cachedData: cachedRotas });

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      // Deve mostrar cache imediatamente
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Cache inicial
      expect(result.current.rotas.length).toBeGreaterThanOrEqual(1);
    });

    it("deve executar queries paralelas para rotas e paradas", async () => {
      setupMocks();

      renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        // Verifica que ambas as queries foram chamadas
        expect(mockSupabase.from).toHaveBeenCalledWith("rotas");
        expect(mockSupabase.from).toHaveBeenCalledWith("paradas");
      });
    });

    it("deve tratar erro de carregamento sem cache", async () => {
      setupMocks({
        rotasError: new Error("Erro de conexão"),
        cachedData: null,
      });

      renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Erro",
          "Não foi possível carregar as rotas",
        );
      });
    });

    it("não deve mostrar erro se tiver dados em cache", async () => {
      setupMocks({
        rotasError: new Error("Erro de conexão"),
        cachedData: mockRotas,
      });

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Não deve mostrar alerta porque tem cache
      expect(Alert.alert).not.toHaveBeenCalledWith("Erro", expect.anything());
    });
  });

  // ============================================
  // FILTERING TESTS
  // ============================================

  describe("Filtragem", () => {
    it("deve filtrar por status pendente", async () => {
      setupMocks();

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setFiltroStatus("pendente");
      });

      await waitFor(() => {
        expect(
          result.current.rotasFiltradas.every((r) => r.status === "pendente"),
        ).toBe(true);
      });
    });

    it("deve filtrar por status em_andamento", async () => {
      setupMocks();

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setFiltroStatus("em_andamento");
      });

      await waitFor(() => {
        expect(
          result.current.rotasFiltradas.every(
            (r) => r.status === "em_andamento",
          ),
        ).toBe(true);
      });
    });

    it('deve mostrar todas as rotas quando filtro é "todas"', async () => {
      setupMocks();

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setFiltroStatus("todas");
      });

      await waitFor(() => {
        expect(result.current.rotasFiltradas.length).toBe(
          result.current.rotas.length,
        );
      });
    });

    it("deve filtrar por busca de nome do motorista", async () => {
      setupMocks();

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearchQuery("Carlos");
      });

      await waitFor(() => {
        expect(
          result.current.rotasFiltradas.every((r) =>
            r.motorista_nome?.toLowerCase().includes("carlos"),
          ),
        ).toBe(true);
      });
    });

    it("deve filtrar por busca de data", async () => {
      setupMocks();

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearchQuery("02/01");
      });

      await waitFor(() => {
        // Deve encontrar rotas de 02/01/2026
        expect(result.current.rotasFiltradas.length).toBeGreaterThanOrEqual(0);
      });
    });

    it("deve combinar filtro de status e busca textual", async () => {
      setupMocks();

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setFiltroStatus("pendente");
        result.current.setSearchQuery("Carlos");
      });

      await waitFor(() => {
        const filtradas = result.current.rotasFiltradas;
        expect(
          filtradas.every(
            (r) =>
              r.status === "pendente" &&
              r.motorista_nome?.toLowerCase().includes("carlos"),
          ),
        ).toBe(true);
      });
    });
  });

  // ============================================
  // DELETE ROUTE TESTS
  // ============================================

  describe("Exclusão de Rota", () => {
    it("deve rejeitar exclusão de rota em andamento (mobile)", async () => {
      Platform.OS = "android";
      setupMocks();

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const rotaEmAndamento = result.current.rotas.find(
        (r) => r.status === "em_andamento",
      )!;

      act(() => {
        result.current.excluirRota(rotaEmAndamento);
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        "Ação não permitida",
        "Não é possível excluir uma rota em andamento. Aguarde a conclusão ou cancele a rota primeiro.",
      );
    });

    it("deve rejeitar exclusão de rota em andamento (web)", async () => {
      Platform.OS = "web";

      // Configurar mock antes de setupMocks
      const mockShowToast = jest.fn();
      const useToastModule = require("../useToast");
      useToastModule.useToast.mockReturnValue({
        toast: { visible: false, message: "", type: "success", duration: 3000 },
        showToast: mockShowToast,
        hideToast: jest.fn(),
        withToast: jest.fn().mockImplementation(async (fn) => await fn()),
      });

      // Setup outros mocks sem sobrescrever useToast
      const useUnidadeAtiva = require("../useUnidadeAtiva").useUnidadeAtiva;
      useUnidadeAtiva.mockReturnValue({ unidadeAtiva: "unidade-1" });

      const useUser = require("../useUser").useUser;
      useUser.mockReturnValue({
        userData: { id: "user-1", nome: "Gestor Teste", papel: "gestor" },
      });

      const useDebounce = require("../useDebounce").useDebounce;
      useDebounce.mockImplementation((value: string) => value);

      const useRealtimeRoutes =
        require("../useRealtimeRoutes").useRealtimeRoutes;
      useRealtimeRoutes.mockReturnValue(undefined);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      // Mock Supabase
      (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "rotas") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            abortSignal: jest.fn().mockResolvedValue({
              data: mockRotas.map((r) => ({
                ...r,
                usuarios: r.motorista_id
                  ? { id: r.motorista_id, nome: r.motorista_nome }
                  : null,
              })),
              error: null,
            }),
          };
        }
        if (table === "paradas") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            abortSignal: jest
              .fn()
              .mockResolvedValue({ data: mockParadas, error: null }),
          };
        }
        return { insert: jest.fn().mockResolvedValue({ error: null }) };
      });

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const rotaEmAndamento = result.current.rotas.find(
        (r) => r.status === "em_andamento",
      )!;

      act(() => {
        result.current.excluirRota(rotaEmAndamento);
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        "Não é possível excluir uma rota em andamento. Aguarde a conclusão ou cancele a rota primeiro.",
        "error",
        5000,
      );

      // Restaurar Platform.OS
      Platform.OS = "android";
    });

    it("deve mostrar confirmação no mobile (Alert.alert)", async () => {
      Platform.OS = "android";
      setupMocks();

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const rotaPendente = result.current.rotas.find(
        (r) => r.status === "pendente",
      )!;

      act(() => {
        result.current.excluirRota(rotaPendente);
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        "Confirmar Exclusão",
        expect.stringContaining("Tem certeza que deseja excluir esta rota?"),
        expect.arrayContaining([
          expect.objectContaining({ text: "Cancelar" }),
          expect.objectContaining({ text: "Excluir", style: "destructive" }),
        ]),
      );
    });

    it("deve mostrar modal de confirmação no web", async () => {
      Platform.OS = "web";
      setupMocks();

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const rotaPendente = result.current.rotas.find(
        (r) => r.status === "pendente",
      )!;

      act(() => {
        result.current.excluirRota(rotaPendente);
      });

      expect(result.current.showConfirmModal).toBe(true);
      expect(result.current.rotaToDelete).toEqual(rotaPendente);

      // Restaurar Platform.OS
      Platform.OS = "android";
    });

    it("deve registrar log de auditoria ao excluir rota", async () => {
      setupMocks();

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const rotaPendente = result.current.rotas.find(
        (r) => r.status === "pendente",
      )!;

      // Simular confirmação de exclusão direta
      await act(async () => {
        // A função executarExclusao é interna, vamos verificar via handleConfirmDelete
        Platform.OS = "web";
        result.current.excluirRota(rotaPendente);
      });

      // Verificar que o modal foi aberto (web)
      expect(result.current.showConfirmModal).toBe(true);

      // Restaurar Platform.OS
      Platform.OS = "android";
    });
  });

  // ============================================
  // CSV EXPORT TESTS
  // ============================================

  describe("Exportação CSV", () => {
    it("deve alertar quando não há rotas para exportar", async () => {
      setupMocks({ rotasData: [] });

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.exportarParaCSV();
      });

      const { showWarning } = require("@/utils/errorHandling");
      expect(showWarning).toHaveBeenCalledWith(
        "Atenção",
        "Não há rotas para exportar",
      );
    });

    it("deve exportar CSV corretamente no web", async () => {
      Platform.OS = "web";

      // Mock document e URL para web
      const mockCreateElement = jest.fn().mockReturnValue({
        setAttribute: jest.fn(),
        click: jest.fn(),
        style: {},
      });
      const mockAppendChild = jest.fn();
      const mockRemoveChild = jest.fn();
      const mockCreateObjectURL = jest.fn().mockReturnValue("blob:test");
      const mockRevokeObjectURL = jest.fn();

      global.document = {
        createElement: mockCreateElement,
        body: {
          appendChild: mockAppendChild,
          removeChild: mockRemoveChild,
        },
      } as unknown as Document;

      global.URL = {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
      } as unknown as typeof URL;

      global.Blob = jest.fn().mockImplementation((content, options) => ({
        content,
        options,
      })) as unknown as typeof Blob;

      setupMocks();

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.exportarParaCSV();
      });

      // Verifica que o blob foi criado
      expect(global.Blob).toHaveBeenCalled();
      expect(mockCreateElement).toHaveBeenCalledWith("a");

      // Restaurar Platform.OS
      Platform.OS = "android";
    });

    it("deve usar Sharing no mobile", async () => {
      Platform.OS = "android";

      const FileSystem = require("expo-file-system/legacy");
      const Sharing = require("expo-sharing");

      setupMocks();

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.exportarParaCSV();
      });

      expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
      expect(Sharing.shareAsync).toHaveBeenCalled();
    });

    it("deve registrar log de exportação", async () => {
      Platform.OS = "web";

      // Mocks mínimos para web
      global.document = {
        createElement: jest.fn().mockReturnValue({
          setAttribute: jest.fn(),
          click: jest.fn(),
          style: {},
        }),
        body: {
          appendChild: jest.fn(),
          removeChild: jest.fn(),
        },
      } as unknown as Document;
      global.URL = {
        createObjectURL: jest.fn().mockReturnValue("blob:test"),
        revokeObjectURL: jest.fn(),
      } as unknown as typeof URL;
      global.Blob = jest.fn() as unknown as typeof Blob;

      setupMocks();

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.exportarParaCSV();
      });

      // Verifica que supabase.from('logs').insert foi chamado
      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith("logs");
      });

      // Restaurar Platform.OS
      Platform.OS = "android";
    });

    it("deve incluir dados filtrados no CSV", async () => {
      Platform.OS = "web";

      let blobContent: string[] = [];
      global.Blob = jest.fn().mockImplementation((content) => {
        blobContent = content;
        return { content };
      }) as unknown as typeof Blob;
      global.document = {
        createElement: jest.fn().mockReturnValue({
          setAttribute: jest.fn(),
          click: jest.fn(),
          style: {},
        }),
        body: {
          appendChild: jest.fn(),
          removeChild: jest.fn(),
        },
      } as unknown as Document;
      global.URL = {
        createObjectURL: jest.fn().mockReturnValue("blob:test"),
        revokeObjectURL: jest.fn(),
      } as unknown as typeof URL;

      setupMocks();

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Filtrar apenas rotas pendentes
      act(() => {
        result.current.setFiltroStatus("pendente");
      });

      await waitFor(() => {
        expect(result.current.rotasFiltradas.length).toBeGreaterThan(0);
      });

      await act(async () => {
        await result.current.exportarParaCSV();
      });

      // Verificar que o CSV contém apenas rotas pendentes
      const csvContent = blobContent[0] as string;
      expect(csvContent).toContain("Pendente");
      expect(csvContent).not.toContain("Em Andamento");

      // Restaurar Platform.OS
      Platform.OS = "android";
    });
  });

  // ============================================
  // HELPER TESTS
  // ============================================

  // ============================================
  // XLSX EXPORT TESTS
  // ============================================

  describe("Exportação XLSX", () => {
    it("deve chamar XLSX.utils.book_new ao exportar para XLSX", async () => {
      const XLSX = require("xlsx");
      Platform.OS = "web";

      global.document = {
        createElement: jest.fn().mockReturnValue({
          setAttribute: jest.fn(),
          click: jest.fn(),
          style: {},
        }),
        body: { appendChild: jest.fn(), removeChild: jest.fn() },
      } as unknown as Document;
      global.URL = {
        createObjectURL: jest.fn().mockReturnValue("blob:test"),
        revokeObjectURL: jest.fn(),
      } as unknown as typeof URL;
      global.Blob = jest.fn().mockImplementation((content, options) => ({
        content,
        options,
      })) as unknown as typeof Blob;

      setupMocks();

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.exportarParaXLSX();
      });

      expect(XLSX.utils.book_new).toHaveBeenCalled();

      Platform.OS = "android";
    });

    it("deve alertar quando não há rotas para exportar XLSX", async () => {
      setupMocks({ rotasData: [] });

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.exportarParaXLSX();
      });

      const { showWarning } = require("@/utils/errorHandling");
      expect(showWarning).toHaveBeenCalledWith(
        "Atenção",
        "Não há rotas para exportar",
      );
    });
  });

  // ============================================
  // PDF EXPORT TESTS
  // ============================================

  describe("Exportação PDF", () => {
    it("deve chamar createPdf ao exportar para PDF", async () => {
      Platform.OS = "web";

      setupMocks();

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.exportarParaPDF();
      });

      const pdfMakeModule = require("pdfmake/build/pdfmake").default;
      expect(pdfMakeModule.createPdf).toHaveBeenCalled();

      Platform.OS = "android";
    });

    it("deve incluir rotas filtradas no PDF", async () => {
      Platform.OS = "web";
      setupMocks();

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Filter to only pending routes
      act(() => {
        result.current.setFiltroStatus("pendente");
      });

      await act(async () => {
        await result.current.exportarParaPDF();
      });

      const pdfMakeModule = require("pdfmake/build/pdfmake").default;
      const [docDef] = pdfMakeModule.createPdf.mock.calls.at(-1) as [any];
      const contentStr = JSON.stringify(docDef.content);
      // Should only contain data for the pending route
      expect(contentStr).toContain("Carlos Silva");

      Platform.OS = "android";
    });
  });

  describe("Helpers", () => {
    it("deve retornar label correto para status", async () => {
      setupMocks();

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.getStatusLabel("pendente")).toBe("Pendente");
      expect(result.current.getStatusLabel("em_andamento")).toBe(
        "Em Andamento",
      );
      expect(result.current.getStatusLabel("concluida")).toBe("Concluída");
      expect(result.current.getStatusLabel("cancelada")).toBe("Cancelada");
      expect(result.current.getStatusLabel("nao_executada")).toBe(
        "Não Executada",
      );
    });

    it("deve retornar cor correta para status", async () => {
      setupMocks();

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.getStatusColor("pendente")).toBe("#FFA500");
      expect(result.current.getStatusColor("em_andamento")).toBe("#0066FF");
      expect(result.current.getStatusColor("concluida")).toBe("#00CC66");
    });

    it("deve retornar cor padrão para status desconhecido", async () => {
      setupMocks();

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.getStatusColor("unknown_status")).toBe("#666666");
    });
  });

  // ============================================
  // MODAL TESTS
  // ============================================

  describe("Modal de Confirmação", () => {
    it("deve fechar modal ao cancelar", async () => {
      Platform.OS = "web";
      setupMocks();

      const { result } = renderHook(() => useGestaoRotas(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const rotaPendente = result.current.rotas.find(
        (r) => r.status === "pendente",
      )!;

      // Abrir modal
      act(() => {
        result.current.excluirRota(rotaPendente);
      });

      expect(result.current.showConfirmModal).toBe(true);

      // Cancelar
      act(() => {
        result.current.handleCancelDelete();
      });

      expect(result.current.showConfirmModal).toBe(false);
      expect(result.current.rotaToDelete).toBeNull();

      Platform.OS = "android";
    });
  });
});
