# TaskBoard

A minimal, focused, real-time Kanban workspace designed for personal projects and small teams. Clear your head, organize your workflow, and turn your to-dos into done—one card at a time.

---

## Overview

TaskBoard pairs an uncluttered, high-focus interface with real-time collaboration. Anyone can sign in with Google, spin up private boards, organize tasks with custom columns, and share access with collaborators via secure email-bound invitation links.

Built on **Next.js App Router**, **Firebase Authentication**, and **Cloud Firestore**, TaskBoard guarantees strict data isolation, server-authoritative mutations, and zero client-side direct writes.

---

## Key Features

- **Dual Authentication**: Single-click sign in with Google or passwordless email magic links, session persistence, and multi-account switching.
- **AI Coding Agent Collaboration (MCP)**:
  - First-class support for **Google Antigravity**, **OpenAI Codex**, **Claude Code**, and **Cursor** via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/).
  - Scoped agent tokens (`tb_agent_...`) with high-entropy SHA-256 storage, restricting agents to task execution without board admin access.
  - Transactional leases (90s with automatic heartbeats) preventing stale execution or duplicate claims.
  - Objective verification gating: agents submit structured reports containing real test exit codes, commit SHAs, and diff stats.
  - Backend-enforced Done column safety: agents are prohibited from marking tasks as "Done" directly (requiring human approval or verified VCS merge webhooks).
  - Local runner with Git worktree isolation (`git worktree add`) ensuring agent tasks run without dirtying the developer's working tree.
- **Progressive Web App (PWA)**:
  - Installable application with offline-first service worker caching app shell and static assets.
  - Adaptive home-screen icons and Web App Manifest.
  - Real-time offline detection banner preventing unsaved writes.
- **Minimalist Paper & Ink UI**:
  - Distraction-free TZone aesthetic with high-contrast Ink and Paper palette.
  - Compact icon-only header toolbar with dark ink micro hover tooltips.
  - Extra-wide (880px) AI Agents & MCP setup dialog with 3-step guidance and one-click JSON/CLI configuration copying.
  - Celebratory strike-through animation when tasks reach Done.
  - Interactive agent collaboration preview on the landing page.
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
  - Single-member or agent pool task assignments.
  - Collapsible structured review report viewer with command verification logs and file diff statistics.
- **Search & Filters**:
  - Real-time title search.
  - Priority filtering and "Assigned to me" toggle.
  - Drag-and-drop safely disabled while filters are active to prevent accidental reordering; explicit moves remain accessible.
- **Collaboration & Access Control**:
  - Single-owner model with full administrative control (settings, columns, invites, deletion, agent tokens).
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
| **Agent Protocol** | [@modelcontextprotocol/sdk](https://modelcontextprotocol.io/) (v1.30.0+) |
| **Drag & Drop** | [@dnd-kit](https://dndkit.com/) (Core & Sortable) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Validation** | [Zod](https://zod.dev/) |
| **Authentication** | [Firebase Authentication](https://firebase.google.com/docs/auth) (Google OAuth & Email Magic Link) |
| **Database** | [Cloud Firestore](https://firebase.google.com/docs/firestore) |
| **Backend / Admin** | [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup) (Node.js runtime) |
| **PWA / Caching** | Service Worker API & Web App Manifest |
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
5. **Scoped Agent Tokens & Security**: Agent tokens (`tb_agent_...`) provide scoped access strictly limited to reading task specifications, acquiring leases, posting progress logs, asking questions, and submitting completion reports. Only SHA-256 hashes are persisted; plain tokens are shown once at creation. Agent tokens are prohibited from board administration, invite management, and marking tasks "Done".
6. **Objective Verification & Review Gating**: Tasks completed by agents transition to "Ready for Review" accompanied by automated test logs, command exit codes (`0 = pass`), git branches, and PR links. Only a human board member or a verified Git merge webhook can transition a task to "Done".

---

## AI Coding Agent Collaboration (MCP)

TaskBoard connects real-world coding assistants directly to your Kanban board via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/). Supported coding assistants include **Google Antigravity**, **OpenAI Codex**, **Claude Code CLI**, and **Cursor**.

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        TaskBoard Cloud Plane                               │
│                                                                            │
│   [To Do] ──────────────► [In Progress] ──────────────► [Ready for Review]  │
│      │                           ▲                                ▲        │
│      │ 1. Claim Task Lease       │ 2. Heartbeats (90s)            │ 3. PR  │
│      │    (Firestore Tx)         │    & Progress Logs             │ Report │
│      ▼                           │                                │        │
│  ┌───────────────────────────────┴────────────────────────────────┴─────┐  │
│  │ Authenticated Agent API (/api/agent/v1)                              │  │
│  │ - Scoped Agent Token (`tb_agent_...`) validation                     │  │
│  │ - Transactional Leases & Stale-Run Rejection                         │  │
│  │ - Blocked 'Done' Direct Transitions (Human Review Required)         │  │
│  └──────────────────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────────────────┼──────────────────────────────────┘
                                          │ stdio / SSE
                                          ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                       Developer Workstation (Local Runner)                 │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ TaskBoard MCP Server & Git Worktree Manager                          │  │
│  │ - Spawns isolated Git worktree: `agent/{taskId}/attempt-1`           │  │
│  │ - Runs local verification tests (`npm test`, `vitest`)               │  │
│  │ - Preserves developer's uncommitted changes on working branch        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### 1. Generating a Scoped Agent Token

1. Open your board and click the **Agents & MCP** icon (or access it from **Share board** -> **AI Agents & MCP**).
2. Under **Generate Scoped Agent Token**, enter an agent name (e.g. `Google Antigravity`, `OpenAI Codex`, `Claude Code Local`).
3. Click **Generate Token** and copy your token (`tb_agent_...`). Plaintext tokens are displayed only once.

### 2. Connecting Your AI Coding Assistant

#### Google Antigravity & OpenAI Codex
Add TaskBoard to your tool's MCP configuration (`mcpServers.taskboard`):

```json
{
  "mcpServers": {
    "taskboard": {
      "command": "npx",
      "args": ["-y", "@taskboard/mcp-server"],
      "env": {
        "TASKBOARD_API_URL": "https://taskboard.waqasobeidy.com",
        "TASKBOARD_AGENT_TOKEN": "tb_agent_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

#### Claude Code CLI
Register TaskBoard in a single command:

```bash
claude mcp add taskboard npx -y @taskboard/mcp-server \
  --env TASKBOARD_API_URL=https://taskboard.waqasobeidy.com \
  --env TASKBOARD_AGENT_TOKEN=tb_agent_YOUR_TOKEN_HERE
```

#### Cursor & Claude Desktop
Add to your `cursor_settings.json` or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "taskboard": {
      "command": "npx",
      "args": ["-y", "@taskboard/mcp-server"],
      "env": {
        "TASKBOARD_API_URL": "https://taskboard.waqasobeidy.com",
        "TASKBOARD_AGENT_TOKEN": "tb_agent_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

### 3. Available MCP Tools

| Tool | Parameters | Description |
|---|---|---|
| `taskboard_get_task` | `taskId` | Fetches task title, description, priority, acceptance criteria, and repo metadata. |
| `taskboard_claim_task` | `taskId`, `baseCommit` | Transactionally claims a task, locks the base git commit, and moves it to *In Progress*. |
| `taskboard_heartbeat` | `runId` | Renews the 90-second lease to prevent stale-task reassignment. |
| `taskboard_record_log` | `runId`, `level`, `message` | Appends real-time execution logs and milestones to the run audit stream. |
| `taskboard_ask_human_question` | `runId`, `question`, `context` | Flags the card as *Needs Input*, records the blocker, and prompts the human user. |
| `taskboard_submit_for_review` | `runId`, `report` | Attaches objective verification results (test commands, exit codes, PR URL) and moves card to *Ready for Review*. |

> **Safety Guarantee**: Agent tokens cannot transition tasks to *Done*. Done column writes return `403 Forbidden`. Tasks must be verified by a human or confirmed via a signed GitHub/GitLab merge webhook.

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
│   ├── AI_AGENT_COLLABORATION_MCP.md # Model Context Protocol & agent specs
│   ├── IMPLEMENTATION_PLAN.md        # Launch gates & technical specs
│   ├── MAGIC_LINK_AUTH.md            # Passwordless email link authentication
│   ├── PRD.md                        # Product Requirements Document
│   └── STATUS.md                     # Milestone tracking & delivery status
├── public/
│   ├── manifest.json                 # PWA Web App Manifest
│   └── sw.js                         # PWA Service Worker caching
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── [...path]/
│   │   │       └── route.ts          # Unified Node.js API mutation route handler
│   │   ├── auth/finish/
│   │   │   └── page.tsx              # Email magic-link confirmation handler
│   │   ├── boards/
│   │   │   ├── [boardId]/
│   │   │   │   └── page.tsx          # Dynamic board view
│   │   │   └── page.tsx              # Boards dashboard
│   │   ├── invite/
│   │   │   └── [token]/
│   │   │       └── page.tsx          # Invitation acceptance view
│   │   ├── globals.css               # Design system tokens and styling
│   │   ├── layout.tsx                # Root layout, PWA meta, and auth provider
│   │   └── page.tsx                  # Public landing page and showcase
│   ├── components/
│   │   ├── board-dialogs.tsx         # Modals: Task Editor, Columns, Settings, Sharing, Agents & MCP
│   │   ├── board-screen.tsx          # Kanban board view with DnD context & toolbar
│   │   ├── landing-agent-collab.tsx  # Interactive AI Agent Collaboration showcase
│   │   ├── providers.tsx             # Auth context, session state, and API helpers
│   │   └── ui.tsx                    # Reusable UI elements (Header, Logo, Tooltips, Modal)
│   ├── mcp/
│   │   ├── cli.ts                    # MCP CLI runner entrypoint
│   │   ├── client.ts                 # HTTP client for TaskBoard Agent API
│   │   └── server.ts                 # Model Context Protocol stdio server implementation
│   ├── runner/
│   │   ├── index.ts                  # Autonomous execution orchestrator
│   │   ├── supervisor.ts             # External process lifecycle & timeout supervisor
│   │   └── worktree.ts               # Git worktree creation, isolation, & cleanup
│   └── lib/
│       ├── firebase.ts               # Client Firebase initialization & emulator config
│       ├── types.ts                  # Core TypeScript interfaces and agent types
│       ├── validation.ts             # Zod schemas for all mutations and payloads
│       └── server/
│           ├── admin.ts              # Firebase Admin SDK initialization
│           ├── agent-service.ts      # Agent token validation, transactional leases, reports
│           ├── auth.ts               # User token verification, assertions, and throttling
│           └── service.ts            # Authoritative database operations & transactions
├── firestore.rules                   # Client read security rules
├── firestore.indexes.json            # Firestore composite indexes
├── firebase.json                     # Firebase CLI & emulator configuration
├── next.config.ts                    # Next.js configuration and security headers
└── vercel.json                       # Vercel deployment configuration
```

---

## License

This project is licensed under the [Apache License 2.0](LICENSE).
