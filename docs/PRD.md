# TaskBoard — Product Requirements

Status: approved scope; implementation in progress. Date: 2026-09-08.

## Purpose and success criteria

A minimal Kanban website for personal projects and small groups. Anyone can sign in with Google, create boards, and invite collaborators. A new user should create their first task within two minutes. Changes must persist across reloads and appear in another member's open board, targeting two seconds on normal connectivity. Unauthorized users cannot access board data. Desktop, mobile, keyboard, and non-drag workflows must work.

## Confirmed decisions

- Latest stable Next.js for frontend and backend; Firebase Authentication and Firestore; Vercel deployment.
- Public Google signup; multiple private-to-members shared boards.
- Owners manage settings, columns, invitations, membership, and deletion. Members manage tasks and can leave.
- Email-bound invitation links copied and distributed by the owner. No outgoing email service.
- Custom columns, drag ordering, descriptions, priorities, due dates, optional single assignee.
- Personal, non-commercial launch on Firebase Spark and Vercel Hobby, Singapore, assigned vercel.app domain.
- Firebase account waqasobeidy@gmail.com; Vercel workspace waqasobeidy111gmailcoms-projects.

## Pages and journeys

- `/`: concise introduction and Continue with Google; authenticated users go to boards.
- `/boards`: owned and joined boards ordered by activity; create board.
- `/boards/[boardId]`: Kanban workspace, task editor, owner settings and sharing.
- `/invite/[token]`: sign in and accept invitation, preserving destination through login.
- Account menu: name, email, avatar, sign out.
- Handle cancelled/blocked sign-in, expired sessions, loading, empty, inaccessible, and unavailable states.

## Boards and columns

Board name is required; description optional. New boards contain To do, In progress, Done. Owners rename/delete boards and add/rename/reorder/delete columns. Prevent deletion of the last column. Removing a populated column requires selecting a destination for its tasks. Deleting a board requires confirmation and deletes its related data. Public signup never grants public board visibility.

## Tasks

| Field | Requirement |
|---|---|
| Title | Required; up to 200 characters |
| Description | Optional plain text; up to 10,000 characters |
| Column | Required workflow state |
| Priority | None, low, medium, high |
| Due date | Optional YYYY-MM-DD date without a time |
| Assignee | Optional current member or 'agent-pool' virtual assignee |
| Execution State | Agent status (unassigned, claimed, active, review_ready, blocked, failed), run leases, review reports |
| Metadata | Creator, created/updated time, revision |

Create within a column; edit/delete in a dialog. Drag between/within columns, with explicit Move to and keyboard ordering alternatives. New tasks append. Search titles and filter priority/Assigned to me. Disable drag ordering while filtered; explicit moves remain available. Clearing filters restores saved order. Dates do not shift across time zones. Show priority, due date, and assignee compactly. Tasks assigned to agents or the Agent Pool display execution status badges and collapsible review reports. No reminders.

## Collaboration

Exactly one owner; no ownership transfer in v1. Members can create/edit/move/assign/delete all board tasks but cannot change board settings, columns, membership, or delete the board. Members can leave; owners cannot leave their board.

Owner supplies an email and copies the generated invitation link. Links expire after seven days, are revocable and single-use, with idempotent repeated acceptance. Acceptance requires the matching verified Google or Magic Link email. Wrong-account users can switch accounts. Removing/leaving members clears their assignments and blocks subsequent reads/writes; open clients clear inaccessible state. Invitation emails are private to owners/server. No app-sent messages.

## AI Agent Collaboration & Model Context Protocol (MCP)

TaskBoard treats AI coding agents as authenticated, accountable team collaborators coordinating through the same Kanban board.

1. **Protocol**: Implements the Model Context Protocol (MCP) over stdio and SSE via `@modelcontextprotocol/sdk`.
2. **Supported Clients**: First-class support and configuration presets for **Google Antigravity**, **OpenAI Codex**, **Claude Code CLI**, and **Cursor**.
3. **Scoped Agent Tokens**:
   - High-entropy tokens (`tb_agent_...`, 192-bit random).
   - Only SHA-256 hashes are persisted; raw tokens are displayed once at generation time.
   - Tokens are scoped strictly to task execution endpoints (`/api/agent/v1/*`); they cannot modify board settings, columns, invitations, or member lists.
4. **Transactional Leases & Heartbeats**:
   - Claims are acquired via Firestore transactions with 90-second lease windows.
   - Background heartbeats renew leases every 30 seconds.
   - Expired leases are flagged for human recovery; stale-run updates are rejected with `409 Conflict`.
5. **Objective Verification & Review Gating**:
   - Agents submitting for review must attach a structured completion report containing actual OS command exit codes (`0 = pass`), duration, output snippets, git branch names, and file diff statistics.
   - Tasks transition to `Ready for Review`.
   - **Backend Safety**: Agent tokens are strictly blocked from transitioning tasks into the `Done` column (returns `403 Forbidden`). Only human review or a verified VCS merge webhook can complete a task.
6. **Worktree Isolation**:
   - Local runner executes coding tasks in isolated Git worktrees (`agent/{taskId}/attempt-{attempt}`), protecting the developer's working tree and uncommitted changes.

## Progressive Web App (PWA)

TaskBoard is an installable PWA designed for responsive mobile and desktop usage:
- Service worker (`public/sw.js`) provides app shell caching and offline resilience.
- Web App Manifest (`public/manifest.json`) defines adaptive icons, standalone display mode, and brand color tokens.
- Offline banner actively alerts users if network connectivity is lost and disables mutation buttons to prevent unpersisted state loss.

## Design

Exact palette extracted from https://tzone.waqasobeidy.com/_next/static/css/fc8d22c0790df249.css:

| Token | Value |
|---|---|
| Paper | #f4f4f0 |
| Surface | #ffffff |
| Ink / primary button | #0a0a0a |
| Muted | #62625d |
| Border | #dedfd9 |
| Lime | #d7ff3f |
| Lime hover | #b9e619 |

Arial/Helvetica, approximately 10px radii, restrained shadows, clear borders, near-black primary buttons. Lime is a sparse accent with dark text. Desktop: compact header, title/actions, horizontal columns, 44x44px icon-only header buttons with micro hover tooltips, extra-wide 880px AI Agents & MCP dialog. Mobile: wrapping/collapsible actions, horizontally scrollable columns, full-screen task editor. Accessible dialogs and labels, visible focus, reduced motion, non-color status labels. No dark mode or decorative imagery.

## Limits and exclusions

Initial configurable limits: 20 owned boards/user, 20 members/board, 20 columns/board, 500 tasks/board, 20 pending invitations/board, 20 agent tokens/board. Reject excess with useful feedback. Disable editing offline; do not queue writes.

Out of v1: comments, attachments, checklists, recurring tasks, calendars, reminders, notifications, public boards, viewer roles, ownership transfer, billing.

## Acceptance

Verify Google login and Email Magic Link on production; first-board/task journey; persistence and ordering; invitation with two accounts; live updates; unrelated-account isolation; member removal; revision conflicts; failed-save rollback; desktop/mobile/keyboard/contrast; preview/production separation; no secrets in client output; agent token generation; MCP tool invocation; lease expiration; review report submission; worktree isolation. Automated emulator login is not evidence of real Google OAuth acceptance.

## Hosting assumptions

Two new Spark Firebase projects separate production and preview. Local automated tests use emulators. One Vercel project with environment-scoped configuration. No billing attachment, paid subscriptions, custom domain, or email provider. Free plans have quotas and Vercel Hobby is for personal non-commercial use.

Sources: https://nextjs.org/docs/app/getting-started/installation ; https://firebase.google.com/pricing ; https://vercel.com/docs/plans/hobby .
