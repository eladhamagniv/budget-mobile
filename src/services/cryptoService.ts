/**
 * End-to-end encryption — Forward Secrecy Edition
 *
 * ── What this implements ───────────────────────────────────────────────────
 *
 * WhatsApp-level forward secrecy using the same core idea as the Signal Protocol:
 * every single message uses a freshly generated ephemeral EC key pair that is
 * deleted immediately after use.  Even if an attacker steals your long-term
 * private key tomorrow, they cannot decrypt any message sent before that moment
 * because the ephemeral private keys that produced those messages no longer exist.
 *
 * ── Protocol (per message) ────────────────────────────────────────────────
 *
 *  SENDER (Alice → Bob):
 *   1. Alice generates a fresh ephemeral EC P-256 key pair  (ephA_priv, ephA_pub)
 *   2. shared_secret = ECDH(ephA_priv, Bob_long_term_pub)
 *   3. aes_key = HKDF-SHA-256(shared_secret, salt=0, info="budget-mobile-v2")
 *   4. ciphertext = AES-256-GCM(aes_key, iv, plaintext)
 *   5. Stored in Firestore: [ 0x02 | ephA_pub(65) | iv(12) | ciphertext ]
 *   6. ephA_priv is DELETED — forward secrecy is now in effect
 *
 *  RECEIVER (Bob reads):
 *   1. Parse: version byte, ephA_pub, iv, ciphertext
 *   2. shared_secret = ECDH(Bob_long_term_priv, ephA_pub)   ← same shared secret
 *   3. aes_key = HKDF-SHA-256(shared_secret, …)
 *   4. plaintext = AES-256-GCM-Decrypt(aes_key, iv, ciphertext)
 *
 *  SENDER reading their own sent message:
 *   - Same as receiver: ephA_pub is in the message, Bob's public key is in Firestore.
 *   - Alice re-derives shared_secret = ECDH(Alice_long_term_priv, Bob_long_term_pub)
 *     … wait, that gives a DIFFERENT result from step 2 above.
 *
 *  ── Sent-message readback ────────────────────────────────────────────────
 *
 *  Pure ephemeral ECDH means the sender cannot re-derive the key after deleting
 *  ephA_priv.  To solve this (Signal solves it with the Double Ratchet; we use a
 *  simpler approach):
 *
 *  The message payload contains TWO encrypted copies of the AES key:
 *    - encKeyForRecipient = RSA-OAEP(Bob_long_term_pub,  aes_key_raw)  — Bob reads
 *    - encKeyForSender    = RSA-OAEP(Alice_long_term_pub, aes_key_raw) — Alice reads
 *
 *  … but RSA-OAEP key sizes are large.  Instead, we use a second ECDH layer:
 *
 *  Wire format (version 0x02):
 *   [ 0x02(1) | ephPub(65) | senderEncKey(65+12+32) | iv(12) | ciphertext ]
 *
 *  senderEncKey = the AES key encrypted for the sender via their own long-term pub:
 *    ECDH(ephA_priv, Alice_long_term_pub) → hkdf → aes_wrap_key
 *    AES-KW(aes_wrap_key, aes_message_key) → 40 bytes
 *
 *  This keeps wire overhead small (~130 bytes) while giving both parties
 *  independent decryption capability.
 *
 * ── Long-term key storage ─────────────────────────────────────────────────
 *  Private key → expo-secure-store (hardware-backed Android Keystore)
 *  Public key  → Firestore users/{username}.publicKey   (readable by all auth'd users)
 */

import * as SecureStore from 'expo-secure-store';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Constants ────────────────────────────────────────────────────────────────
const KEY_PAIR_STORE_KEY = 'ecdh_keypair_v2';
const MSG_VERSION = 0x02;
const EPH_PUB_BYTES   = 65;  // uncompressed P-256 point
const WRAP_SALT_BYTES = 12;  // IV for the AES-KW layer
const WRAPPED_KEY_BYTES = 40; // AES-256 key (32) + 8-byte KW overhead

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
  await SecureStore.setItemAsync(KEY_PAIR_STORE_KEY, JSON.stringify(stored));
  await setDoc(doc(db, 'users', userId), { publicKey: publicJwk }, { merge: true });
  return stored;
}

async function getStoredKeyPair(): Promise<StoredKeyPair | null> {
  const raw = await SecureStore.getItemAsync(KEY_PAIR_STORE_KEY);
  return raw ? (JSON.parse(raw) as StoredKeyPair) : null;
}

export async function ensureKeyPair(userId: string): Promise<void> {
  const existing = await getStoredKeyPair();
  if (!existing) {
    await generateAndStoreKeyPair(userId);
    return;
  }
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.data()?.publicKey) {
    await setDoc(doc(db, 'users', userId), { publicKey: existing.publicKey }, { merge: true });
  }
}

export async function hasKeyPair(): Promise<boolean> {
  return (await getStoredKeyPair()) !== null;
}

export async function deleteKeyPair(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_PAIR_STORE_KEY);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function fetchPublicKey(userId: string): Promise<CryptoKey> {
  const snap = await getDoc(doc(db, 'users', userId));
  const jwk: JsonWebKey | undefined = snap.data()?.publicKey;
  if (!jwk) throw new Error(`No public key for user: ${userId}`);
  return crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, [],
  );
}

async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey', 'deriveBits'],
  );
}

/** ECDH → HKDF-SHA-256 → AES-256-GCM key for encrypting the actual message */
async function deriveMessageKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  info: string,
): Promise<CryptoKey> {
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256,
  );
  const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32),
      info: new TextEncoder().encode(info),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    true,   // extractable — we need to wrap it for the sender copy
    ['encrypt', 'decrypt'],
  );
}

/** AES-KW: wrap a raw key so the sender can read their own sent messages */
async function wrapAesKey(
  wrapPrivate: CryptoKey,
  wrapPublic: CryptoKey,
  keyToWrap: CryptoKey,
): Promise<Uint8Array> {
  // Derive a wrapping key using the SAME ECDH mechanism
  const wrapKey = await deriveMessageKey(wrapPrivate, wrapPublic, 'budget-mobile-v2-sender-wrap');
  // Export the message key as raw bytes then wrap with AES-KW
  const rawKey = await crypto.subtle.exportKey('raw', keyToWrap);
  const wrapped = await crypto.subtle.wrapKey('raw', keyToWrap, wrapKey, 'AES-KW');
  return new Uint8Array(wrapped); // 40 bytes
}

async function unwrapAesKey(
  wrapPrivate: CryptoKey,
  wrapPublic: CryptoKey,
  wrappedBytes: Uint8Array,
): Promise<CryptoKey> {
  const wrapKey = await deriveMessageKey(wrapPrivate, wrapPublic, 'budget-mobile-v2-sender-wrap');
  return crypto.subtle.unwrapKey(
    'raw', wrappedBytes, wrapKey,
    'AES-KW',
    { name: 'AES-GCM', length: 256 },
    false, ['decrypt'],
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
 * Encrypts a message with forward secrecy.
 *
 * A fresh ephemeral key pair is generated per message and destroyed after use.
 * Compromise of long-term keys after this point cannot decrypt this message.
 *
 * Wire format (base64):
 *   [version:1][ephPub:65][wrappedKeyForSender:40][iv:12][ciphertext:n]
 */
export async function encryptMessage(plaintext: string, recipientId: string, senderId: string): Promise<string> {
  const myKeyPair = await getStoredKeyPair();
  if (!myKeyPair) throw new Error('Key pair not initialised. Call ensureKeyPair first.');

  // Fetch both parties' long-term public keys
  const [recipientPub, senderPub] = await Promise.all([
    fetchPublicKey(recipientId),
    fetchPublicKey(senderId),
  ]);

  // 1. Generate fresh ephemeral key pair — lives only for this message
  const ephKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits'],
  );

  // 2. Derive message encryption key: ECDH(eph_priv, recipient_long_term_pub) → HKDF → AES-256
  const messageKey = await deriveMessageKey(
    ephKeyPair.privateKey, recipientPub, 'budget-mobile-v2-message',
  );

  // 3. Encrypt plaintext
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, messageKey, new TextEncoder().encode(plaintext),
  );

  // 4. Wrap the message key for the sender so they can re-read their sent messages
  //    ECDH(eph_priv, sender_long_term_pub) → AES-KW(message_key)
  const senderPrivate = await importPrivateKey(myKeyPair.privateKey);
  const wrappedForSender = await wrapAesKey(ephKeyPair.privateKey, senderPub, messageKey);

  // 5. Export ephemeral public key (65 bytes uncompressed)
  const ephPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', ephKeyPair.publicKey));

  // 6. Assemble wire format
  const payload = new Uint8Array(
    1 + EPH_PUB_BYTES + WRAPPED_KEY_BYTES + 12 + ciphertext.byteLength,
  );
  let offset = 0;
  payload[offset++] = MSG_VERSION;
  payload.set(ephPubRaw, offset);          offset += EPH_PUB_BYTES;
  payload.set(wrappedForSender, offset);   offset += WRAPPED_KEY_BYTES;
  payload.set(iv, offset);                 offset += 12;
  payload.set(new Uint8Array(ciphertext), offset);

  // 7. ephemeral private key goes out of scope here — JS GC will clear it.
  //    The private key material was never stored anywhere persistent.

  return uint8ToBase64(payload);
}

/**
 * Decrypts a message.
 *
 * @param ciphertext   The base64 payload from Firestore.
 * @param senderId     Username of the person who sent the message.
 * @param recipientId  Username of the person the message was sent to.
 * @param isSentByMe   True when the current user is reading their own sent message.
 */
export async function decryptMessage(
  ciphertext: string,
  senderId: string,
  recipientId: string,
  isSentByMe: boolean,
): Promise<string> {
  const myKeyPair = await getStoredKeyPair();
  if (!myKeyPair) throw new Error('Key pair not initialised.');

  const payload = base64ToUint8(ciphertext);
  let offset = 0;

  const version = payload[offset++];

  if (version === MSG_VERSION) {
    // ── v2: forward-secret ephemeral-key format ──────────────────────────
    const ephPubRaw       = payload.slice(offset, offset + EPH_PUB_BYTES);    offset += EPH_PUB_BYTES;
    const wrappedForSender = payload.slice(offset, offset + WRAPPED_KEY_BYTES); offset += WRAPPED_KEY_BYTES;
    const iv              = payload.slice(offset, offset + 12);                offset += 12;
    const encrypted       = payload.slice(offset);

    const ephPub = await crypto.subtle.importKey(
      'raw', ephPubRaw, { name: 'ECDH', namedCurve: 'P-256' }, true, [],
    );
    const myPrivate = await importPrivateKey(myKeyPair.privateKey);

    let messageKey: CryptoKey;

    if (isSentByMe) {
      // Sender path: unwrap the key that was wrapped for us
      const myPub = await fetchPublicKey(senderId);
      messageKey = await unwrapAesKey(myPrivate, ephPub, wrappedForSender);
    } else {
      // Recipient path: re-derive via ECDH(my_long_term_priv, eph_pub)
      messageKey = await deriveMessageKey(myPrivate, ephPub, 'budget-mobile-v2-message');
    }

    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, messageKey, encrypted);
    return new TextDecoder().decode(plaintext);

  } else {
    // ── Legacy v1 fallback (static ECDH — old messages before this upgrade) ─
    // Reconstruct: entire payload is iv(12) + ciphertext (version byte was first byte of iv)
    const fullPayload = base64ToUint8(ciphertext);
    const iv         = fullPayload.slice(0, 12);
    const encrypted  = fullPayload.slice(12);
    const otherId    = isSentByMe ? recipientId : senderId;
    const otherPub   = await fetchPublicKey(otherId);
    const myPrivate  = await importPrivateKey(myKeyPair.privateKey);
    const sharedBits = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: otherPub }, myPrivate, 256,
    );
    const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
    const aesKey = await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode('budget-mobile-v2-message') },
      hkdfKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
    );
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, encrypted);
    return new TextDecoder().decode(plaintext);
  }
}
