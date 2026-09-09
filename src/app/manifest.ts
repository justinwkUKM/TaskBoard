import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TaskBoard — A little space for progress',
    short_name: 'TaskBoard',
    description: 'A simple, shared space to turn to-dos into done. Organize tasks, invite your people, and make progress together.',
    start_url: '/',
    id: '/',
    display: 'standalone',
    display_override: ['standalone', 'window-controls-overlay', 'minimal-ui'],
    background_color: '#f4f4f0',
    theme_color: '#0a0a0a',
    orientation: 'portrait-primary',
    scope: '/',
    categories: ['productivity', 'utilities'],
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'My Boards',
        short_name: 'Boards',
        description: 'Open your collaborative task boards',
        url: '/boards',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'AI Helper',
        short_name: 'Assistant',
        description: 'Generate and organize tasks with AI',
        url: '/assistant',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
    ],
  };
}
