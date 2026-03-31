import { clearCache } from "../osrm/cache";
import { getDistanceMatrix } from "../osrm/table";

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("OSRM Table API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCache();
  });

  it("should fetch distance matrix from OSRM Table API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        code: "Ok",
        distances: [
          [0, 1000, 2000],
          [1000, 0, 1500],
          [2000, 1500, 0],
        ],
        durations: [
          [0, 120, 240],
          [120, 0, 180],
          [240, 180, 0],
        ],
        sources: [
          { location: [0, 0] },
          { location: [1, 1] },
          { location: [2, 2] },
        ],
        destinations: [
          { location: [0, 0] },
          { location: [1, 1] },
          { location: [2, 2] },
        ],
      }),
    });

    const result = await getDistanceMatrix([
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 1 },
      { latitude: 2, longitude: 2 },
    ]);

    expect(result).not.toBeNull();
    expect(result!.distances).toHaveLength(3);
    expect(result!.distances[0][1]).toBe(1000);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/table/v1/driving/"),
      expect.any(Object),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("annotations=distance,duration"),
      expect.any(Object),
    );
  });

  it("should return null when OSRM returns error code", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest
        .fn()
        .mockResolvedValue({ code: "NoTable", distances: [], durations: [] }),
    });

    const result = await getDistanceMatrix([
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 1 },
    ]);
    expect(result).toBeNull();
  });

  it("should return null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await getDistanceMatrix([
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 1 },
    ]);
    expect(result).toBeNull();
  });

  it("should use cache for repeated calls", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        code: "Ok",
        distances: [
          [0, 100],
          [100, 0],
        ],
        durations: [
          [0, 60],
          [60, 0],
        ],
        sources: [{ location: [0, 0] }, { location: [1, 1] }],
        destinations: [{ location: [0, 0] }, { location: [1, 1] }],
      }),
    });

    const coords = [
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 1 },
    ];

    await getDistanceMatrix(coords);
    await getDistanceMatrix(coords);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
