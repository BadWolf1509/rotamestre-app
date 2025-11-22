// Mocks relacionados ao ecossistema Expo (fontes, assets, splash)
function setupExpoMocks() {
  jest.mock('expo-font', () => ({
    loadAsync: jest.fn(),
    isLoaded: jest.fn(() => true),
  }));

  jest.mock('expo-asset', () => ({
    Asset: {
      loadAsync: jest.fn(),
    },
  }));

  jest.mock('expo-splash-screen', () => ({
    preventAutoHideAsync: jest.fn(),
    hideAsync: jest.fn(),
  }));
}

module.exports = { setupExpoMocks };
