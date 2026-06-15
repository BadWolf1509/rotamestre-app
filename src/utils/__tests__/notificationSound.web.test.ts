import {
  initializeNotificationAudio,
  playNotificationSound,
  playSuccessSound,
  setNotificationSoundEnabled,
} from '../notificationSound';

const mockSetAudioModeAsync = jest.fn();

jest.mock('expo-audio', () => ({
  setAudioModeAsync: () => mockSetAudioModeAsync(),
  createAudioPlayer: jest.fn(() => ({
    volume: 1,
    play: jest.fn(),
    remove: jest.fn(),
  })),
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'web',
  },
}));

const mockCreateOscillator = jest.fn(() => ({
  connect: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  frequency: { value: 0 },
  type: 'sine',
}));

const mockCreateGain = jest.fn(() => ({
  connect: jest.fn(),
  gain: {
    setValueAtTime: jest.fn(),
    exponentialRampToValueAtTime: jest.fn(),
  },
}));

class MockAudioContext {
  currentTime = 0;
  destination = {};
  createOscillator = mockCreateOscillator;
  createGain = mockCreateGain;
}

describe('notificationSound web', () => {
  let originalWindow: any;
  let originalNavigator: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    setNotificationSoundEnabled(true);

    originalWindow = (global as any).window;
    (global as any).window = { AudioContext: MockAudioContext };
    originalNavigator = (global as any).navigator;
    (global as any).navigator = { userActivation: { hasBeenActive: true } };
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();

    if (originalWindow) {
      (global as any).window = originalWindow;
    } else {
      // @ts-expect-error - cleanup test env
      delete (global as any).window;
    }

    if (originalNavigator) {
      (global as any).navigator = originalNavigator;
    } else {
      // @ts-expect-error - cleanup test env
      delete (global as any).navigator;
    }
  });

  it('initializeNotificationAudio retorna no web', async () => {
    await initializeNotificationAudio();

    expect(mockSetAudioModeAsync).not.toHaveBeenCalled();
  });

  it('playNotificationSound usa AudioContext no web', async () => {
    await playNotificationSound();
    jest.runAllTimers();

    expect(mockCreateOscillator).toHaveBeenCalled();
  });

  it('playSuccessSound usa AudioContext no web', async () => {
    await playSuccessSound();

    expect(mockCreateOscillator).toHaveBeenCalledTimes(3);
  });
});
