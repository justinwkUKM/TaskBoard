# TaskBoard delivery status

Updated 2026-09-09.

## Complete

- PRD and implementation plan saved in [`PRD.md`](./PRD.md) and [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md).
- Greenfield Next.js 16.3.4 / React 19.2.8 app implemented with responsive TZone-inspired visual system.
- Landing page, Google login entry point, boards dashboard, Kanban board, task editor, filters, drag/drop, keyboard move controls, column controls, board settings, member list, invitation links, removal/leave flows.
- Firestore-backed Node route handlers with token verification, role checks, revision conflicts, transactions, limits, invitation hashing/expiry, cleanup tombstones, optimistic UI rollback, and offline write blocking.
- Firebase projects: `taskboard-prod-260908` and `taskboard-dev-260908`.
- Firestore Standard Native databases in `asia-southeast1` for both projects.
- Web apps created: production app ID `1:1067963731301:web:bbce62f13d42a9cb17658a`; development app ID `1:905485724919:web:c8ac37cc5d0186ff6bb7f2`.
- Development Firestore rules and indexes deployed. Production deployment command reached successful database/index deployment; rerun after any rules change.
- Vercel project `taskboard` created and linked in `waqasobeidy111gmailcoms-projects`. Existing production URL: https://taskboard.waqasobeidy.com
- Production deployment `dpl_Bo4YmL55HFJbTssUnPK768B6RcVk` is READY and aliased to https://taskboard.waqasobeidy.com. The public shell responds over HTTPS.
- `npm run typecheck`, `npm run lint`, and `npm run build` pass. Lint has five non-blocking warnings in existing/style files.

## Remaining launch gates

1. Enable Google as a sign-in provider in Firebase Console for both projects, then add localhost, the Vercel production hostname, and the exact preview hostname to Authorized domains. The public Identity Platform REST initializer was attempted and rejected with `BILLING_NOT_ENABLED`; do not attach billing just to bypass this free-plan setup.
2. Populate Vercel environment variables from each Firebase web app config plus server-only Admin credentials. Production and Preview must use their respective Firebase projects. `VERCEL_OIDC_TOKEN` in the local `.env.local` is CLI-managed and must never be copied into app variables.
3. Deploy a preview and production build after environment configuration, then complete real Google OAuth with two accounts. Emulator tests cannot prove Google’s hosted login.
4. Install Java/OpenJDK on the development machine if running Firebase Emulator Suite; this machine currently has OpenJDK 21 available through Homebrew but the shell may need `JAVA_HOME` configured.

## Known non-blocking warnings

ESLint reports an anonymous PostCSS export, unused imports in an existing landing component, and an unoptimized avatar `<img>` in the existing UI. No lint errors or build failures remain.
