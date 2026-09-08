# TaskBoard — Implementation Plan

Approved 2026-09-08. This plan accompanies PRD.md; completed work and outstanding verification are recorded in STATUS.md.

## 1. Foundation

Create a TypeScript Next.js App Router project, latest stable version at scaffolding (verified npm: Next 16.3.4, React 19.2.8). Pin dependencies through the lockfile. Use Tailwind, accessible dialog primitives, keyboard-compatible drag/drop, Zod, Firebase client/Admin SDKs, Vitest, Firebase Emulator Suite and Playwright. Set a supported Node LTS for deployment.

Define the TZone design tokens and responsive app shell. Deliver setup instructions, environment template, Firestore rules/indexes and deployment runbook. No existing code or migration is required.

## 2. Identity, authorization and data

Firebase Google login maintains the browser session. Send SDK-managed ID tokens as bearer tokens to same-origin Next.js Node route handlers. Verify tokens, Google provider/verified email, input and current role on every mutation. All mutations use Admin SDK; client Firestore listeners supply live reads. Render protected pages as loading shells until authentication resolves. Do not cache private data in shared caches or expose credentials in browser bundles.

Firestore client rules allow authorized reads and deny every direct write. Admin SDK bypasses rules, so independently enforce permissions in the backend. Read membership within transactions to handle removal races.

| Collection | Data |
|---|---|
| users/{uid} | Minimal private profile and server counters |
| boards/{id} | Name, description, ownerId, memberIds, ordered columns, revision, timestamps, deletion state |
| boards/{id}/members/{uid} | Role and board-visible profile |
| boards/{id}/tasks/{id} | Task fields, column, rank, revision, metadata |
| boards/{id}/invites/{id} | Normalized email, token hash, expiry, acceptance/revocation |

Use opaque IDs, authoritative identity from tokens, token hashes only, and owner-only invitation reads. Dashboard query: memberIds array-contains uid, updatedAt descending. Commit indexes. Subscribe only to dashboard/current board data.

## 3. Backend interfaces

JSON endpoints, authenticated and validated:

- POST /api/profile: initialize/update profile.
- POST /api/boards: create board.
- PATCH/DELETE /api/boards/[id]: settings/delete.
- POST/PATCH/DELETE /api/boards/[id]/columns: create, rename, reorder, remove with destination.
- POST /api/boards/[id]/tasks: create.
- PATCH/DELETE /api/boards/[id]/tasks/[taskId]: edit, move/reorder, delete.
- GET/POST/DELETE /api/boards/[id]/invites: list/create/revoke.
- POST /api/invitations/accept: accept email-bound token.
- DELETE /api/boards/[id]/members/[uid]: owner removal or self-leave.

Structured errors distinguish validation, login, permission, missing resources, conflicts, limits and service failure. Nonmembers receive not-found for private identifiers. Use revision checks to prevent silent stale overwrites and idempotent create operation IDs. Persist per-user throttling; no process-local rate counters.

Ordering: fractional task ranks, serialized through board revision; transactional rebalancing when needed. Transactions coordinate invitation acceptance, membership, moves and column changes. Optimistic updates rollback on failure and show saving/error state. Offline writes are disabled. Board deletion first tombstones access, then performs idempotent chunked cleanup with documented retry.

## 4. UI delivery

Implement public login, board dashboard, Kanban, task modal, filters, member management and invitation acceptance. Default columns: To do / In progress / Done. Owners alone manage columns/settings/membership. Include drag and explicit accessible ordering/move controls. Disable drag while filtered. Enforce limits from PRD; handle stale edits, disconnected state, empty data, access removal and service errors.

## 5. Provisioning and release

Create Firebase TaskBoard and TaskBoard Development with unique taskboard-prod-/taskboard-dev- IDs under waqasobeidy@gmail.com. Spark, no billing. Create Standard Native Firestore in asia-southeast1, web registrations, Google provider/support email, exact authorized origins. Deploy rules/indexes. Use dedicated least-privilege runtime service accounts; place server credentials only in protected environment settings.

Create taskboard Vercel project in waqasobeidy111gmailcoms-projects, unique suffix if needed. Next.js preset, Node LTS, sin1 functions. Production credentials only in Production; development credentials in Preview. Configure explicit application origins and authorize actual preview/production hosts before OAuth tests. Local tests use emulators. CLI deployment is sufficient; GitHub connection is optional and not a launch dependency.

Deploy preview, verify, then production. Record IDs, URLs, environment mapping and evidence. Vercel rollback restores code, not Firestore data. Do not claim unlimited availability on free quotas.

## 6. Tests and launch gate

- Typecheck, lint, build.
- Validation, authorization, dates, ordering, revision conflicts.
- Emulator rules tests: anonymous/nonmember isolation, direct writes denied, owner-only invitations/private profiles.
- API integration: all owner/member restrictions, wrong/expired/revoked/repeated invitations, simultaneous acceptance/moves, removal races, populated column deletion, assignment cleanup, interrupted deletion.
- Browser: lifecycle, filters, keyboard, mobile, persistence, rollback.
- Production: real Google login/logout; two-account invitation/live updates; unrelated account isolation; revoked access; environment separation; client secret scan.

Real Google OAuth requires real account interaction and must not be represented as verified by emulator tests. Record any remaining manual gate explicitly.

## References

- https://nextjs.org/docs/app/getting-started/installation
- https://firebase.google.com/docs/firestore/security/rules-conditions
- https://firebase.google.com/docs/firestore/manage-data/transactions
- https://firebase.google.com/docs/firestore/locations
- https://vercel.com/docs/frameworks/full-stack/nextjs
- https://vercel.com/docs/plans/hobby
- https://firebase.google.com/pricing
