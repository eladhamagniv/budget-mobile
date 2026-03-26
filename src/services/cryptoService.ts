/**
 * End-to-end encryption service.
 *
 * Algorithm: ECDH P-256 key agreement → AES-256-GCM message encryption.
 *
 * Each user has an EC P-256 key pair:
 *   - Private key  → stored in expo-secure-store (hardware-backed Android Keystore)
 *   - Public key   → stored in Firestore users/{username}.publicKey (readable by all authed users)
 *
 * For a message from A to B:
 *   A derives shared secret = ECDH(A_private, B_public)
 *   B derives shared secret = ECDH(B_private, A_public)   ← identical shared secret
 *   Both use this shared secret as the AES-256-GCM key.
 *   A can also decrypt their own sent messages (using the same key derivation).
 *
 * Wire format (base64):  [12-byte IV][ciphertext]
 */

import * as SecureStore from 'expo-secure-store';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── SecureStore key ──────────────────────────────────────────────────────────
const KEY_PAIR_STORE_KEY = 'ecdh_keypair_v1';

interface StoredKeyPair {
  privateKey: JsonWebKey;
  publicKey: JsonWebKey;
}

// ─── Key pair management ──────────────────────────────────────────────────────

async function generateAndStoreKeyPair(userId: string): Promise<StoredKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );
  const [privateJwk, publicJwk] = await Promise.all([
    crypto.subtle.exportKey('jwk', keyPair.privateKey),
    crypto.subtle.exportKey('jwk', keyPair.publicKey),
  ]);
  const stored: StoredKeyPair = { privateKey: privateJwk, publicKey: publicJwk };
  // Store both keys locally (private stays local, public also goes to Firestore)
  await SecureStore.setItemAsync(KEY_PAIR_STORE_KEY, JSON.stringify(stored));
  await setDoc(doc(db, 'users', userId), { publicKey: publicJwk }, { merge: true });
  return stored;
}

async function getStoredKeyPair(): Promise<StoredKeyPair | null> {
  const raw = await SecureStore.getItemAsync(KEY_PAIR_STORE_KEY);
  return raw ? (JSON.parse(raw) as StoredKeyPair) : null;
}

/**
 * Call once after login.
 * Generates the key pair if it doesn't exist yet, and ensures the public key
 * is uploaded to Firestore so other users can encrypt messages to this user.
 */
export async function ensureKeyPair(userId: string): Promise<void> {
  const existing = await getStoredKeyPair();
  if (!existing) {
    await generateAndStoreKeyPair(userId);
    return;
  }
  // Re-upload public key if it was somehow lost from Firestore
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.data()?.publicKey) {
    await setDoc(doc(db, 'users', userId), { publicKey: existing.publicKey }, { merge: true });
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function fetchPublicKey(userId: string): Promise<CryptoKey> {
  const snap = await getDoc(doc(db, 'users', userId));
  const jwk: JsonWebKey | undefined = snap.data()?.publicKey;
  if (!jwk) throw new Error(`publicKey missing for user: ${userId}`);
  return crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
}

async function deriveSharedAesKey(myPrivateJwk: JsonWebKey, theirPublic: CryptoKey): Promise<CryptoKey> {
  const myPrivate = await crypto.subtle.importKey(
    'jwk', myPrivateJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey', 'deriveBits'],
  );
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublic },
    myPrivate,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext message for a given recipient.
 * Returns a base64 string: [12-byte IV][AES-GCM ciphertext].
 */
export async function encryptMessage(plaintext: string, recipientId: string): Promise<string> {
  const keyPair = await getStoredKeyPair();
  if (!keyPair) throw new Error('Encryption key pair not initialised. Call ensureKeyPair first.');

  const theirPublic = await fetchPublicKey(recipientId);
  const sharedKey = await deriveSharedAesKey(keyPair.privateKey, theirPublic);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sharedKey, encoded);

  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);
  return uint8ToBase64(combined);
}

/**
 * Decrypts a message.
 * `otherUserId` is always the OTHER party in the conversation
 * (the sender when you're the recipient, or the recipient when you're the sender).
 * Both directions derive the identical ECDH shared key.
 */
export async function decryptMessage(ciphertext: string, otherUserId: string): Promise<string> {
  const keyPair = await getStoredKeyPair();
  if (!keyPair) throw new Error('Encryption key pair not initialised. Call ensureKeyPair first.');

  const theirPublic = await fetchPublicKey(otherUserId);
  const sharedKey = await deriveSharedAesKey(keyPair.privateKey, theirPublic);

  const combined = base64ToUint8(ciphertext);
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, sharedKey, data);
  return new TextDecoder().decode(plaintext);
}

/** Returns true if the current device has a key pair stored (i.e. user has logged in before). */
export async function hasKeyPair(): Promise<boolean> {
  const kp = await getStoredKeyPair();
  return kp !== null;
}

/** Wipes the local private key — call on logout if required. */
export async function deleteKeyPair(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_PAIR_STORE_KEY);
}
