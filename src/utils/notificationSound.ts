/**
 * Notification Sound utility
 * Plays sounds for important events (new route, completion, etc.)
 *
 * Uses Web Audio API for cross-platform synthesized sounds
 * (no external dependencies, works offline)
 */

import { createAudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

import { logger } from '@/lib/logger';

let webAudioContext: AudioContext | null = null;
let webAudioUnlocked = false;
let webAudioUnlockListenersAttached = false;

function canStartWebAudio(): boolean {
  if (typeof navigator !== 'undefined') {
    const activation = (
      navigator as unknown as import('@/types/web-apis').NavigatorWithUserActivation
    ).userActivation;
    if (activation?.hasBeenActive || activation?.isActive) {
      webAudioUnlocked = true;
    }
  }

  return webAudioUnlocked;
}

function attachWebAudioUnlockListeners(): void {
  if (webAudioUnlockListenersAttached) return;
  if (
    typeof window === 'undefined' ||
    typeof window.addEventListener !== 'function'
  )
    return;

  webAudioUnlockListenersAttached = true;

  const unlock = () => {
    webAudioUnlocked = true;

    if (webAudioContext && webAudioContext.state === 'suspended') {
      webAudioContext.resume().catch(() => {});
    }
  };

  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}

function getWebAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!canStartWebAudio()) {
    attachWebAudioUnlockListeners();
    return null;
  }

  const AudioContextConstructor =
    window.AudioContext ||
    (window as unknown as import('@/types/web-apis').WindowWithWebkitAudio)
      .webkitAudioContext;
  if (!AudioContextConstructor) return null;

  if (!webAudioContext || webAudioContext.state === 'closed') {
    webAudioContext = new AudioContextConstructor();
  }

  if (webAudioContext.state === 'suspended') {
    webAudioContext.resume().catch(() => {});
  }

  return webAudioContext;
}

/**
 * Play notification sound (for new route, alerts)
 * Uses synthesized sound via Web Audio API (works on all platforms)
 */
export async function playNotificationSound(): Promise<void> {
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
    logger.error(
      '[NotificationSound] Error playing notification sound:',
      error,
    );
  }
}

/**
 * Monta um data URI WAV de um beep sintetizado (sine wave).
 */
function buildBeepDataUri(
  samples: number,
  sampleRate: number,
  frequency: number,
): string {
  const wavData = createWavData(samples, sampleRate, frequency);
  const base64 = arrayBufferToBase64(wavData);
  return `data:audio/wav;base64,${base64}`;
}

/**
 * Toca um beep curto via expo-audio (substitui expo-av, descontinuado no SDK 56).
 * Beeps têm <= 200ms; o player é liberado após uma margem.
 */
function playBeep(dataUri: string, volume: number): void {
  const player = createAudioPlayer({ uri: dataUri });
  player.volume = volume;
  player.play();
  setTimeout(() => {
    try {
      player.remove();
    } catch {
      // player já removido
    }
  }, 600);
}

/**
 * Mobile notification sound (dois beeps A5 + C6) via expo-audio
 */
async function playMobileNotificationSound(): Promise<void> {
  try {
    const sampleRate = 44100;
    const samples = Math.floor(sampleRate * 0.15); // 150ms

    playBeep(buildBeepDataUri(samples, sampleRate, 880), 0.7); // A5

    setTimeout(() => {
      playBeep(buildBeepDataUri(samples, sampleRate, 1046.5), 0.7); // C6
    }, 150);
  } catch (error) {
    logger.error('[NotificationSound] Mobile sound error:', error);
  }
}

/**
 * Create WAV data for a simple sine wave tone
 */
function createWavData(
  samples: number,
  sampleRate: number,
  frequency: number,
): ArrayBuffer {
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
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
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
    const audioContext = getWebAudioContext();
    if (!audioContext) return;

    // Create oscillator for notification tone
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 880; // A5 note
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.3,
    );

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
      gain2.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.3,
      );

      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.3);
    }, 150);
  } catch (error) {
    logger.error('[NotificationSound] Web audio error:', error);
  }
}
