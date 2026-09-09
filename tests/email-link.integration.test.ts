import { afterAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, sendSignInLinkToEmail, signInWithEmailLink, signOut } from 'firebase/auth';
import { verifiedSignIn } from '../src/lib/email-link';

describe.skipIf(!process.env.FIREBASE_AUTH_EMULATOR_HOST)('Firebase email-link integration', () => {
  const projectId = 'demo-taskboard';
  const app = initializeApp({ apiKey: 'demo-key', projectId }, 'email-link-tests');
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'}`, { disableWarnings: true });
  const email = `magic-${Date.now()}@example.test`;
  async function newLink() {
    await sendSignInLinkToEmail(auth, email, { url: 'http://localhost:3000/auth/finish?next=%2Fboards', handleCodeInApp: true });
    const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${projectId}/oobCodes`);
    const data = await response.json();
    const code = data.oobCodes.filter((entry: { email: string }) => entry.email === email).at(-1);
    return code.oobLink as string;
  }
  afterAll(async () => { await signOut(auth); await deleteApp(app); });
  it('confirms email on a different device, rejects wrong email and replay, and preserves UID on return', async () => {
    const link = await newLink();
    await expect(signInWithEmailLink(auth, 'wrong@example.test', link)).rejects.toThrow();
    const first = await signInWithEmailLink(auth, email, link);
    expect(first.user.emailVerified).toBe(true);
    const token = await first.user.getIdTokenResult();
    expect(token.signInProvider).toBe('password');
    expect(verifiedSignIn({ email_verified: first.user.emailVerified, firebase: { sign_in_provider: token.signInProvider! } })).toBe(true);
    const uid = first.user.uid;
    await signOut(auth);
    await expect(signInWithEmailLink(auth, email, link)).rejects.toThrow();
    const second = await signInWithEmailLink(auth, email, await newLink());
    expect(second.user.uid).toBe(uid);
  }, 20000);
});
