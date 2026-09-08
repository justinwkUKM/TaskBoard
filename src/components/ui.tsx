'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowUpRight, Columns3, LogOut, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useSession } from './providers';
import { useState, type ReactNode } from 'react';
export function Logo() { return <Link className="logo" href="/boards" aria-label="TaskBoard home"><span className="logo-mark"><Columns3 size={19} strokeWidth={2.4} /></span>taskboard<span className="logo-dot">.</span></Link>; }
export function Avatar({ name, photoURL, size = 34, active = false, className = '' }: { name: string; photoURL?: string | null; size?: number; active?: boolean; className?: string }) {
  const [error, setError] = useState(false);
  const initial = (name || 'U').trim()[0]?.toUpperCase() || 'U';
  return (
    <span className={`avatar-wrapper ${className}`} style={{ width: size, height: size, position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {photoURL && !error ? (
        <img src={photoURL} alt={name} referrerPolicy="no-referrer" onError={() => setError(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block', border: '2px solid var(--paper)' }} />
      ) : (
        <span className="avatar" style={{ width: size, height: size, fontSize: Math.max(10, Math.floor(size * 0.38)) }}>{initial}</span>
      )}
      {active && <span className="active-indicator" title="Active now" aria-label="Active now" style={{ position: 'absolute', bottom: -1, right: -1, width: Math.max(8, Math.floor(size * 0.28)), height: Math.max(8, Math.floor(size * 0.28)), borderRadius: '50%', backgroundColor: '#22c55e', border: '2px solid white', boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }} />}
    </span>
  );
}
export function Header() {
  const { user, logout } = useSession();
  return <header className="app-header"><Logo /><div className="header-right">{user && <Link className="assistant-nav-link" href="/assistant" title="AI Task Helper"><Sparkles size={14} /> AI Helper</Link>}<span className="personal-label">A little space for progress</span>{user && <details className="account"><summary aria-label="Account menu"><Avatar name={user.displayName || user.email || 'You'} photoURL={user.photoURL} size={34} /></summary><div className="account-menu"><div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}><Avatar name={user.displayName || user.email || 'You'} photoURL={user.photoURL} size={40} /><div style={{ minWidth: 0 }}><strong>{user.displayName || 'Your account'}</strong><small style={{ margin: 0 }}>{user.email}</small></div></div><button onClick={() => void logout()}><LogOut size={15} /> Sign out</button></div></details>}</div></header>;
}
export function Modal({ title, description, children, onClose, wide = false }: { title: string; description?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className={`dialog ${wide ? 'dialog-wide' : ''}`} onInteractOutside={event => event.preventDefault()}><div className="dialog-heading"><div><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description || 'Make a little progress.'}</Dialog.Description></div><Dialog.Close className="icon-button" aria-label="Close dialog"><X size={20} /></Dialog.Close></div>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function ErrorNotice({ message }: { message: string }) { return message ? <div className="error-notice" role="alert">{message}</div> : null; }
export function Loading() { return <div className="loading" role="status"><span className="loading-dot" />Getting your workspace ready…</div>; }
export function Footer() { return <footer className="footer"><span>Small steps. Real progress.</span><span>Made for the way you work <ArrowUpRight size={13} /></span></footer>; }
