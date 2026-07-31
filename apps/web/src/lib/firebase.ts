import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env['VITE_FIREBASE_API_KEY'],
  authDomain: import.meta.env['VITE_FIREBASE_AUTH_DOMAIN'],
  projectId: import.meta.env['VITE_FIREBASE_PROJECT_ID'],
  storageBucket: import.meta.env['VITE_FIREBASE_STORAGE_BUCKET'],
  messagingSenderId: import.meta.env['VITE_FIREBASE_MESSAGING_SENDER_ID'],
  appId: import.meta.env['VITE_FIREBASE_APP_ID'],
};

let cachedAuth: Auth | null = null;

// Lazy + nullable: an unconfigured Firebase must render the app logged-out,
// not crash the bundle at module load (blank page in prod).
export function getFirebaseAuth(): Auth | null {
  if (cachedAuth) return cachedAuth;
  if (!firebaseConfig.apiKey) return null;
  const auth = getAuth(initializeApp(firebaseConfig));

  const emulatorHost = import.meta.env['VITE_FIREBASE_AUTH_EMULATOR_HOST'];
  // Gated on DEV as well as the variable: a production bundle that reached an
  // emulator would accept tokens nothing ever signed.
  if (emulatorHost && import.meta.env.DEV) {
    connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
  }

  cachedAuth = auth;
  return cachedAuth;
}

export function requireFirebaseAuth(): Auth {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase is not configured (missing VITE_FIREBASE_* env vars)');
  }
  return auth;
}
