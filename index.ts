/**
 * Custom entry point for Expo Router + Unistyles 3.0
 *
 * This file ensures Unistyles is configured BEFORE any components are loaded.
 * Expo Router resolves routes differently and Unistyles 3.0 parses StyleSheets
 * as soon as you import a file containing them.
 *
 * @see https://www.unistyl.es/v3/guides/expo-router
 */

// IMPORTANT: Configure Unistyles FIRST, before expo-router/entry
// This prevents "Unistyles is not initialized correctly" errors
import './src/unistyles';

// Now load the Expo Router entry point
import 'expo-router/entry';