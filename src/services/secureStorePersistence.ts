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

/**
 * SecureStore only accepts keys that are alphanumeric + underscore + hyphen.
 * Firebase passes keys like "firebase:authUser:apiKey:[DEFAULT]" which contain
 * colons and brackets — we sanitize them to a safe form before storage.
 * The mapping is deterministic so the same Firebase key always maps to the same
 * SecureStore key.
 */
function sanitizeKey(key: string): string {
  // Replace any character that isn't alphanumeric, underscore, or hyphen with '_'
  return 'fb_' + key.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

function chunkKey(base: string, i: number) {
  return `${base}__c${i}`;
}

async function secureSet(key: string, value: string): Promise<void> {
  const k = sanitizeKey(key);
  if (value.length <= CHUNK_SIZE) {
    await SecureStore.setItemAsync(k, value);
    await SecureStore.deleteItemAsync(k + CHUNK_COUNT_SUFFIX).catch(() => {});
    return;
  }
  const chunks = Math.ceil(value.length / CHUNK_SIZE);
  await SecureStore.setItemAsync(k + CHUNK_COUNT_SUFFIX, String(chunks));
  for (let i = 0; i < chunks; i++) {
    await SecureStore.setItemAsync(
      chunkKey(k, i),
      value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
    );
  }
  await SecureStore.deleteItemAsync(k).catch(() => {});
}

async function secureGet(key: string): Promise<string | null> {
  const k = sanitizeKey(key);
  const countStr = await SecureStore.getItemAsync(k + CHUNK_COUNT_SUFFIX);
  if (!countStr) {
    return SecureStore.getItemAsync(k);
  }
  const count = parseInt(countStr, 10);
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const part = await SecureStore.getItemAsync(chunkKey(k, i));
    if (part === null) return null;
    parts.push(part);
  }
  return parts.join('');
}

async function secureRemove(key: string): Promise<void> {
  const k = sanitizeKey(key);
  const countStr = await SecureStore.getItemAsync(k + CHUNK_COUNT_SUFFIX);
  if (countStr) {
    const count = parseInt(countStr, 10);
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(chunkKey(k, i)).catch(() => {});
    }
    await SecureStore.deleteItemAsync(k + CHUNK_COUNT_SUFFIX).catch(() => {});
  }
  await SecureStore.deleteItemAsync(k).catch(() => {});
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
