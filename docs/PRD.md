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
| Assignee | Optional current member |
| Metadata | Creator, created/updated time, revision |

Create within a column; edit/delete in a dialog. Drag between/within columns, with explicit Move to and keyboard ordering alternatives. New tasks append. Search titles and filter priority/Assigned to me. Disable drag ordering while filtered; explicit moves remain available. Clearing filters restores saved order. Dates do not shift across time zones. Show priority, due date, and assignee compactly. No reminders.

## Collaboration

Exactly one owner; no ownership transfer in v1. Members can create/edit/move/assign/delete all board tasks but cannot change board settings, columns, membership, or delete the board. Members can leave; owners cannot leave their board.

Owner supplies an email and copies the generated invitation link. Links expire after seven days, are revocable and single-use, with idempotent repeated acceptance. Acceptance requires the matching verified Google email. Wrong-account users can switch accounts. Removing/leaving members clears their assignments and blocks subsequent reads/writes; open clients clear inaccessible state. Invitation emails are private to owners/server. No app-sent messages.

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

Arial/Helvetica, approximately 10px radii, restrained shadows, clear borders, near-black primary buttons. Lime is a sparse accent with dark text. Desktop: compact header, title/actions, horizontal columns. Mobile: wrapping/collapsible actions, horizontally scrollable columns, full-screen task editor. Accessible dialogs and labels, visible focus, reduced motion, non-color status labels. No dark mode or decorative imagery.

## Limits and exclusions

Initial configurable limits: 20 owned boards/user, 20 members/board, 20 columns/board, 500 tasks/board, 20 pending invitations/board. Reject excess with useful feedback. Disable editing offline; do not queue writes.

Out of v1: comments, attachments, checklists, recurring tasks, calendars, reminders, notifications, public boards, viewer roles, ownership transfer, billing, AI, offline editing, native apps.

## Acceptance

Verify Google login/logout on production; first-board/task journey; persistence and ordering; invitation with two Google accounts; live updates; unrelated-account isolation; member removal; revision conflicts; failed-save rollback; desktop/mobile/keyboard/contrast; preview/production separation; no secrets in client output. Emulator tests cover server authorization and client rules. Automated emulator login is not evidence of real Google OAuth acceptance.

## Hosting assumptions

Two new Spark Firebase projects separate production and preview. Local automated tests use emulators. One Vercel project with environment-scoped configuration. No billing attachment, paid subscriptions, custom domain, or email provider. Free plans have quotas and Vercel Hobby is for personal non-commercial use.

Sources: https://nextjs.org/docs/app/getting-started/installation ; https://firebase.google.com/pricing ; https://vercel.com/docs/plans/hobby .
