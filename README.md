# TaskBoard

A minimal, focused, real-time Kanban workspace designed for personal projects and small teams. Clear your head, organize your workflow, and turn your to-dos into done—one card at a time.

---

## Overview

TaskBoard pairs an uncluttered, high-focus interface with real-time collaboration. Anyone can sign in with Google, spin up private boards, organize tasks with custom columns, and share access with collaborators via secure email-bound invitation links.

Built on **Next.js App Router**, **Firebase Authentication**, and **Cloud Firestore**, TaskBoard guarantees strict data isolation, server-authoritative mutations, and zero client-side direct writes.

---

## Key Features

- **Google Authentication**: Single-click sign in with Google, session persistence, and multi-account switching.
- **Real-Time Board Sync**: Live updates across all open clients powered by Firestore real-time listeners.
- **Kanban Workflow**:
  - Drag-and-drop task cards powered by `@dnd-kit`.
  - Accessible keyboard reordering controls (Move Up / Move Down) and non-drag fallback.
  - Fractional rank indexing with automatic transactional rebalancing to prevent collision.
  - Default workflow states: *To do*, *In progress*, *Done*.
  - Full column customization: add, rename, reorder, and safely delete columns (with mandatory task reassignment).
- **Task Management**:
  - Required titles (up to 200 characters) and optional plain text descriptions (up to 10,000 characters).
  - Priority levels (*High*, *Medium*, *Low*, *None*) with distinct visual badges.
  - Time-zone safe calendar due dates with overdue warnings.
  - Single-member task assignments.
- **Search & Filters**:
  - Real-time title search.
  - Priority filtering and "Assigned to me" toggle.
  - Drag-and-drop safely disabled while filters are active to prevent accidental reordering; explicit moves remain accessible.
- **Collaboration & Access Control**:
  - Single-owner model with full administrative control (settings, columns, invites, deletion).
  - Member role for day-to-day task creation, editing, moving, and self-leaving.
  - Email-bound invitation tokens with 7-day expiration, single-use acceptance, and owner revocation.
  - Automatic task unassignment when members leave or are removed.
- **Safety & Resilience**:
  - Optimistic UI updates with instant rollback on network or validation errors.
  - Offline banner detection preventing unpersisted writes while disconnected.
  - Deletion tombstone pattern for safe, asynchronous cascade cleanup of boards, tasks, and invites.
  - Server-side sliding-window rate limiting.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16 (App Router)](https://nextjs.org/) |
| **UI Library** | [React 19](https://react.dev/) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) & Custom Design System |
| **Dialogs & Primitives** | [Radix UI Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) |
| **Drag & Drop** | [@dnd-kit](https://dndkit.com/) (Core & Sortable) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Validation** | [Zod](https://zod.dev/) |
| **Authentication** | [Firebase Authentication](https://firebase.google.com/docs/auth) (Google OAuth) |
| **Database** | [Cloud Firestore](https://firebase.google.com/docs/firestore) |
| **Backend / Admin** | [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup) (Node.js runtime) |
| **Testing** | [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/) |
| **Deployment** | [Vercel](https://vercel.com/) (sin1 region) |

---

## Architecture & Security Model

```
Browser Client (React / Next.js)
  │
  ├── Real-time Reads ──> Firestore Client SDK (Rules: Read-Only for Members)
  │
  └── Mutations ────────> Next.js API Routes (/api/[...path])
                            │
                            ├── Authenticate Bearer ID Token
                            ├── Enforce Verified Google Email & Origin
                            ├── Check Rate Limits (_limits collection)
                            ├── Validate Payload with Zod Schemas
                            ├── Check Revisions & Ownership / Membership
                            └── Execute Mutations via Firebase Admin SDK
```

1. **Client Firestore Rules**: Client access is strictly read-only for verified board members (`request.auth.uid in resource.data.memberIds`). All direct client writes (`allow write: if false;`) are denied globally.
2. **Server-Authoritative Mutations**: All creates, updates, deletes, and reorders must pass through the `/api/[...path]` route handler running under Node.js runtime.
3. **Invitation Privacy**: Invitation tokens are stored on the server as SHA-256 hashes (`hash(token)`). Raw tokens are never logged or stored. Acceptance verifies the user's verified Google email against the invited email address.
4. **Optimistic UI with Rollback**: Client-side state updates optimistically for responsive drag interactions, reverting automatically if the API responds with a conflict or network failure.

---

## Design System

The application follows the custom **TZone** minimalist aesthetic:

| Token | Hex Value | Role |
|---|---|---|
| **Paper** | `#f4f4f0` | Application canvas and page background |
| **Surface** | `#ffffff` | Card surfaces, dialogs, and popovers |
| **Ink** | `#0a0a0a` | Primary text and high-contrast buttons |
| **Muted** | `#62625d` | Secondary copy, captions, and placeholders |
| **Border** | `#dedfd9` | Structural dividers and card borders |
| **Lime Accent** | `#d7ff3f` | Sparse brand accent (hover: `#b9e619`) |
| **Danger** | `#b12727` | Destructive action confirmation |

Typography relies on clean, accessible system sans-serif (`Arial, Helvetica, sans-serif`) with visible focus outlines and complete `prefers-reduced-motion` accommodations.

---

## Getting Started

### Prerequisites

- **Node.js**: `22.x` (LTS recommended)
- **npm**: `10.x` or higher
- A [Firebase Project](https://console.firebase.google.com/) with **Authentication** (Google sign-in enabled) and **Firestore** database.

### 1. Clone the Repository

```bash
git clone https://github.com/justinwkUKM/TaskBoard.git
cd TaskBoard
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a local environment configuration file by copying the example template:

```bash
cp .env.example .env.local
```

Fill in the required values in `.env.local`:

```env
# Client-side Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Server-side Firebase Admin Credentials
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account@your_project_id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Emulator mode (optional, for local testing without cloud credentials)
NEXT_PUBLIC_USE_EMULATORS=false
# FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
# FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

> **Security Note:** Never commit `.env.local` or any files containing private keys or service account credentials. The repository's `.gitignore` is preconfigured to protect against accidental commits.

### 4. Deploy Firestore Rules & Indexes

If using the Firebase CLI:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to start using TaskBoard.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Next.js development server with hot reloading |
| `npm run build` | Compiles the production build (or `npx next build --webpack`) |
| `npm run start` | Runs the compiled Next.js production server |
| `npm run lint` | Analyzes code quality using ESLint |
| `npm run typecheck` | Validates TypeScript types across the entire project |
| `npm test` | Runs unit and integration test suites with Vitest |
| `npm run test:emulators` | Runs tests against local Firebase Auth & Firestore emulators |
| `npm run test:e2e` | Runs end-to-end browser tests with Playwright |

---

## Project Structure

```
TaskBoard/
├── docs/
│   ├── PRD.md                  # Detailed Product Requirements Document
│   └── IMPLEMENTATION_PLAN.md  # Architectural specification & launch gates
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── [...path]/
│   │   │       └── route.ts    # Unified Node.js API mutation route handler
│   │   ├── boards/
│   │   │   ├── [boardId]/
│   │   │   │   └── page.tsx    # Dynamic board view
│   │   │   └── page.tsx        # Boards dashboard
│   │   ├── invite/
│   │   │   └── [token]/
│   │   │       └── page.tsx    # Invitation acceptance view
│   │   ├── globals.css         # Design system tokens and styling
│   │   ├── layout.tsx          # Root layout and session provider wrapping
│   │   └── page.tsx            # Public landing page and Google sign-in
│   ├── components/
│   │   ├── board-dialogs.tsx   # Modals: Task Editor, Columns, Settings, Sharing
│   │   ├── board-screen.tsx    # Kanban board view with DnD context & toolbar
│   │   ├── providers.tsx       # Auth context, session state, and API helpers
│   │   └── ui.tsx              # Reusable UI elements (Header, Logo, Modal, etc.)
│   └── lib/
│       ├── firebase.ts         # Client Firebase initialization & emulator config
│       ├── types.ts            # Core TypeScript interfaces and domain limits
│       ├── validation.ts       # Zod schemas for all mutations and payloads
│       └── server/
│           ├── admin.ts        # Firebase Admin SDK initialization
│           ├── auth.ts         # Token verification, assertions, and throttling
│           └── service.ts      # Authoritative database operations & transactions
├── firestore.rules             # Client read security rules
├── firestore.indexes.json      # Firestore composite indexes
├── firebase.json               # Firebase CLI & emulator configuration
├── next.config.ts              # Next.js configuration and security headers
└── vercel.json                 # Vercel deployment configuration
```

---

## License

This project is licensed under the [Apache License 2.0](LICENSE).
