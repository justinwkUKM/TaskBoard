import { createHash } from 'node:crypto';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { admin } from './admin';
import { LIMITS, type AgentToken } from '../types';
import { verifiedSignIn } from '../email-link';

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export function assert(condition: unknown, status: number, message: string): asserts condition { if (!condition) throw new ApiError(status, message); }

export interface AuthContext {
  uid: string;
  type: 'user' | 'agent' | 'webhook';
  email?: string;
  name?: string;
  picture?: string | null;
  email_verified?: boolean;
  boardId?: string;
  agentId?: string;
  agentToken?: AgentToken;
  decodedToken?: DecodedIdToken;
}

export async function authenticate(request: Request): Promise<AuthContext> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Allow VCS Webhook endpoint with optional secret check
  if (path.endsWith('/webhooks/vcs')) {
    const webhookSecret = process.env.VCS_WEBHOOK_SECRET;
    const providedSecret = request.headers.get('x-taskboard-secret') || request.headers.get('x-webhook-secret') || url.searchParams.get('secret');
    if (webhookSecret) {
      assert(providedSecret === webhookSecret, 401, 'Invalid webhook secret.');
    }
    return {
      uid: 'webhook:vcs',
      type: 'webhook',
      name: 'VCS Webhook'
    };
  }

  const bearer = request.headers.get('authorization');
  assert(bearer && bearer.startsWith('Bearer '), 401, 'Please sign in to continue.');
  const token = bearer.slice(7).trim();

  // 1. Scoped Agent Token
  if (token.startsWith('tb_agent_')) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const { db } = admin();
    const tokenSnap = await db.collection('agent_tokens').doc(tokenHash).get();
    assert(tokenSnap.exists, 401, 'Invalid agent token.');
    const tokenData = tokenSnap.data() as AgentToken;
    assert(!tokenData.revokedAt, 401, 'This agent token has been revoked.');

    // Update lastSeenAt for the agent in background
    void db.collection('boards').doc(tokenData.boardId).collection('members').doc(tokenData.id).set({
      lastSeenAt: Date.now(),
      status: 'working'
    }, { merge: true }).catch(() => {});

    return {
      uid: `agent:${tokenData.id}`,
      type: 'agent',
      name: tokenData.name,
      boardId: tokenData.boardId,
      agentId: tokenData.id,
      agentToken: tokenData
    };
  }

  // 2. Human User Session (Firebase Auth)
  let user: DecodedIdToken;
  try { user = await admin().auth.verifyIdToken(token, true); } catch { throw new ApiError(401, 'Your session expired. Please sign in again.'); }
  assert(process.env.FIREBASE_AUTH_EMULATOR_HOST || verifiedSignIn(user), 403, 'Sign in with Google or verify your email using a magic link.');
  const origin = request.headers.get('origin');
  if (origin) assert(origin === new URL(request.url).origin || origin === process.env.NEXT_PUBLIC_APP_URL, 403, 'This request origin is not allowed.');
  return {
    uid: user.uid,
    type: 'user',
    email: user.email,
    name: user.name,
    picture: user.picture,
    email_verified: user.email_verified,
    decodedToken: user
  };
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

