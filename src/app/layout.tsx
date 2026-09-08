import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';
export const metadata: Metadata = { title: { default: 'TaskBoard — A little space for progress', template: '%s · TaskBoard' }, description: 'A simple, shared space to turn to-dos into done. Organize tasks, invite your people, and make progress together.', robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><Providers>{children}</Providers></body></html>; }
