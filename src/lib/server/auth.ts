import type { DecodedIdToken } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { admin } from './admin';
import { LIMITS } from '../types';
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export function assert(condition: unknown, status: number, message: string): asserts condition { if (!condition) throw new ApiError(status, message); }
export async function authenticate(request: Request): Promise<DecodedIdToken> {
  const bearer = request.headers.get('authorization');
  assert(bearer && bearer.startsWith('Bearer '), 401, 'Please sign in to continue.');
  let user: DecodedIdToken;
  try { user = await admin().auth.verifyIdToken(bearer.slice(7), true); } catch { throw new ApiError(401, 'Your session expired. Please sign in again.'); }
  assert(process.env.FIREBASE_AUTH_EMULATOR_HOST || (user.email_verified && user.firebase.sign_in_provider === 'google.com'), 403, 'A verified Google account is required.');
  const origin = request.headers.get('origin');
  if (origin) assert(origin === new URL(request.url).origin || origin === process.env.NEXT_PUBLIC_APP_URL, 403, 'This request origin is not allowed.');
  return user;
}
export async function throttle(uid: string) {
  const { db } = admin(); const ref = db.collection('_limits').doc(uid); const now = Date.now();
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref); const data = snap.data();
    const sameWindow = data && now - data.start < 60000;
    const count = sameWindow ? data.count + 1 : 1;
    assert(count <= LIMITS.requestsPerMinute, 429, 'Too many changes. Please wait a minute and try again.');
    tx.set(ref, { start: sameWindow ? data.start : now, count, updatedAt: FieldValue.serverTimestamp() });
  });
}
