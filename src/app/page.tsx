'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check } from 'lucide-react';
import { useSession, errorMessage } from '@/components/providers';
import { Header, Footer, ErrorNotice } from '@/components/ui';
import { LandingHeroBoard } from '@/components/landing-hero-board';
import { LandingBentoGrid } from '@/components/landing-bento-grid';

export default function Home() {
  const { user, login, loading } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) router.replace('/boards');
  }, [user, router]);

  const handleGoogleLogin = async () => {
    setBusy(true);
    setError('');
    try {
      await login();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Header />
      <main className="landing">
        <section className="hero-copy">
          <span className="eyebrow hero-stagger-1">
            <span className="tiny-square" /> LESS BUSY. MORE DONE.
          </span>
          <h1 className="hero-stagger-2">
            A little space<br />
            for <span className="highlight">progress.</span>
          </h1>
          <p className="hero-stagger-3">
            Clear your head. Gather your people.<br />
            Turn your to-dos into done, one card at a time.
          </p>
          <div className="hero-stagger-4">
            <button
              className="button hero-button"
              disabled={busy || loading}
              onClick={handleGoogleLogin}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.8 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.6ZM12 22c2.7 0 5-.9 6.7-2.5l-3.3-2.6c-.9.6-2 1-3.4 1-2.6 0-4.9-1.8-5.7-4.2H2.9v2.7A10 10 0 0 0 12 22ZM6.3 13.7A6 6 0 0 1 6 12c0-.6.1-1.2.3-1.7V7.6H2.9A10 10 0 0 0 2 12c0 1.6.4 3.1.9 4.4l3.4-2.7ZM12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9.1 5.6l3.4 2.7C7.1 7.9 9.4 6.1 12 6.1Z"
                />
              </svg>
              {busy ? 'Opening Google…' : 'Continue with Google'}
              <ArrowRight size={18} />
            </button>
            <ErrorNotice message={error} />
            <span className="hero-note">
              <Check size={14} /> Free to start. Refreshingly simple.
            </span>
          </div>
        </section>

        {/* Tier 1 & Tier 2: Interactive Draggable Hero Board with 3D Tilt */}
        <LandingHeroBoard />

        {/* Tier 3: Product Showcase Modern Bento Grid */}
        <LandingBentoGrid />
      </main>
      <Footer />
    </>
  );
}
