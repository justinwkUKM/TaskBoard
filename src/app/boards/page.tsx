'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { ArrowUpRight, Columns3, Plus, Users } from 'lucide-react';
import { db } from '@/lib/firebase';
import type { Board } from '@/lib/types';
import { api, errorMessage, useSession } from '@/components/providers';
import { ErrorNotice, Footer, Header, Loading, Modal } from '@/components/ui';
export default function Boards() {
  const { user, loading, online } = useSession(); const router = useRouter(); const [boards, setBoards] = useState<Board[] | null>(null); const [error, setError] = useState(''); const [create, setCreate] = useState(false);
  useEffect(() => { if (!loading && !user) router.replace('/'); }, [user, loading, router]);
  useEffect(() => {
    if (!user || !db) return;
    return onSnapshot(query(collection(db, 'boards'), where('memberIds', 'array-contains', user.uid), where('deleting', '==', false), orderBy('updatedAt', 'desc')), snap => setBoards(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Board)), () => { setError('Your boards could not be loaded. Please refresh and try again.'); setBoards([]); });
  }, [user]);
  return <><Header /><main className="dashboard"><div className="page-intro"><div><span className="eyebrow">YOUR WORKSPACE</span><h1>Room for what’s next<span className="lime-dot">.</span></h1><p>{user?.displayName ? `Hey ${user.displayName.split(' ')[0]}, ` : ''}a little focus goes a long way.</p></div><button className="button" onClick={() => setCreate(true)} disabled={!user || !online}><Plus size={18} /> New board</button></div><div className="section-bar"><h2>All boards <span className="count">{boards?.length || 0}</span></h2><span>Private to you and your people</span></div><ErrorNotice message={error} />{loading || !boards ? <Loading /> : boards.length ? <div className="board-grid">{boards.map((board, i) => <Link className="board-tile" key={board.id} href={`/boards/${board.id}`}><div className="board-tile-top"><span className={`board-symbol symbol-${i % 3}`}><Columns3 size={22} /></span><ArrowUpRight size={20} /></div><h3>{board.name}</h3><p>{board.description || 'A fresh space to make things happen.'}</p><div className="board-tile-bottom"><span><Users size={14} /> {board.memberIds.length === 1 ? 'Just you' : `${board.memberIds.length} people`}</span><span>{board.ownerId === user?.uid ? 'Owner' : 'Member'} · {board.taskCount} {board.taskCount === 1 ? 'task' : 'tasks'}</span></div></Link>)}<button className="new-board-tile" onClick={() => setCreate(true)} disabled={!online}><Plus size={24} /><span>Make space for a new idea</span></button></div> : <div className="empty-state"><span className="empty-icon"><Columns3 size={34} /></span><span className="eyebrow">A FRESH START</span><h2>Big plans start with a small board.</h2><p>A project, a weekend plan, that thing you’ve been meaning to do.<br />Give it a home and take the first step.</p><button className="button" onClick={() => setCreate(true)} disabled={!online}>Create your first board <ArrowUpRight size={18} /></button></div>}</main><Footer />{create && <CreateBoard onClose={() => setCreate(false)} />}</>;
}
function CreateBoard({ onClose }: { onClose: () => void }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [id] = useState(() => crypto.randomUUID());
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError(''); try { const result = await api<{ id: string }>('/boards', 'POST', { id, name: data.get('name'), description: data.get('description') }); router.push(`/boards/${result.id}`); } catch (e) { setError(errorMessage(e)); setBusy(false); } }
  return <Modal title="A fresh space." description="Give your next project a home." onClose={() => { if (!busy) onClose(); }}><form onSubmit={submit} className="form"><label>Board name<input name="name" placeholder="e.g. The next big thing" required maxLength={100} autoFocus /></label><label>Description <span className="optional">optional</span><textarea name="description" placeholder="What are we working toward?" maxLength={1000} rows={3} /></label><div className="form-note"><Columns3 size={17} /> Starts with To do, In progress, and Done. Make it yours anytime.</div><ErrorNotice message={error} /><div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="button" disabled={busy}>{busy ? 'Creating…' : 'Create board'}<Plus size={16} /></button></div></form></Modal>;
}
