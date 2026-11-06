import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  enableNetwork,
  initializeFirestore,
  type Firestore,
  getFirestore,
} from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { Platform } from 'react-native';

/** Web + Expo: pass your keys via .env (EXPO_PUBLIC_*), never commit real keys. */
function buildFirebaseConfig(): Record<string, string> {
  const c: Record<string, string> = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
  };
  const measurementId = process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID;
  if (measurementId) c.measurementId = measurementId;
  return c;
}

const firebaseConfig = buildFirebaseConfig();

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let analyticsReady = false;

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured. Set EXPO_PUBLIC_FIREBASE_* in .env');
  }
  if (!app) {
    app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  }
  return app;
}

/** Analytics — Web only. Idempotent (React Strict Mode runs effects twice in dev). */
export async function initFirebaseAnalytics(): Promise<void> {
  if (Platform.OS !== 'web' || !isFirebaseConfigured()) return;
  if (!firebaseConfig.measurementId) return;
  if (analyticsReady) return;
  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics');
    const supported = await isSupported();
    if (supported) {
      getAnalytics(getFirebaseApp());
      analyticsReady = true;
    }
  } catch {
    /* ignore */
  }
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

/**
 * Firestore עם long-polling אוטומטי — מפחית "client is offline" בדפדפן כשחוסמים WebChannel (חוסמי פרסומות וכו').
 * חייב להיקרא לפני שאר השימוש ב־Firestore (רק דרך getDb כאן).
 */
export function getDb(): Firestore {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured. Set EXPO_PUBLIC_FIREBASE_* in .env');
  }
  if (!db) {
    const a = getFirebaseApp();
    try {
      /* Web: Force long-polling when proxies/antivirus/ad-block break WebChannel (often surfaces as "client is offline").
         Do not combine with experimentalAutoDetectLongPolling (SDK restriction). */
      const baseSettings =
        Platform.OS === 'web'
          ? { experimentalForceLongPolling: true as const, ignoreUndefinedProperties: true as const }
          : { experimentalAutoDetectLongPolling: true as const, ignoreUndefinedProperties: true as const };
      db = initializeFirestore(a, baseSettings);
    } catch {
      db = getFirestore(a);
    }
  }
  return db;
}

/** קורא ב־app startup — מנסה להחזיר את Firestore למצב מקוון אחרי disableNetwork / מצבי דפדפן. */
export async function ensureFirestoreOnline(): Promise<void> {
  if (!isFirebaseConfigured()) return;
  try {
    await enableNetwork(getDb());
  } catch {
    /* ignore */
  }
}

export function getFbFunctions() {
  const fn = getFunctions(getFirebaseApp(), 'europe-west1');
  if (process.env.EXPO_PUBLIC_USE_FUNCTIONS_EMULATOR === '1') {
    connectFunctionsEmulator(fn, '127.0.0.1', 5001);
  }
  return fn;
}
