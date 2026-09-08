'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronDown,
  Columns3,
  KeyRound,
  Move,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useSession, errorMessage } from '@/components/providers';
import { ErrorNotice } from '@/components/ui';
import {
  AtmosphericWash,
  PipelineDiagramSvg,
  StateTransformSvg,
  ClarityVsNoiseSvg,
} from '@/components/landing-svgs';

export default function Home() {
  const { user, login, loading } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    if (user) router.replace('/boards');
  }, [user, router]);

  async function handleLogin() {
    setBusy(true);
    setError('');
    try {
      await login();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f3f1] text-[#242424] antialiased selection:bg-[#cfdaf5] selection:text-[#242424]">
      {/* 1. Top Announcement Bar */}
      {announcement && (
        <aside
          role="region"
          aria-label="Announcement"
          className="relative z-30 flex min-h-[42px] items-center justify-between border-b border-[#242424] bg-[#000000] px-4 py-2 text-[#f6f3f1]"
        >
          <div className="mx-auto flex flex-wrap items-center justify-center gap-3 font-mono text-[12px] uppercase tracking-wider">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-2.5 py-0.5 text-[10px] text-white">
              <Sparkles size={11} className="text-[#a7fccd]" /> V1.0 STABLE SPEC
            </span>
            <span className="text-[#cecac8]">
              TaskBoard is live: real-time collaborative Kanban on warm parchment.
            </span>
          </div>
          <button
            onClick={() => setAnnouncement(false)}
            className="text-[#cecac8] transition hover:text-white"
            aria-label="Dismiss announcement"
          >
            <X size={16} />
          </button>
        </aside>
      )}

      {/* 2. Editorial Navigation Bar */}
      <header className="relative z-20 mx-auto flex h-20 max-w-[1432px] items-center justify-between px-6 sm:px-10">
        {/* Monad Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 font-mono text-[18px] font-medium tracking-tight text-[#242424]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#242424] bg-white">
            <Columns3 size={17} strokeWidth={2.2} />
          </span>
          <span>taskboard<span className="text-[#2b59d1]">.</span></span>
        </Link>

        {/* Center Nav Links (Monospace uppercase) */}
        <nav
          aria-label="Main Navigation"
          className="hidden items-center gap-8 font-mono text-[12px] uppercase tracking-widest text-[#4e4d4d] md:flex"
        >
          <a href="#topology" className="transition hover:text-[#242424]">{'// 01 TOPOLOGY'}</a>
          <a href="#features" className="transition hover:text-[#242424]">{'// 02 METHOD'}</a>
          <a href="#manifesto" className="transition hover:text-[#242424]">{'// 03 MANIFESTO'}</a>
          <a href="#specification" className="transition hover:text-[#242424]">{'// 04 SPEC'}</a>
        </nav>

        {/* Right CTA */}
        <div className="flex items-center gap-4">
          {user ? (
            <Link href="/boards" className="monad-pill-blue">
              OPEN BOARDS <ArrowRight size={14} />
            </Link>
          ) : (
            <button
              onClick={handleLogin}
              disabled={busy || loading}
              className="monad-pill-blue"
            >
              {busy ? 'CONNECTING…' : 'SIGN IN WITH GOOGLE'} <span aria-hidden="true">▸</span>
            </button>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1432px] px-6 pb-24 sm:px-10">
        {/* 3. Typographic Editorial Hero */}
        <section className="relative pt-16 pb-20 text-center sm:pt-24 sm:pb-28">
          {/* Atmospheric background wash */}
          <AtmosphericWash className="top-[-80px] max-h-[850px]" />

          <div className="relative z-10 mx-auto max-w-[980px]">
            {/* Tag */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#cecac8] bg-[#f6f3f1]/80 px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest text-[#4e4d4d] backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2b59d1]" />
              AN EDITORIAL WORKSPACE FOR DELIBERATE PROGRESS
            </div>

            {/* Headline in Untitled Serif 400 (never bold) */}
            <h1 className="font-monad-serif text-[44px] leading-[1.12] text-[#242424] sm:text-[68px] lg:text-[80px]">
              A little space for progress.
            </h1>

            {/* Monospace Subtitle */}
            <p className="mx-auto mt-7 max-w-[680px] font-mono text-[16px] leading-[1.65] text-[#4e4d4d] sm:text-[19px]">
              Clear your head. Gather your people. A minimal, server-authoritative
              Kanban architecture built for clarity, speed, and shared execution.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={handleLogin}
                disabled={busy || loading}
                className="monad-pill-blue text-[14px]"
              >
                {busy ? 'OPENING GOOGLE…' : 'CONTINUE WITH GOOGLE'} <span aria-hidden="true">▸</span>
              </button>
              <a href="#topology" className="monad-pill-ghost text-[14px]">
                VIEW ARCHITECTURE <ArrowRight size={14} />
              </a>
            </div>

            <ErrorNotice message={error} />

            {/* Sub-note */}
            <p className="mt-5 font-mono text-[11px] uppercase tracking-wider text-[#797776]">
              Free to use · Verified Google OAuth · No credit card required
            </p>
          </div>
        </section>

        {/* 4. Hero SVG Graphic: Pipeline & Real-Time Topology */}
        <section id="topology" className="relative my-10">
          <PipelineDiagramSvg />
        </section>

        {/* 5. Metrics & Technical Manifesto Strip */}
        <section className="my-20 grid grid-cols-2 gap-4 border-y border-[#cecac8] py-10 sm:grid-cols-4 sm:gap-8">
          <div className="border-r border-[#cecac8] pr-4 sm:pr-8">
            <div className="font-mono text-[28px] font-medium text-[#242424] sm:text-[36px]">&lt; 200MS</div>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-widest text-[#797776]">PEER SYNC LATENCY</div>
            <p className="mt-2 font-mono text-[12px] text-[#4e4d4d]">Live Firestore state broadcasts across all active member windows.</p>
          </div>
          <div className="sm:border-r sm:border-[#cecac8] sm:pr-8">
            <div className="font-mono text-[28px] font-medium text-[#242424] sm:text-[36px]">ZERO</div>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-widest text-[#797776]">DIRECT CLIENT WRITES</div>
            <p className="mt-2 font-mono text-[12px] text-[#4e4d4d]">Enforced security rules protect private documents from manipulation.</p>
          </div>
          <div className="border-r border-[#cecac8] pr-4 sm:pr-8">
            <div className="font-mono text-[28px] font-medium text-[#242424] sm:text-[36px]">SHA-256</div>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-widest text-[#797776]">EMAIL-BOUND TOKENS</div>
            <p className="mt-2 font-mono text-[12px] text-[#4e4d4d]">Cryptographic invitation links expire in 7 days and verify account email.</p>
          </div>
          <div>
            <div className="font-mono text-[28px] font-medium text-[#242424] sm:text-[36px]">100%</div>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-widest text-[#797776]">ACID TRANSACTIONS</div>
            <p className="mt-2 font-mono text-[12px] text-[#4e4d4d]">Server-authoritative rebalancing prevents fractional index collisions.</p>
          </div>
        </section>

        {/* 6. Feature Matrix (Elevated Periwinkle Card + 3 Classic Cards) */}
        <section id="features" className="my-24">
          <div className="mb-12 flex flex-col justify-between gap-4 border-b border-[#cecac8] pb-6 sm:flex-row sm:items-end">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-widest text-[#797776]">{'// SECTION 02'}</span>
              <h2 className="font-monad-serif mt-2 text-[32px] text-[#242424] sm:text-[42px]">
                Built for focus, engineered for resilience.
              </h2>
            </div>
            <p className="max-w-[420px] font-mono text-[13px] leading-relaxed text-[#4e4d4d]">
              Every architectural decision strips away distractions so your team can maintain continuous momentum.
            </p>
          </div>

          {/* Signature Elevated Periwinkle Mist Card */}
          <div className="relative mb-8 overflow-hidden rounded-[40px] bg-[#cfdaf5] p-8 sm:p-14">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#2b59d1]/30 bg-white/60 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-[#2b59d1]">
                  MATHEMATICAL ORDERING
                </span>
                <h3 className="font-monad-serif mt-4 text-[28px] text-[#242424] sm:text-[36px]">
                  Fractional rank sequencing.
                </h3>
                <p className="mt-4 font-mono text-[14px] leading-[1.7] text-[#4e4d4d]">
                  Moving a task card interpolates a midpoint rank between surrounding items without rewriting entire collections.
                  When rank precision narrows beneath tolerance (Δ &lt; 0.0001), the backend coordinates a transactional rebalancing in 2048-step increments.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3 font-mono text-[11px] text-[#242424]">
                  <span className="rounded-lg border border-[#a0b5eb] bg-white px-3 py-1">OPTIMISTIC UI ROLLBACK</span>
                  <span className="rounded-lg border border-[#a0b5eb] bg-white px-3 py-1">REVISION CONFLICT LOCKS</span>
                </div>
              </div>

              {/* Graphic container */}
              <div className="flex justify-center lg:col-span-6">
                <StateTransformSvg />
              </div>
            </div>
          </div>

          {/* Three Classic Hairline Cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Card 1 */}
            <div className="rounded-[40px] border border-[#cecac8] bg-[#f6f3f1] p-8 sm:p-10">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#cecac8] bg-white text-[#242424]">
                <ShieldCheck size={20} />
              </div>
              <h3 className="font-monad-serif mt-6 text-[22px] text-[#242424]">
                Strict server authorization.
              </h3>
              <p className="mt-3 font-mono text-[13px] leading-[1.65] text-[#4e4d4d]">
                Every mutation passes through same-origin Node.js route handlers.
                Tokens are validated with Firebase Admin SDK, ensuring non-members receive 404 responses for private identifiers.
              </p>
            </div>

            {/* Card 2 */}
            <div className="rounded-[40px] border border-[#cecac8] bg-[#f6f3f1] p-8 sm:p-10">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#cecac8] bg-white text-[#242424]">
                <KeyRound size={20} />
              </div>
              <h3 className="font-monad-serif mt-6 text-[22px] text-[#242424]">
                Email-bound invitations.
              </h3>
              <p className="mt-3 font-mono text-[13px] leading-[1.65] text-[#4e4d4d]">
                Owner-generated invitations are hashed using SHA-256 before disk commit.
                Acceptance requires the matching verified Google account and preserves idempotency on repeated visits.
              </p>
            </div>

            {/* Card 3 */}
            <div className="rounded-[40px] border border-[#cecac8] bg-[#f6f3f1] p-8 sm:p-10">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#cecac8] bg-white text-[#242424]">
                <Move size={20} />
              </div>
              <h3 className="font-monad-serif mt-6 text-[22px] text-[#242424]">
                Universal accessibility.
              </h3>
              <p className="mt-3 font-mono text-[13px] leading-[1.65] text-[#4e4d4d]">
                Touch, mouse, and keyboard navigation. Explicit Move Up / Move Down buttons,
                column reordering with task migration, and strict zero-drag state while filtering.
              </p>
            </div>
          </div>
        </section>

        {/* 7. Signal vs Noise Section */}
        <section id="manifesto" className="my-28">
          <div className="mb-10 text-center">
            <span className="font-mono text-[11px] uppercase tracking-widest text-[#797776]">{'// SECTION 03: MANIFESTO'}</span>
            <h2 className="font-monad-serif mt-2 text-[36px] text-[#242424] sm:text-[48px]">
              Deliberate subtraction.
            </h2>
            <p className="mx-auto mt-3 max-w-[600px] font-mono text-[14px] text-[#4e4d4d]">
              We stripped away marketing trackers, nested hierarchies, and automated notifications.
              What remains is quiet, durable, and fast.
            </p>
          </div>

          <ClarityVsNoiseSvg />
        </section>

        {/* 8. Interactive FAQ Section */}
        <section id="specification" className="my-24">
          <div className="mb-8 border-b border-[#cecac8] pb-4 font-mono text-[11px] uppercase tracking-widest text-[#797776]">
            {'// SECTION 04: ARCHITECTURAL SPECIFICATION & FAQ'}
          </div>

          <div className="divide-y divide-[#cecac8]">
            {[
              {
                q: 'How does live synchronization work across remote devices?',
                a: 'TaskBoard subscribes client browsers to Firestore snapshot listeners on the active board, task collection, and membership roster. Any mutation written by the server triggers near-instantaneous delta broadcasts (< 200ms) to every connected client.',
              },
              {
                q: 'Why are client direct writes denied in Firestore rules?',
                a: 'Direct client writes introduce silent race conditions, stale overwrites, and bypass validation. Routing mutations through authenticated Next.js API endpoints ensures that business rules, rate limits, and revision concurrency locks are authoritatively validated.',
              },
              {
                q: 'What are the system limits in the current release?',
                a: 'Each account can own up to 20 boards. Boards support up to 20 columns, 20 members, 500 tasks, and 20 pending invitations. Mutations are throttled to 120 operations per minute per user to safeguard against runaway scripts.',
              },
              {
                q: 'How does invitation acceptance prevent unauthorized access?',
                a: 'The owner supplies an email address when creating an invite link. When a recipient opens the link, the server verifies that their authenticated Google ID token matches the exact invited email. Revoked or expired links (7 days) are immediately rejected.',
              },
              {
                q: 'What happens if a column with active tasks is deleted?',
                a: 'TaskBoard requires the board owner to designate a destination column for all existing cards before deletion can proceed. The server migrates tasks transactionally before removing the column document.',
              },
            ].map((item, index) => (
              <div key={item.q} className="py-8">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="flex w-full items-center justify-between text-left focus:outline-none"
                  aria-expanded={openFaq === index}
                >
                  <span className="font-monad-serif text-[20px] text-[#242424] sm:text-[24px]">
                    {item.q}
                  </span>
                  <ChevronDown
                    size={20}
                    className={`text-[#242424] transition-transform duration-200 ${
                      openFaq === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaq === index && (
                  <p className="mt-4 max-w-[850px] font-mono text-[14px] leading-[1.7] text-[#4e4d4d]">
                    {item.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 9. Final Call to Action */}
        <section className="my-28 rounded-[40px] border border-[#cecac8] bg-[#ffffff] p-10 text-center sm:p-20">
          <div className="mx-auto max-w-[720px]">
            <span className="inline-block font-mono text-[11px] uppercase tracking-widest text-[#797776]">
              A FRESH WORKSPACE AWAITS
            </span>
            <h2 className="font-monad-serif mt-3 text-[38px] text-[#242424] sm:text-[54px]">
              Make room for what’s next.
            </h2>
            <p className="mx-auto mt-4 max-w-[520px] font-mono text-[15px] leading-relaxed text-[#4e4d4d]">
              Open your first board in under two minutes. Invite collaborators, organize your cards, and build with quiet focus.
            </p>
            <div className="mt-8 flex justify-center">
              <button
                onClick={handleLogin}
                disabled={busy || loading}
                className="monad-pill-blue text-[15px]"
              >
                {busy ? 'CONNECTING…' : 'CONTINUE WITH GOOGLE'} <span aria-hidden="true">▸</span>
              </button>
            </div>
            <ErrorNotice message={error} />
          </div>
        </section>
      </main>

      {/* 10. Editorial Colophon / Footer */}
      <footer className="border-t border-[#cecac8] bg-[#f6f3f1] py-12 font-mono text-[12px] text-[#797776]">
        <div className="mx-auto flex max-w-[1432px] flex-col justify-between gap-6 px-6 sm:flex-row sm:items-center sm:px-10">
          <div className="flex items-center gap-3 text-[#242424]">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-[#2b59d1] text-white">
              <Columns3 size={12} />
            </span>
            <span className="font-medium">TASKBOARD</span>
            <span className="text-[#cecac8]">/</span>
            <span>MONAD STYLE REFERENCE</span>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <span>WARM PARCHMENT CANVAS (#F6F3F1)</span>
            <span className="hidden sm:inline">·</span>
            <span>UNTITLED SERIF &amp; ABC DIATYPE MONO</span>
            <span className="hidden sm:inline">·</span>
            <a
              href="https://github.com/justinwkUKM/TaskBoard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#242424] underline hover:text-[#2b59d1]"
            >
              GITHUB REPO
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
