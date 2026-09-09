'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PwaRegister() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('[PWA] Service Worker registered with scope:', registration.scope);
        } catch (error) {
          console.warn('[PWA] Service Worker registration failed:', error);
        }
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }
    }

    // 2. Capture install prompt
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      console.log('[PWA] TaskBoard app was successfully installed!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstalled(true);
    }
    setInstallPrompt(null);
  };

  if (!installPrompt || installed || dismissed) return null;

  return (
    <div className="pwa-install-banner" role="banner">
      <div className="pwa-install-content">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192x192.png"
          alt="TaskBoard"
          className="pwa-install-icon"
          width={34}
          height={34}
        />
        <div className="pwa-install-text">
          <strong>Install TaskBoard</strong>
          <span>Add to your home screen or dock for quick, offline-ready access.</span>
        </div>
      </div>
      <div className="pwa-install-actions">
        <button
          type="button"
          className="button small-button pwa-install-btn"
          onClick={handleInstallClick}
        >
          <Download size={13} /> Install app
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Dismiss install prompt"
          onClick={() => setDismissed(true)}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
