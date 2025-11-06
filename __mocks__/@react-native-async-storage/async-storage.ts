// Mock do AsyncStorage para testes

const mockStorage: { [key: string]: string } = {};

export default {
  setItem: jest.fn((key: string, value: string) => {
    return new Promise((resolve) => {
      mockStorage[key] = value;
      resolve(null);
    });
  }),
  getItem: jest.fn((key: string) => {
    return new Promise((resolve) => {
      resolve(mockStorage[key] || null);
    });
  }),
  removeItem: jest.fn((key: string) => {
    return new Promise((resolve) => {
      delete mockStorage[key];
      resolve(null);
    });
  }),
  clear: jest.fn(() => {
    return new Promise((resolve) => {
      Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
      resolve(null);
    });
  }),
  getAllKeys: jest.fn(() => {
    return new Promise((resolve) => {
      resolve(Object.keys(mockStorage));
    });
  }),
  multiGet: jest.fn((keys: string[]) => {
    return new Promise((resolve) => {
      const pairs = keys.map((key) => [key, mockStorage[key] || null]);
      resolve(pairs);
    });
  }),
  multiSet: jest.fn((pairs: [string, string][]) => {
    return new Promise((resolve) => {
      pairs.forEach(([key, value]) => {
        mockStorage[key] = value;
      });
      resolve(null);
    });
  }),
  multiRemove: jest.fn((keys: string[]) => {
    return new Promise((resolve) => {
      keys.forEach((key) => delete mockStorage[key]);
      resolve(null);
    });
  }),
};

// Helper para limpar storage entre testes
export const clearMockStorage = () => {
  Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
};
