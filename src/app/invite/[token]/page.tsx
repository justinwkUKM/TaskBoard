'use client';
import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Users } from 'lucide-react';
import { api, errorMessage, useSession } from '@/components/providers';
import { ErrorNotice, Header, Loading } from '@/components/ui';
import { EmailSignIn } from '@/components/email-sign-in';
export default function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params); const { user, loading, login, logout, online } = useSession(); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const router = useRouter();
  async function accept() { setBusy(true); setError(''); try { if (!user) { await login(); } else { const result = await api<{ boardId: string }>('/invitations/accept', 'POST', { token }); router.replace(`/boards/${result.boardId}`); } } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } }
  return <><Header /><main className="invite-page">{loading ? <Loading /> : <section className="invite-card"><span className="empty-icon"><Users size={30} /></span><span className="eyebrow">BETTER TOGETHER</span><h1>You’ve got a place<br />on the board.</h1><p>Join your people and make a little progress together. Sign in with the email the owner invited.</p>{user && <p className="signed-in-as">Signed in as <strong>{user.email}</strong></p>}<ErrorNotice message={error} /><button className="button" onClick={accept} disabled={busy || !online}>{busy ? 'One moment…' : user ? 'Accept invitation' : 'Continue with Google'}<ArrowRight size={18} /></button>{!user && <EmailSignIn destination={`/invite/${token}`} />}{user && <button className="text-button" disabled={busy} onClick={() => void logout()}>Use a different account</button>}<span className="muted small">Invitation links expire after 7 days.</span></section>}</main></>;
}
