import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
export function admin() {
  const projectId = process.env.FIREBASE_PROJECT_ID || (process.env.FIRESTORE_EMULATOR_HOST ? 'demo-taskboard' : process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  if (!projectId) throw new Error('Firebase server configuration is missing.');
  const app = getApps()[0] || initializeApp({ projectId, ...(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY ? { credential: cert({ projectId, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') }) } : {}) });
  return { db: getFirestore(app), auth: getAuth(app) };
}
