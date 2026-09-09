'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, configured, google } from '@/lib/firebase';
type Session = { user: User | null; loading: boolean; online: boolean; login: () => Promise<void>; logout: () => Promise<void> };
const Context = createContext<Session>({ user: null, loading: true, online: true, login: async () => {}, logout: async () => {} });
export function Providers({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(configured); const [online, setOnline] = useState(true);
  useEffect(() => auth ? onAuthStateChanged(auth, next => { setUser(next); setLoading(false); if (next) void api('/profile', 'POST').catch(() => {}); }) : undefined, []);
  useEffect(() => { const update = () => setOnline(navigator.onLine); update(); window.addEventListener('online', update); window.addEventListener('offline', update); return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); }; }, []);
  return <Context.Provider value={{ user, loading, online, login: async () => {
    if (!auth) throw new Error('Sign-in is not configured yet.');
    await signInWithPopup(auth, google);
  }, logout: async () => { if (auth) await signOut(auth); } }}>{!online && <div className="offline" role="status">You’re offline. Reconnect to save changes.</div>}{children}</Context.Provider>;
}
export const useSession = () => useContext(Context);
export async function api<T = { ok: boolean }>(path: string, method = 'GET', data?: unknown): Promise<T> {
  if (!navigator.onLine) throw new Error('You’re offline. Reconnect and try again.');
  const user = auth?.currentUser; if (!user) throw new Error('Please sign in to continue.');
  const send = async (refresh = false) => fetch(`/api${path}`, { method, headers: { Authorization: `Bearer ${await user.getIdToken(refresh)}`, 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) });
  let response = await send(); if (response.status === 401) response = await send(true);
  const text = await response.text();
  let result: Record<string, unknown> = {};
  try { if (text) result = JSON.parse(text); } catch { throw new Error(response.ok ? 'Unexpected response from server.' : `Server error (${response.status}). Please try again.`); }
  if (!response.ok) throw new Error((result.error as string) || 'Something went wrong. Try again.');
  return result as T;
}
export function errorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes('expired-action-code') || error.message.includes('invalid-action-code')) return 'This link has expired or was already used. Request a new sign-in link.';
    if (error.message.includes('invalid-email')) return 'Enter a valid email address.';
    if (error.message.includes('invalid-credential') || error.message.includes('user-mismatch')) return 'The email does not match this link, or the link is no longer valid. Check your email or request a new link.';
    if (error.message.includes('too-many-requests') || error.message.includes('quota-exceeded')) return 'Too many sign-in emails have been requested. Please try again later.';
    if (error.message.includes('network-request-failed')) return 'Check your connection and try again.';
    if (error.message.includes('popup-closed-by-user') || error.message.includes('cancelled-popup-request')) return 'Sign-in was cancelled. Try again when you’re ready.';
    if (error.message.includes('popup-blocked')) return 'Allow popups for this website, then try signing in again.';
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
