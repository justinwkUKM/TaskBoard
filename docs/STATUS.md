# TaskBoard delivery status

Updated 2026-09-10.

## Complete

- **Core Product Architecture**:
  - PRD and implementation plan saved in [`PRD.md`](./PRD.md) and [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md).
  - Greenfield Next.js 16.3.4 / React 19.2.8 app implemented with responsive TZone-inspired visual system.
  - Landing page, Google OAuth and passwordless Email Magic Link login, boards dashboard, Kanban board, task editor, filters, drag/drop, keyboard move controls, column controls, board settings, member list, invitation links, removal/leave flows.
  - Firestore-backed Node route handlers with token verification, role checks, revision conflicts, transactions, limits, invitation hashing/expiry, cleanup tombstones, optimistic UI rollback, and offline write blocking.
- **AI Agent Collaboration Plane (Model Context Protocol)**:
  - Full MCP stdio server (`src/mcp/server.ts`) exposing 6 core tools: `taskboard_get_task`, `taskboard_claim_task`, `taskboard_heartbeat`, `taskboard_record_log`, `taskboard_ask_human_question`, and `taskboard_submit_for_review`.
  - Scoped agent tokens (`tb_agent_...`, 192-bit entropy) with SHA-256 server storage and one-time display.
  - First-class multi-client configuration for **Google Antigravity**, **OpenAI Codex**, **Claude Code CLI**, and **Cursor**.
  - Local autonomous runner (`src/runner/`) with Git worktree isolation (`src/runner/worktree.ts`) and process supervisor with wall-clock/turn budgets (`src/runner/supervisor.ts`).
  - Transactional leases (90s expiration with automated heartbeat renewal) preventing stale runs and duplicate claims.
  - Objective verification gating requiring real command exit codes, commit SHAs, and file diff statistics.
  - Backend-enforced safety preventing agent tokens from transitioning cards to "Done" directly (403 Forbidden).
  - Extra-wide (880px) AI Agents & MCP setup dialog with 3-step guidance, client switcher tabs, and automatic token injection.
  - Conditional Agent Pool dropdown and collapsible review report accordion in Task Editor modal.
- **UI & UX Polish**:
  - Board header action buttons refactored to clean 44x44px icon-only tiles (AI Helper, Agents & MCP, Share board, Settings) with high-contrast Ink micro hover tooltips.
  - Interactive AI Agent Collaboration showcase on the landing page featuring a 3-stage animated workflow stepper and live monospace terminal stream.
  - Celebratory strike-through animation when tasks are moved to "Done".
- **Progressive Web App (PWA)**:
  - Service worker (`public/sw.js`) caching app shell and static assets with offline write blocking.
  - Web App Manifest (`public/manifest.json`) and adaptive brand icons (`public/icons/`).
- **Cloud Infrastructure & Production**:
  - Firebase projects: `taskboard-prod-260908` and `taskboard-dev-260908`.
  - Firestore Standard Native databases in `asia-southeast1` for both projects.
  - Web apps created: production app ID `1:1067963731301:web:bbce62f13d42a9cb17658a`; development app ID `1:905485724919:web:c8ac37cc5d0186ff6bb7f2`.
  - Development Firestore rules and indexes deployed. Production deployment command reached successful database/index deployment; rerun after any rules change.
  - Vercel project `taskboard` created and linked in `waqasobeidy111gmailcoms-projects`. Existing production URL: https://taskboard.waqasobeidy.com
  - Production deployment `dpl_Bo4YmL55HFJbTssUnPK768B6RcVk` is READY and aliased to https://taskboard.waqasobeidy.com. The public shell responds over HTTPS.
  - Email Link sign-in is enabled in both Firebase projects (`signIn.email.enabled: true`) and deployed in production as `dpl_CXMw5YLAk7pThNLjM3X6VWY1mueE`.
- **Quality Assurance**:
  - 27/27 Vitest unit and integration tests passing (`npm test`), including comprehensive agent lease, token, and verification gating tests (`tests/agent-collaboration.test.ts`).
  - TypeScript typechecking passes with 0 errors (`npm run typecheck`).
  - Next.js production build compiles cleanly (`npm run build`).

## Remaining launch gates

1. Google provider is enabled in both Firebase projects. Add localhost, the Vercel production hostname, and the exact preview hostname to Authorized domains as new preview URLs are created. The public Identity Platform REST initializer was attempted and rejected with `BILLING_NOT_ENABLED`; do not attach billing just to bypass this free-plan setup.
2. Populate Vercel environment variables from each Firebase web app config plus server-only Admin credentials. Production and Preview must use their respective Firebase projects. `VERCEL_OIDC_TOKEN` in the local `.env.local` is CLI-managed and must never be copied into app variables.
3. Deploy a preview and production build after environment configuration, then complete real Google OAuth with two accounts. Emulator tests cannot prove Google’s hosted login.
4. Install Java/OpenJDK on the development machine if running Firebase Emulator Suite; this machine currently has OpenJDK 21 available through Homebrew but the shell may need `JAVA_HOME` configured.

## Known non-blocking warnings

ESLint reports an anonymous PostCSS export, unused imports in an existing landing component, and an unoptimized avatar `<img>` in the existing UI. No lint errors or build failures remain.

## Next Roadmap Milestones

- **Automated VCS Merge Webhook (`/api/webhooks/vcs`)**: Receiving signed GitHub/GitLab PR merge events to automatically mark reviewed cards as "Done".
- **Agent Capability Matching**: Matching card tags (e.g. `frontend`, `test`, `refactor`) against configured agent skills in unattended runner pools.
