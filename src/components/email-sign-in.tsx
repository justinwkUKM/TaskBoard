'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { sendSignInLinkToEmail } from 'firebase/auth';
import { Mail } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { EMAIL_STORAGE_KEY, emailLinkReturnUrl } from '@/lib/email-link';
import { errorMessage, useSession } from './providers';
import { ErrorNotice } from './ui';

export function EmailSignIn({ destination = '/boards' }: { destination?: string }) {
  const { online, loading } = useSession();
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(''); const [error, setError] = useState(''); const [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (!auth) throw new Error('Sign-in is not configured yet.');
      const address = email.trim();
      await sendSignInLinkToEmail(auth, address, { url: emailLinkReturnUrl(window.location.origin, destination), handleCodeInApp: true });
      try { localStorage.setItem(EMAIL_STORAGE_KEY, address); } catch { /* Email confirmation works without storage. */ }
      setSent(address); setCooldown(60);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <div className="email-sign-in"><div className="auth-divider"><span>or use your email</span></div><form onSubmit={submit}><label htmlFor="magic-email">Email address</label><input id="magic-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" disabled={busy} /><button className="button secondary" disabled={busy || loading || !online || cooldown > 0}><Mail size={16} />{busy ? 'Sending…' : cooldown ? `Send again in ${cooldown}s` : sent ? 'Send another link' : 'Email me a sign-in link'}</button></form>{sent && <p className="email-sent" role="status">Check {sent} for your sign-in link. It may be in spam. Open it to finish signing in; no password needed.</p>}<ErrorNotice message={error} /></div>;
}
