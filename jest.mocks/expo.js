// Mocks relacionados ao ecossistema Expo (fontes, assets, splash, task manager)
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

  // Mock expo-task-manager (usado por unifiedLocationTracking)
  jest.mock('expo-task-manager', () => ({
    defineTask: jest.fn(),
    isTaskRegisteredAsync: jest.fn(() => Promise.resolve(false)),
    isTaskDefined: jest.fn(() => false),
    unregisterTaskAsync: jest.fn(() => Promise.resolve()),
    getTaskOptionsAsync: jest.fn(() => Promise.resolve(null)),
    getRegisteredTasksAsync: jest.fn(() => Promise.resolve([])),
    TaskManagerError: class TaskManagerError extends Error {},
  }));

  // Mock expo-av (usado por notificationSound)
  jest.mock('expo-av', () => ({
    Audio: {
      Sound: {
        createAsync: jest.fn(() => Promise.resolve({
          sound: {
            playAsync: jest.fn(() => Promise.resolve()),
            unloadAsync: jest.fn(() => Promise.resolve()),
            setOnPlaybackStatusUpdate: jest.fn(),
          },
          status: { isLoaded: true },
        })),
      },
      setAudioModeAsync: jest.fn(() => Promise.resolve()),
    },
  }));

  // Mock expo-location (complementar para tracking)
  jest.mock('expo-location', () => ({
    requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    requestBackgroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    getCurrentPositionAsync: jest.fn(() => Promise.resolve({
      coords: { latitude: -23.5505, longitude: -46.6333, accuracy: 10 },
      timestamp: Date.now(),
    })),
    watchPositionAsync: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
    startLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
    stopLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
    hasStartedLocationUpdatesAsync: jest.fn(() => Promise.resolve(false)),
    getLastKnownPositionAsync: jest.fn(() => Promise.resolve(null)),
    Accuracy: {
      Lowest: 1,
      Low: 2,
      Balanced: 3,
      High: 4,
      Highest: 5,
      BestForNavigation: 6,
    },
    ActivityType: {
      Other: 1,
      AutomotiveNavigation: 2,
      Fitness: 3,
      OtherNavigation: 4,
    },
  }));
}

module.exports = { setupExpoMocks };
