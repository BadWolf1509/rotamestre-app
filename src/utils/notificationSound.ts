/**
 * Notification Sound utility
 * Plays sounds for important events (new route, completion, etc.)
 *
 * Uses Web Audio API for cross-platform synthesized sounds
 * (no external dependencies, works offline)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

// Storage key for sound preference
const SOUND_ENABLED_KEY = '@rotamestre:notification_sound_enabled';

// Sound enabled flag (can be controlled by user settings)
let soundEnabled = true;
let soundPreferenceLoaded = false;

/**
 * Initialize audio mode and load sound preference from storage
 */
export async function initializeNotificationAudio(): Promise<void> {
  // Load sound preference from storage
  await loadSoundPreference();

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
 * Load sound preference from AsyncStorage
 */
async function loadSoundPreference(): Promise<void> {
  if (soundPreferenceLoaded) return;

  try {
    const stored = await AsyncStorage.getItem(SOUND_ENABLED_KEY);
    if (stored !== null) {
      soundEnabled = stored === 'true';
    }
    soundPreferenceLoaded = true;
  } catch (error) {
    console.error('[NotificationSound] Error loading sound preference:', error);
  }
}

/**
 * Play notification sound (for new route, alerts)
 * Uses synthesized sound via Web Audio API (works on all platforms)
 */
export async function playNotificationSound(): Promise<void> {
  // Ensure preference is loaded
  if (!soundPreferenceLoaded) {
    await loadSoundPreference();
  }

  if (!soundEnabled) return;

  // Use Web Audio API for all platforms (synthesized, no external deps)
  if (Platform.OS === 'web') {
    playWebNotificationSound();
    return;
  }

  // For mobile, use expo-av with synthesized tones via Web Audio API polyfill
  // or fall back to a simple beep
  try {
    // Try Web Audio approach first (works on newer React Native)
    playMobileNotificationSound();
  } catch (error) {
    console.error('[NotificationSound] Error playing notification sound:', error);
  }
}

/**
 * Play success sound (for route completion, stop completion)
 */
export async function playSuccessSound(): Promise<void> {
  if (!soundPreferenceLoaded) {
    await loadSoundPreference();
  }

  if (!soundEnabled) return;

  if (Platform.OS === 'web') {
    playWebSuccessSound();
    return;
  }

  try {
    playMobileSuccessSound();
  } catch (error) {
    console.error('[NotificationSound] Error playing success sound:', error);
  }
}

/**
 * Mobile notification sound using expo-av with data URI
 * Creates a simple beep tone without external dependencies
 */
async function playMobileNotificationSound(): Promise<void> {
  try {
    // Generate a simple sine wave beep as base64 WAV
    const sampleRate = 44100;
    const duration = 0.15; // 150ms
    const frequency = 880; // A5 note
    const samples = Math.floor(sampleRate * duration);

    // Create WAV header and data
    const wavData = createWavData(samples, sampleRate, frequency);
    const base64 = arrayBufferToBase64(wavData);
    const dataUri = `data:audio/wav;base64,${base64}`;

    const { sound } = await Audio.Sound.createAsync(
      { uri: dataUri },
      { shouldPlay: true, volume: 0.7 }
    );

    // Play second beep after a short delay
    setTimeout(async () => {
      try {
        const frequency2 = 1046.5; // C6 note
        const wavData2 = createWavData(samples, sampleRate, frequency2);
        const base64_2 = arrayBufferToBase64(wavData2);
        const dataUri2 = `data:audio/wav;base64,${base64_2}`;

        const { sound: sound2 } = await Audio.Sound.createAsync(
          { uri: dataUri2 },
          { shouldPlay: true, volume: 0.7 }
        );

        sound2.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            sound2.unloadAsync();
          }
        });
      } catch {
        // Silently fail on second beep
      }
    }, 150);

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch (error) {
    console.error('[NotificationSound] Mobile sound error:', error);
  }
}

/**
 * Mobile success sound
 */
async function playMobileSuccessSound(): Promise<void> {
  try {
    const sampleRate = 44100;
    const duration = 0.2;
    const samples = Math.floor(sampleRate * duration);

    // Success chord: C5, E5, G5 played in sequence
    const notes = [523.25, 659.25, 783.99];

    for (let i = 0; i < notes.length; i++) {
      setTimeout(async () => {
        try {
          const wavData = createWavData(samples, sampleRate, notes[i]);
          const base64 = arrayBufferToBase64(wavData);
          const dataUri = `data:audio/wav;base64,${base64}`;

          const { sound } = await Audio.Sound.createAsync(
            { uri: dataUri },
            { shouldPlay: true, volume: 0.5 }
          );

          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              sound.unloadAsync();
            }
          });
        } catch {
          // Silently fail
        }
      }, i * 100);
    }
  } catch (error) {
    console.error('[NotificationSound] Mobile success sound error:', error);
  }
}

/**
 * Create WAV data for a simple sine wave tone
 */
function createWavData(samples: number, sampleRate: number, frequency: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (PCM)
  view.setUint16(22, 1, true); // NumChannels
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(view, 36, 'data');
  view.setUint32(40, samples * 2, true);

  // Generate sine wave with envelope
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const envelope = Math.exp(-t * 10); // Decay envelope
    const sample = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.5;
    view.setInt16(44 + i * 2, sample * 32767, true);
  }

  return buffer;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // Use btoa for web, or manual encoding for React Native
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  // React Native polyfill
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  while (i < binary.length) {
    const a = binary.charCodeAt(i++);
    const b = binary.charCodeAt(i++);
    const c = binary.charCodeAt(i++);
    result += chars[a >> 2];
    result += chars[((a & 3) << 4) | (b >> 4)];
    result += chars[((b & 15) << 2) | (c >> 6)];
    result += chars[c & 63];
  }
  const padding = binary.length % 3;
  if (padding === 1) {
    result = result.slice(0, -2) + '==';
  } else if (padding === 2) {
    result = result.slice(0, -1) + '=';
  }
  return result;
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
 * Enable/disable notification sounds (persisted to storage)
 */
export async function setNotificationSoundEnabled(enabled: boolean): Promise<void> {
  soundEnabled = enabled;

  try {
    await AsyncStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  } catch (error) {
    console.error('[NotificationSound] Error saving sound preference:', error);
  }
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
  // No cleanup needed for synthesized sounds
}
