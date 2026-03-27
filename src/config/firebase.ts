import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { SecureStorageAdapter } from '../services/secureStorePersistence';

const firebaseConfig = {
  apiKey: 'AIzaSyDSsOt0_vHWRPmhgNr9lbiGvgELrvhCoWg',
  authDomain: 'coinflash-8cb37.firebaseapp.com',
  projectId: 'coinflash-8cb37',
  storageBucket: 'coinflash-8cb37.firebasestorage.app',
  messagingSenderId: '504875192036',
  appId: '1:504875192036:web:994bd25e0bc4482a43a6f1',
};

// Note: getAnalytics is web-only and not supported in React Native — omitted intentionally.

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = initializeAuth(firebaseApp, {
  // SecureStorageAdapter stores Firebase tokens in the Android Keystore /
  // iOS Secure Enclave (hardware-backed encryption) instead of plain AsyncStorage.
  persistence: getReactNativePersistence(SecureStorageAdapter),
});
export const db = getFirestore(firebaseApp);
