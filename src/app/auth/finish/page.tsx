'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { EMAIL_STORAGE_KEY, safeDestination } from '@/lib/email-link';
import { Header, ErrorNotice } from '@/components/ui';
import { errorMessage, useSession } from '@/components/providers';

export default function FinishSignIn() {
  const router = useRouter(); const { online } = useSession();
  const [email, setEmail] = useState(''); const [link, setLink] = useState(''); const [destination, setDestination] = useState('/boards');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  // Hydrate browser-only URL and storage after SSR; never consume a link in an effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const href = window.location.href;
    if (!auth || !isSignInWithEmailLink(auth, href)) { setError('This sign-in link is invalid. Request a new link to continue.'); return; }
    setLink(href); setDestination(safeDestination(new URL(href).searchParams.get('next')));
    try { setEmail(localStorage.getItem(EMAIL_STORAGE_KEY) || ''); } catch { /* Ask for the address on a different device or with storage blocked. */ }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  async function finish(event: FormEvent) {
    event.preventDefault(); if (!auth || !link || busy) return; setBusy(true); setError('');
    try {
      await signInWithEmailLink(auth, email.trim(), link);
      try { localStorage.removeItem(EMAIL_STORAGE_KEY); } catch { /* No stored address. */ }
      window.history.replaceState(null, '', '/auth/finish');
      router.replace(destination);
    } catch (e) { setError(errorMessage(e)); setBusy(false); }
  }
  return <><Header /><main className="invite-page"><section className="invite-card"><span className="eyebrow">WELCOME TO TASKBOARD</span><h1>One last step.</h1><p>Confirm the email address you used to request this link. You can finish on any device.</p><ErrorNotice message={error} />{link && <form className="form" onSubmit={finish}><label>Email address<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} disabled={busy} /></label><button className="button" disabled={busy || !online}>{busy ? 'Signing you in…' : 'Confirm and sign in'}</button></form>}<Link className="text-button" href={destination.startsWith('/invite/') ? destination : '/'}>Request a new sign-in link</Link></section></main></>;
}
