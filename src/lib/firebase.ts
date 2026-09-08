'use client';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
const emulator = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';
const config = { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || (emulator ? 'demo-key' : undefined), authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || (emulator ? 'demo-taskboard' : undefined), appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID };
export const configured = Boolean(config.apiKey && config.projectId);
export const app = configured ? (getApps().length ? getApp() : initializeApp(config)) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const google = new GoogleAuthProvider();
google.setCustomParameters({ prompt: 'select_account' });
const state = globalThis as typeof globalThis & { __taskboardEmulators?: boolean };
if (emulator && auth && db && !state.__taskboardEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  state.__taskboardEmulators = true;
}
