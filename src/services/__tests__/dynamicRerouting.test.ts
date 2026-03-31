import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

import DynamicReroutingService from "../dynamicRerouting";

// Mock dependencies
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
  },
}));

jest.mock("react-native", () => ({
  Platform: {
    OS: "ios",
  },
}));

// Mock global fetch
global.fetch = jest.fn();

describe("DynamicReroutingService", () => {
  let service: any;

  const mockStops = [
    {
      id: "stop1",
      ordem: 1,
      latitude: -23.5505,
      longitude: -46.6333,
      endereco: "Stop 1",
      status: "pendente",
      prioridade: "media",
    },
    {
      id: "stop2",
      ordem: 2,
      latitude: -23.5515,
      longitude: -46.6343,
      endereco: "Stop 2",
      status: "pendente",
      prioridade: "alta",
    },
    {
      id: "stop3",
      ordem: 3,
      latitude: -23.5525,
      longitude: -46.6353,
      endereco: "Stop 3",
      status: "pendente",
      prioridade: "baixa",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    service = DynamicReroutingService;

    // Reset settings to default
    (service as any).settings = {
      enabled: true,
      checkInterval: 5,
      minTimeSaving: 5,
      autoAccept: false,
      considerPriority: true,
      avoidHighTraffic: true,
    };

    // Mock traffic data response (default fast traffic)
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        rows: [
          {
            elements: [
              {
                duration: { value: 300 }, // 5 mins
                duration_in_traffic: { value: 300 },
                distance: { value: 1000 },
              },
            ],
          },
        ],
      }),
    });
  });

  afterEach(() => {
    service.stopMonitoring();
  });

  describe("Initialization", () => {
    it("deve iniciar monitoramento se habilitado", async () => {
      const setIntervalSpy = jest.spyOn(global, "setInterval");

      await service.startMonitoring("route1", mockStops);

      expect(setIntervalSpy).toHaveBeenCalled();
      expect((service as any).currentRouteId).toBe("route1");
    });

    it("não deve iniciar se desabilitado", async () => {
      (service as any).settings.enabled = false;
      const setIntervalSpy = jest.spyOn(global, "setInterval");

      await service.startMonitoring("route1", mockStops);

      expect(setIntervalSpy).not.toHaveBeenCalled();
    });

    it("deve parar monitoramento", async () => {
      const clearIntervalSpy = jest.spyOn(global, "clearInterval");
      // Force an interval to exist
      (service as any).checkInterval = 123;

      service.stopMonitoring();

      expect(clearIntervalSpy).toHaveBeenCalledWith(123);
      expect((service as any).currentRouteId).toBeNull();

      // We expect the optimizer to suggest swapping them if priority is considered

      // Mock traffic data to be neutral so priority dictates order
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({
          rows: [
            {
              elements: [
                {
                  duration: { value: 100 },
                  duration_in_traffic: { value: 100 },
                  distance: { value: 500 },
                },
              ],
            },
          ],
        }),
      });

      // Instead, let's verify the internal sorting logic directly via private method access
      const priorityRoute = await (service as any).priorityBasedRoute(
        mockStops,
      );

      expect(priorityRoute).toBeDefined();
      expect(priorityRoute.route[0].id).toBe("stop2"); // High priority first
      expect(priorityRoute.route[1].id).toBe("stop1"); // Media second
      expect(priorityRoute.route[2].id).toBe("stop3"); // Low last
    });

    it("deve usar Nearest Neighbor para otimização", async () => {
      // Mock stops in a line: A(0,0) -> B(0,10) -> C(0,2)
      // Optimal: A -> C -> B
      const stops = [
        { ...mockStops[0], latitude: 0, longitude: 0, id: "A" },
        { ...mockStops[1], latitude: 0, longitude: 10, id: "B" }, // Far
        { ...mockStops[2], latitude: 0, longitude: 2, id: "C" }, // Near
      ];

      const nnRoute = await (service as any).nearestNeighborRoute(stops);

      expect(nnRoute).toBeDefined();
      expect(nnRoute.route[0].id).toBe("A");
      expect(nnRoute.route[1].id).toBe("C"); // Should visit C before B
      expect(nnRoute.route[2].id).toBe("B");
    });
  });

  describe("Traffic Data Integration", () => {
    it("deve usar OSRM para obter distância (gratuito)", async () => {
      Platform.OS = "ios";

      await (service as any).getTrafficData(mockStops[0], mockStops[1]);

      // OSRM usa osrm.rotamestre.tec.br
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("osrm.rotamestre.tec.br"),
        expect.any(Object),
      );
    });

    it("deve usar OSRM também na web (não precisa de Edge Function)", async () => {
      Platform.OS = "web";

      await (service as any).getTrafficData(mockStops[0], mockStops[1]);

      // OSRM funciona igual em todas as plataformas
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("osrm.rotamestre.tec.br"),
        expect.any(Object),
      );
    });

    it("deve usar Haversine como fallback se OSRM falhar", async () => {
      Platform.OS = "ios";
      (global.fetch as jest.Mock).mockRejectedValue(new Error("OSRM Error"));

      const data = await (service as any).getTrafficData(
        mockStops[0],
        mockStops[1],
      );

      // Fallback retorna valores calculados via Haversine
      expect(data).toHaveProperty("duration");
      expect(data).toHaveProperty("distance");
      expect(data.trafficLevel).toBe("low");
      // Haversine retorna valores baseados na distância real entre os pontos
      expect(data.distance).toBeGreaterThan(0);
    });
  });

  describe("Settings Management", () => {
    it("deve carregar configurações do storage", async () => {
      const savedSettings = { minTimeSaving: 15 };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(savedSettings),
      );

      await service.loadSettings();

      expect((service as any).settings.minTimeSaving).toBe(15);
    });

    it("deve salvar configurações ao atualizar", async () => {
      await service.updateSettings({ autoAccept: true });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "dynamicReroutingSettings",
        expect.stringContaining('"autoAccept":true'),
      );
    });
  });

  describe("Applying Optimization", () => {
    it("deve atualizar ordem das paradas no banco", async () => {
      const newOrder = [mockStops[1], mockStops[0], mockStops[2]];

      await service.applyOptimization("route1", newOrder);

      expect((supabase as any).from).toHaveBeenCalledWith("paradas");
      expect((supabase as any).update).toHaveBeenCalled();
      // Should log the change
      expect((supabase as any).from).toHaveBeenCalledWith("logs");
    });
  });
});
