/**
 * SecureStore-backed Firebase Auth persistence.
 * Replaces AsyncStorage (unencrypted) so Firebase tokens are stored in the
 * Android Keystore / iOS Secure Enclave — hardware-backed encryption at rest.
 *
 * Implements the AsyncStorage-compatible interface that Firebase's
 * getReactNativePersistence() expects.
 *
 * Large values are chunked at 1800 bytes to stay within Keychain limits on iOS.
 */
import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800;
const CHUNK_COUNT_SUFFIX = '__n';

function chunkKey(base: string, i: number) {
  return `${base}__c${i}`;
}

async function secureSet(key: string, value: string): Promise<void> {
  if (value.length <= CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value);
    // Clean up any old chunks from a previous larger value
    await SecureStore.deleteItemAsync(key + CHUNK_COUNT_SUFFIX).catch(() => {});
    return;
  }
  const chunks = Math.ceil(value.length / CHUNK_SIZE);
  await SecureStore.setItemAsync(key + CHUNK_COUNT_SUFFIX, String(chunks));
  for (let i = 0; i < chunks; i++) {
    await SecureStore.setItemAsync(
      chunkKey(key, i),
      value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
    );
  }
  // Remove un-chunked key in case value grew beyond chunk size
  await SecureStore.deleteItemAsync(key).catch(() => {});
}

async function secureGet(key: string): Promise<string | null> {
  const countStr = await SecureStore.getItemAsync(key + CHUNK_COUNT_SUFFIX);
  if (!countStr) {
    // Single value (not chunked)
    return SecureStore.getItemAsync(key);
  }
  const count = parseInt(countStr, 10);
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const part = await SecureStore.getItemAsync(chunkKey(key, i));
    if (part === null) return null; // Incomplete — treat as missing
    parts.push(part);
  }
  return parts.join('');
}

async function secureRemove(key: string): Promise<void> {
  const countStr = await SecureStore.getItemAsync(key + CHUNK_COUNT_SUFFIX);
  if (countStr) {
    const count = parseInt(countStr, 10);
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(chunkKey(key, i)).catch(() => {});
    }
    await SecureStore.deleteItemAsync(key + CHUNK_COUNT_SUFFIX).catch(() => {});
  }
  await SecureStore.deleteItemAsync(key).catch(() => {});
}

/**
 * Drop-in AsyncStorage replacement backed by SecureStore.
 * Pass this object to getReactNativePersistence() in firebase.ts.
 */
export const SecureStorageAdapter = {
  getItem: (key: string) => secureGet(key),
  setItem: (key: string, value: string) => secureSet(key, value),
  removeItem: (key: string) => secureRemove(key),
};
