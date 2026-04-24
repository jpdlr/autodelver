import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

function getConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

function firebaseApp(): FirebaseApp | null {
  if (app) return app;
  const config = getConfig();
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    return null;
  }
  app = initializeApp(config);
  return app;
}

export function firestoreDb(): Firestore | null {
  if (db) return db;
  const a = firebaseApp();
  if (!a) return null;
  db = getFirestore(a);
  return db;
}

export function firebaseAuth(): Auth | null {
  if (auth) return auth;
  const a = firebaseApp();
  if (!a) return null;
  auth = getAuth(a);
  return auth;
}

export function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export function hasFirestoreConfig(): boolean {
  return firestoreDb() !== null;
}
