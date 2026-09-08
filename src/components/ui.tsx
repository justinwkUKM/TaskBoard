'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowUpRight, Columns3, LogOut, X } from 'lucide-react';
import Link from 'next/link';
import { useSession } from './providers';
import type { ReactNode } from 'react';
export function Logo() { return <Link className="logo" href="/boards" aria-label="TaskBoard home"><span className="logo-mark"><Columns3 size={19} strokeWidth={2.4} /></span>taskboard<span className="logo-dot">.</span></Link>; }
export function Header() {
  const { user, logout } = useSession();
  return <header className="app-header"><Logo /><div className="header-right"><span className="personal-label">A little space for progress</span>{user && <details className="account"><summary aria-label="Account menu"><span className="avatar">{(user.displayName || user.email || 'U')[0].toUpperCase()}</span></summary><div className="account-menu"><strong>{user.displayName || 'Your account'}</strong><small>{user.email}</small><button onClick={() => void logout()}><LogOut size={15} /> Sign out</button></div></details>}</div></header>;
}
export function Modal({ title, description, children, onClose, wide = false }: { title: string; description?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className={`dialog ${wide ? 'dialog-wide' : ''}`} onInteractOutside={event => event.preventDefault()}><div className="dialog-heading"><div><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description || 'Make a little progress.'}</Dialog.Description></div><Dialog.Close className="icon-button" aria-label="Close dialog"><X size={20} /></Dialog.Close></div>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function ErrorNotice({ message }: { message: string }) { return message ? <div className="error-notice" role="alert">{message}</div> : null; }
export function Loading() { return <div className="loading" role="status"><span className="loading-dot" />Getting your workspace ready…</div>; }
export function Footer() { return <footer className="footer"><span>Small steps. Real progress.</span><span>Made for the way you work <ArrowUpRight size={13} /></span></footer>; }
