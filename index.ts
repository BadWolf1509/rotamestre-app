/**
 * Custom entry point for Expo Router + Unistyles 3.0
 */

console.log('[RotaMestre] index.ts starting...');

// IMPORTANT: Configure Unistyles FIRST, before expo-router/entry
import './src/unistyles';
console.log('[RotaMestre] unistyles configured');

// Now load the Expo Router entry point
import 'expo-router/entry';
console.log('[RotaMestre] expo-router loaded');
