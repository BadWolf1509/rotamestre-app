import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import type { SupportedStorage } from '@supabase/supabase-js';

const CHUNK_SIZE = 1800;

function metadataKey(key: string) {
  return `${key}.secure.meta`;
}

function chunkKey(key: string, index: number) {
  return `${key}.secure.${index}`;
}

async function readChunkCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(metadataKey(key));
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

async function removeSecureValue(key: string): Promise<void> {
  const chunkCount = await readChunkCount(key);
  await Promise.all([
    ...Array.from({ length: chunkCount }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, index)),
    ),
    SecureStore.deleteItemAsync(metadataKey(key)),
  ]);
}

async function writeSecureValue(key: string, value: string): Promise<void> {
  await removeSecureValue(key);

  const chunks = Array.from(
    { length: Math.ceil(value.length / CHUNK_SIZE) },
    (_, index) => value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
  );

  await Promise.all(
    chunks.map((chunk, index) =>
      SecureStore.setItemAsync(chunkKey(key, index), chunk),
    ),
  );
  await SecureStore.setItemAsync(metadataKey(key), String(chunks.length));
}

/**
 * Armazena somente a sessão de autenticação no cofre criptografado do sistema.
 * Na primeira leitura após a atualização, migra silenciosamente a sessão que
 * versões anteriores mantinham no AsyncStorage.
 */
export const secureAuthStorage: SupportedStorage = {
  async getItem(key) {
    const chunkCount = await readChunkCount(key);
    if (chunkCount > 0) {
      const chunks = await Promise.all(
        Array.from({ length: chunkCount }, (_, index) =>
          SecureStore.getItemAsync(chunkKey(key, index)),
        ),
      );
      return chunks.every((chunk): chunk is string => chunk !== null)
        ? chunks.join('')
        : null;
    }

    const legacyValue = await AsyncStorage.getItem(key);
    if (legacyValue) {
      await writeSecureValue(key, legacyValue);
      await AsyncStorage.removeItem(key);
    }
    return legacyValue;
  },

  async setItem(key, value) {
    await writeSecureValue(key, value);
    await AsyncStorage.removeItem(key);
  },

  async removeItem(key) {
    await Promise.all([removeSecureValue(key), AsyncStorage.removeItem(key)]);
  },
};
