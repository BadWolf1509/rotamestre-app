/**
 * Notification Sound utility
 * Plays sounds for important events (new route, completion, etc.)
 */

import { Audio } from 'expo-av';
import { Platform } from 'react-native';

// Sound instance cache
let notificationSound: Audio.Sound | null = null;
let successSound: Audio.Sound | null = null;

// Sound enabled flag (can be controlled by user settings)
let soundEnabled = true;

/**
 * Initialize audio mode for notifications
 */
export async function initializeNotificationAudio(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (error) {
    console.error('[NotificationSound] Error initializing audio:', error);
  }
}

/**
 * Play notification sound (for new route, alerts)
 */
export async function playNotificationSound(): Promise<void> {
  if (!soundEnabled) return;

  // Web: Use Web Audio API
  if (Platform.OS === 'web') {
    playWebNotificationSound();
    return;
  }

  try {
    // Unload previous sound if exists
    if (notificationSound) {
      await notificationSound.unloadAsync();
    }

    // Load and play notification sound
    const { sound } = await Audio.Sound.createAsync(
      // Using a built-in system-like notification tone
      // You can replace with a custom sound file: require('@/assets/sounds/notification.mp3')
      { uri: 'https://cdn.freesound.org/previews/536/536420_11943129-lq.mp3' },
      { shouldPlay: true, volume: 0.7 }
    );

    notificationSound = sound;

    // Unload when finished
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch (error) {
    console.error('[NotificationSound] Error playing notification sound:', error);
  }
}

/**
 * Play success sound (for route completion, stop completion)
 */
export async function playSuccessSound(): Promise<void> {
  if (!soundEnabled) return;

  // Web: Use Web Audio API
  if (Platform.OS === 'web') {
    playWebSuccessSound();
    return;
  }

  try {
    if (successSound) {
      await successSound.unloadAsync();
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3' },
      { shouldPlay: true, volume: 0.6 }
    );

    successSound = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch (error) {
    console.error('[NotificationSound] Error playing success sound:', error);
  }
}

/**
 * Web Audio API - Notification beep
 */
function playWebNotificationSound(): void {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Create oscillator for notification tone
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 880; // A5 note
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);

    // Second beep
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();

      osc2.connect(gain2);
      gain2.connect(audioContext.destination);

      osc2.frequency.value = 1046.5; // C6 note
      osc2.type = 'sine';

      gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.3);
    }, 150);
  } catch (error) {
    console.error('[NotificationSound] Web audio error:', error);
  }
}

/**
 * Web Audio API - Success chime
 */
function playWebSuccessSound(): void {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Success chord: C-E-G
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

    notes.forEach((freq, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = freq;
      oscillator.type = 'sine';

      const startTime = audioContext.currentTime + (index * 0.1);
      gainNode.gain.setValueAtTime(0.2, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.4);
    });
  } catch (error) {
    console.error('[NotificationSound] Web audio error:', error);
  }
}

/**
 * Enable/disable notification sounds
 */
export function setNotificationSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
}

/**
 * Check if notification sounds are enabled
 */
export function isNotificationSoundEnabled(): boolean {
  return soundEnabled;
}

/**
 * Cleanup sounds (call when app is closing)
 */
export async function cleanupNotificationSounds(): Promise<void> {
  try {
    if (notificationSound) {
      await notificationSound.unloadAsync();
      notificationSound = null;
    }
    if (successSound) {
      await successSound.unloadAsync();
      successSound = null;
    }
  } catch (error) {
    console.error('[NotificationSound] Error cleaning up sounds:', error);
  }
}
