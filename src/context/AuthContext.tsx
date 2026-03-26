import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types';

const SESSION_KEY = 'auth_session';

const USE_MOCK_AUTH = true;

interface MockUser {
  username: string;
  password: string;
  displayName: string;
  role: UserProfile['role'];
  unitId?: string;
}

export const MOCK_USERS: MockUser[] = [
  { username: 'yakov',           password: '48293', displayName: 'קצין תקציבים',        role: 'kazin' },
  { username: 'gideon_eliasem',  password: '73615', displayName: 'גדעון אליאסטם',        role: 'kazin' },
  { username: 'yoav_bruner',     password: '29481', displayName: 'יואב ברונר',            role: 'kazin' },
  { username: 'chen_gordo',      password: '47219', displayName: 'רס"ן חן גורדו',        role: 'kas_900',   unitId: 'hativa_900' },
  { username: 'omer_boker',      password: '63857', displayName: 'רס"ן עומר בוקר',       role: 'klach_646', unitId: 'klach_646' },
  { username: 'yonatan_arye',    password: '92043', displayName: 'רס"ן יונתן אריה',      role: 'klach_179', unitId: 'klach_179' },
  { username: 'baruch_benshoham',password: '15726', displayName: 'רס"ן ברוך בן שוהם',   role: 'klach_11',  unitId: 'klach_11' },
  { username: 'rotem_priti',     password: '38492', displayName: 'רס"ן רותם פריטי',      role: 'smfaked',   unitId: 'gdod_90' },
  { username: 'yehonatan_didon', password: '67153', displayName: 'רס"ן יהונתן דידון',    role: 'smfaked',   unitId: 'gdod_92' },
  { username: 'daniel_alon',     password: '24876', displayName: 'רס"ן דניאל אלון',      role: 'smfaked',   unitId: 'gdod_93' },
  { username: 'liad_ozihu',      password: '91537', displayName: 'רס"ן ליעד עוזיהו',     role: 'smfaked',   unitId: 'gdod_94' },
  { username: 'eli_grant',       password: '45682', displayName: 'רס"ן אלי גרנט',        role: 'smfaked',   unitId: 'gdod_97' },
  { username: 'maor_markowitz',  password: '73924', displayName: 'רס"ן מאור מרקוביץ',    role: 'smfaked',   unitId: 'bach_900' },
  { username: 'fadi',            password: '52847', displayName: 'רס"ן פאדי',            role: 'smfaked',   unitId: 'mifaog_logistika' },
  { username: 'anna_el_toledano',password: '96314', displayName: 'רס"ן אנא-אל טולדנו',   role: 'smfaked',   unitId: 'mifaog_tna' },
  { username: 'tevel_trukman',   password: '37861', displayName: 'רס"ן תבל טרוקמן',      role: 'smfaked',   unitId: 'mifaog_tkshuv' },
  { username: 'maya_shamesh',    password: '64293', displayName: 'רס"ן מאיה שמש',        role: 'smfaked',   unitId: 'mifaog_masan' },
  { username: 'aviv_gutnov',     password: '81547', displayName: 'סרן אביב גוטנוב',      role: 'smfaked',   unitId: 'mifaog_agam' },
  { username: 'yadid_shmuel',    password: '29634', displayName: 'רס"ל ידיד שמואל',      role: 'smfaked',   unitId: 'mifaog_modiin' },
  { username: 'ofek_zilberman', password: '94163', displayName: 'סגן אופק זילברמן',      role: 'smfaked',   unitId: 'mifaog_refua' },
  { username: 'yossi_rafael',   password: '47291', displayName: 'סא"ל יוסי רפאל',        role: 'smfaked',   unitId: 'mifaog_handasa' },
  { username: 'leroy_shafir',   password: '63847', displayName: 'סא"ל ליהו שפיר',        role: 'smfaked',   unitId: 'mifaog_siua' },
  { username: 'omri_kalfon',    password: '19528', displayName: 'סא"ל עמרי כלפון',       role: 'smfaked',   unitId: 'mifaog_mahane' },
  { username: 'yoni_hakohen',   password: '36491', displayName: 'אל"מ יוני הכהן',        role: 'klach_646', unitId: 'klach_646' },
  { username: 'noam_michael',   password: '72815', displayName: 'אל"מ נועם מיכאל',       role: 'klach_11',  unitId: 'klach_11' },
  { username: 'yonatan_maier',  password: '58327', displayName: 'אל"מ יונתן מאיר',       role: 'klach_179', unitId: 'klach_179' },
  { username: 'eyal_cohen',     password: '83416', displayName: 'אייל כהן',               role: 'machat_900' },
  { username: 'ran_cohen',      password: '57293', displayName: 'רן כהן',                 role: 'samachat_900' },
  { username: 'ran_mualem',     password: '14729', displayName: 'סא"ל רן מועלם',          role: 'smfaked',   unitId: 'mifaog_logistika' },
  { username: 'teamor_sarhien', password: '83651', displayName: 'סא"ל תיאמור סארחיין',    role: 'smfaked',   unitId: 'mifaog_tna' },
  { username: 'ben_hazan',      password: '26947', displayName: 'סא"ל בן חזן',            role: 'smfaked',   unitId: 'mifaog_tkshuv' },
  { username: 'oren_levi',      password: '51384', displayName: 'סא"ל אורן לוי',          role: 'smfaked',   unitId: 'mifaog_masan' },
  { username: 'amit_shohat',    password: '79236', displayName: 'סא"ל עמית שוחט',         role: 'smfaked',   unitId: 'mifaog_agam' },
  { username: 'moshe',          password: '43815', displayName: 'סא"ל משה',               role: 'smfaked',   unitId: 'mifaog_modiin' },
  { username: 'shmulik_sokolik',password: '62497', displayName: 'סא"ל שמוליק סוקוליק',   role: 'smfaked',   unitId: 'mifaog_refua' },
  { username: 'admin',          password: '57382', displayName: 'מנהל מערכת',             role: 'admin' },
];

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
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

  // Restore session on app start
  useEffect(() => {
    AsyncStorage.getItem(SESSION_KEY).then(raw => {
      if (raw) {
        const { profile, date } = JSON.parse(raw);
        if (date === todayStr()) setUser(profile);
        else AsyncStorage.removeItem(SESSION_KEY);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Auto-logout at midnight
  useEffect(() => {
    const t = setTimeout(() => {
      setUser(null);
      AsyncStorage.removeItem(SESSION_KEY);
    }, msUntilMidnight());
    return () => clearTimeout(t);
  }, []);

  const saveSession = (profile: UserProfile) =>
    AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ profile, date: todayStr() })).catch(() => {});

  const login = async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      if (USE_MOCK_AUTH) {
        const found = MOCK_USERS.find(
          u => u.username === username.toLowerCase().trim() && u.password === password.trim()
        );
        if (!found) throw new Error('שם משתמש או סיסמה שגויים');
        const profile: UserProfile = {
          id: found.username,
          displayName: found.displayName,
          username: found.username,
          role: found.role,
          unitId: found.unitId,
        };
        setUser(profile);
        saveSession(profile);
        return;
      }
      // Firestore path (future)
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      const userDoc = await getDoc(doc(db, 'users', username.toLowerCase().trim()));
      if (!userDoc.exists()) throw new Error('שם משתמש או סיסמה שגויים');
      const data = userDoc.data();
      if (data.password !== password.trim()) throw new Error('שם משתמש או סיסמה שגויים');
      const profile: UserProfile = {
        id: data.username,
        displayName: data.displayName,
        username: data.username,
        role: data.role,
        unitId: data.unitId,
      };
      setUser(profile);
      saveSession(profile);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setError(null);
    AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
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
