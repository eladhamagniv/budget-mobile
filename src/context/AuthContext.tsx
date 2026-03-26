import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseAuth, db } from '../config/firebase';
import { ensureKeyPair } from '../services/cryptoService';
import { UserProfile } from '../types';

// Session stored in SecureStore (hardware-backed Android Keystore).
// Value: JSON { profile: UserProfile, date: 'YYYY-MM-DD' }
const SESSION_KEY = 'auth_session_v2';

// Email domain used to create Firebase Auth accounts for each username.
// The migration script creates: username@idf.budget
const AUTH_EMAIL_DOMAIN = 'idf.budget';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function msUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session from SecureStore on app start
  useEffect(() => {
    SecureStore.getItemAsync(SESSION_KEY)
      .then(raw => {
        if (raw) {
          const { profile, date } = JSON.parse(raw) as { profile: UserProfile; date: string };
          if (date === todayStr()) setUser(profile);
          else SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Auto-logout at midnight
  useEffect(() => {
    const t = setTimeout(() => {
      setUser(null);
      SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
    }, msUntilMidnight());
    return () => clearTimeout(t);
  }, []);

  const saveSession = (profile: UserProfile) =>
    SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ profile, date: todayStr() })).catch(() => {});

  const login = async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const email = `${username.toLowerCase().trim()}@${AUTH_EMAIL_DOMAIN}`;

      // Firebase requires ≥6 char passwords; existing PINs are 5 digits.
      // We prepend '1' consistently in both auth and migration — users still type their PIN.
      const firebasePassword = '1' + password.trim();

      // Authenticate with Firebase Auth (real credential check — server-side)
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, firebasePassword);

      // Fetch user profile from Firestore
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

      // Ensure ECDH key pair exists for this user (generates on first login)
      await ensureKeyPair(profile.username);

      setUser(profile);
      saveSession(profile);
    } catch (e: any) {
      // Normalise Firebase Auth error codes to Hebrew messages
      const code: string = e?.code ?? '';
      if (
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/invalid-email'
      ) {
        setError('שם משתמש או סיסמה שגויים');
      } else if (code === 'auth/too-many-requests') {
        setError('יותר מדי ניסיונות. נסה שוב מאוחר יותר');
      } else if (code === 'auth/network-request-failed') {
        setError('אין חיבור לרשת');
      } else {
        setError('שגיאה בהתחברות. נסה שוב');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setUser(null);
    setError(null);
    await Promise.all([
      signOut(firebaseAuth).catch(() => {}),
      SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {}),
    ]);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
