import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { signInWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseAuth, db } from '../config/firebase';
import { ensureKeyPair } from '../services/cryptoService';
import { UserProfile } from '../types';

// ─── Storage keys ──────────────────────────────────────────────────────────────
const SESSION_KEY    = 'auth_session_v3';              // { profile, expiry: ms timestamp }
const deviceKeyStore = (u: string) => `device_key_${u}`; // 256-bit random, per user per device
const LOCKOUT_KEY    = 'login_lockout_v1';             // { attempts, lockedUntil }

const AUTH_EMAIL_DOMAIN = 'idf.budget';
const SESSION_DAYS      = 7;
const MAX_ATTEMPTS      = 5; // failed logins before lockout kicks in

// ─── Lockout schedule ─────────────────────────────────────────────────────────
// attempts 5–9  → 5-minute lock
// attempts 10–14 → 30-minute lock
// attempts 15+   → 24-hour lock
function lockDurationMs(attempts: number): number {
  if (attempts >= 15) return 24 * 60 * 60 * 1000;
  if (attempts >= 10) return 30 * 60 * 1000;
  return 5 * 60 * 1000;
}

interface LockoutState {
  attempts: number;
  lockedUntil: number; // ms timestamp, 0 = not locked
}

async function getLockout(): Promise<LockoutState> {
  try {
    const raw = await SecureStore.getItemAsync(LOCKOUT_KEY);
    return raw ? JSON.parse(raw) : { attempts: 0, lockedUntil: 0 };
  } catch {
    return { attempts: 0, lockedUntil: 0 };
  }
}

async function saveLockout(state: LockoutState): Promise<void> {
  await SecureStore.setItemAsync(LOCKOUT_KEY, JSON.stringify(state)).catch(() => {});
}

async function clearLockout(): Promise<void> {
  await SecureStore.deleteItemAsync(LOCKOUT_KEY).catch(() => {});
}

// ─── Password derivation ───────────────────────────────────────────────────────

async function getOrCreateDeviceKey(username: string): Promise<string> {
  const storeKey = deviceKeyStore(username);
  const existing = await SecureStore.getItemAsync(storeKey);
  if (existing) return existing;
  const bytes = await Crypto.getRandomBytesAsync(32);
  const key = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(storeKey, key);
  return key;
}

/**
 * Device-bound password derivation (v3).
 *
 * password = 200 × SHA-256( "username:deviceKey:idf.budget.v3" : rawPassword )
 *
 * - deviceKey: 256-bit random, stored in Android Keystore — without the physical
 *   device this password cannot be computed even with the correct raw password.
 * - username salt: unique password per user even if raw passwords collide.
 * - 200 rounds: multiplies brute-force cost by 200×.
 * - Output: 64-char hex string (Firebase accepts up to 4096 chars).
 */
async function derivePasswordV3(
  username: string,
  rawPassword: string,
  deviceKey: string,
): Promise<string> {
  const salt = `${username.toLowerCase()}:${deviceKey}:idf.budget.v3`;
  let hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${rawPassword.trim()}`,
  );
  for (let i = 1; i < 200; i++) {
    hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${hash}:${salt}`,
    );
  }
  return hash;
}

/** Legacy v1 password — used only once during self-migration on first launch. */
function derivePasswordV1(rawPassword: string): string {
  return '1' + rawPassword.trim();
}

// ─── Session helpers ───────────────────────────────────────────────────────────

function newExpiry(): number {
  return Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
}

// ─── Context types ─────────────────────────────────────────────────────────────

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  lockoutSeconds: number; // > 0 when login is locked out
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]                   = useState<UserProfile | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [expiry, setExpiry]               = useState<number | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const lockoutTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Restore session on app start ──────────────────────────────────────────
  useEffect(() => {
    SecureStore.getItemAsync(SESSION_KEY)
      .then(raw => {
        if (raw) {
          const parsed = JSON.parse(raw) as { profile: UserProfile; expiry: number };
          if (Date.now() < parsed.expiry) {
            setUser(parsed.profile);
            setExpiry(parsed.expiry);
          } else {
            SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ── Auto-logout when 7-day window closes (app open) ───────────────────────
  useEffect(() => {
    if (!expiry) return;
    const msLeft = expiry - Date.now();
    if (msLeft <= 0) {
      setUser(null);
      SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
      return;
    }
    const t = setTimeout(() => {
      setUser(null);
      SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
    }, msLeft);
    return () => clearTimeout(t);
  }, [expiry]);

  // ── Restore lockout countdown on app start ────────────────────────────────
  useEffect(() => {
    getLockout().then(({ lockedUntil }) => {
      if (lockedUntil > Date.now()) {
        startLockoutCountdown(lockedUntil);
      }
    });
    return () => { if (lockoutTimer.current) clearInterval(lockoutTimer.current); };
  }, []);

  function startLockoutCountdown(lockedUntil: number) {
    if (lockoutTimer.current) clearInterval(lockoutTimer.current);
    const tick = () => {
      const secs = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setLockoutSeconds(secs);
      if (secs === 0 && lockoutTimer.current) {
        clearInterval(lockoutTimer.current);
        lockoutTimer.current = null;
      }
    };
    tick();
    lockoutTimer.current = setInterval(tick, 1000);
  }

  const saveSession = (profile: UserProfile) => {
    const exp = newExpiry();
    setExpiry(exp);
    return SecureStore.setItemAsync(
      SESSION_KEY,
      JSON.stringify({ profile, expiry: exp }),
    ).catch(() => {});
  };

  // ─── Login ────────────────────────────────────────────────────────────────
  const login = async (username: string, rawPassword: string) => {
    setError(null);

    // ── Check lockout before even trying ──────────────────────────────────
    const lockout = await getLockout();
    if (lockout.lockedUntil > Date.now()) {
      const secs = Math.ceil((lockout.lockedUntil - Date.now()) / 1000);
      setLockoutSeconds(secs);
      return;
    }

    setLoading(true);
    try {
      const normalUsername = username.toLowerCase().trim();
      const email = `${normalUsername}@${AUTH_EMAIL_DOMAIN}`;
      const existingDeviceKey = await SecureStore.getItemAsync(deviceKeyStore(normalUsername));

      if (existingDeviceKey) {
        // ── Normal login: this user already has a device key → v3 scheme ──
        const firebasePassword = await derivePasswordV3(normalUsername, rawPassword, existingDeviceKey);
        await signInWithEmailAndPassword(firebaseAuth, email, firebasePassword);
      } else {
        // ── First login for this user: self-migrate v1 → v3 ───────────────
        // Sign in with the original migration password ('1' + raw password).
        const v1Password = derivePasswordV1(rawPassword);
        await signInWithEmailAndPassword(firebaseAuth, email, v1Password);

        // Generate this user's device key and upgrade their Firebase password.
        const deviceKey = await getOrCreateDeviceKey(normalUsername);
        const v3Password = await derivePasswordV3(normalUsername, rawPassword, deviceKey);
        if (firebaseAuth.currentUser) {
          await updatePassword(firebaseAuth.currentUser, v3Password);
        }
      }

      // ── Success: clear lockout ─────────────────────────────────────────
      await clearLockout();
      setLockoutSeconds(0);
      if (lockoutTimer.current) { clearInterval(lockoutTimer.current); lockoutTimer.current = null; }

      // ── Fetch Firestore profile ────────────────────────────────────────
      const profileDoc = await getDoc(doc(db, 'users', username.toLowerCase().trim()));
      if (!profileDoc.exists()) throw new Error('פרופיל משתמש לא נמצא');
      const data = profileDoc.data();
      const profile: UserProfile = {
        id: data.username,
        displayName: data.displayName,
        username: data.username,
        role: data.role,
        unitId: data.unitId,
      };

      setUser(profile);
      saveSession(profile);
      ensureKeyPair(profile.username).catch(() => {});

    } catch (e: any) {
      console.error('[AuthContext] login error:', e?.code, e?.message);
      const code: string = e?.code ?? '';

      if (
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/invalid-email'
      ) {
        // ── Record failed attempt and apply lockout if needed ────────────
        const current = await getLockout();
        const attempts = current.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          const lockedUntil = Date.now() + lockDurationMs(attempts);
          await saveLockout({ attempts, lockedUntil });
          startLockoutCountdown(lockedUntil);
          const mins = Math.round(lockDurationMs(attempts) / 60000);
          setError(`יותר מדי ניסיונות כושלים. הגישה נחסמת ל-${mins} דקות`);
        } else {
          await saveLockout({ attempts, lockedUntil: 0 });
          const remaining = MAX_ATTEMPTS - attempts;
          setError(`שם משתמש או סיסמה שגויים · נותרו ${remaining} ניסיונות`);
        }
      } else if (code === 'auth/too-many-requests') {
        setError('יותר מדי ניסיונות. נסה שוב מאוחר יותר');
      } else if (code === 'auth/network-request-failed') {
        setError('אין חיבור לרשת');
      } else if (code === 'permission-denied' || e?.message?.includes('permission')) {
        setError('שגיאת הרשאות. פנה למנהל המערכת');
      } else {
        setError(`שגיאה: ${e?.message ?? e?.code ?? 'לא ידועה'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Logout ───────────────────────────────────────────────────────────────
  const logout = async () => {
    setUser(null);
    setError(null);
    setExpiry(null);
    await Promise.all([
      signOut(firebaseAuth).catch(() => {}),
      SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {}),
    ]);
    // device keys (device_key_${username}) are intentionally NOT deleted on logout.
    // Each user's key is permanent for this install — deleting it would lock them out.
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, lockoutSeconds, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
