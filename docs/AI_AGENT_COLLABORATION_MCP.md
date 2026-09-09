# TaskBoard AI Agent Collaboration (MCP Architecture & Technical Specification)

**Status:** Production-Ready Architectural Blueprint  
**Protocol:** Model Context Protocol (MCP)  
**Execution Topology:** Local-First Single-Task Runner (Phase 1) with Orchestrated Recovery  
**Target Hosts:** Claude Code CLI, OpenCode, Codex, Cursor, and MCP-compliant hosts  

---

## 1. Executive Summary & Core Philosophy

TaskBoard bridges engineering task planning and autonomous code execution by treating AI coding agents as accountable, authenticated team collaborators on the same Kanban board.

Rather than relying on ungrounded cloud sandboxes or fragile terminal copy-pasting, TaskBoard adopts an **orchestrated, local-first execution model**. The developer's machine hosts the repository, compilers, and test suites, while TaskBoard provides the coordination plane: atomic lease claiming, task context, human clarification channels, execution telemetry, and review gating.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             TaskBoard Cloud Plane                                │
│                                                                                  │
│   [To Do] ───────────────► [In Progress] ───────────────► [Ready for Review]     │
│      │                           ▲                                ▲              │
│      │ 1. Transactional Claim    │ 2. Lease Heartbeats            │ 3. Submit PR │
│      │    & Base Commit Lock     │    & Progress Telemetry        │    & Report  │
│      ▼                           │                                │              │
│  ┌───────────────────────────────┴────────────────────────────────┴───────────┐  │
│  │ Authenticated TaskBoard API (/api/agent/v1)                                │  │
│  │ - Scoped Agent Tokens (Read/Write tasks, no admin/member permissions)      │  │
│  │ - Transactional Leases & Stale-Run Rejection                               │  │
│  │ - Subcollection Execution Runs & Audit Events                              │  │
│  └──────────────────────────────────────┬─────────────────────────────────────┘  │
└─────────────────────────────────────────┼────────────────────────────────────────┘
                                          │ HTTPS / SSE
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                      Developer Workstation (Local Runner)                        │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │ Local TaskBoard Runner / MCP Server Process                                │  │
│  │ - Scoped Environment Config (Strict development credentials; no .env dump) │  │
│  │ - Git Worktree Manager: Isolated `agent/{taskId}/{attempt}` branch checkout│  │
│  │ - External Process Supervisor: Wall-clock timeouts, turn & budget caps     │  │
│  │ - Lease Heartbeat Daemon & Crash Forensics Preserver                       │  │
│  └──────────────────────────────────────┬─────────────────────────────────────┘  │
│                                         │ Standard MCP Tool Invocations          │
│                                         ▼                                        │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │ Coding Agent Execution Engine (e.g., Claude Code CLI in Worktree)          │  │
│  │ - Reads repo context, verifies bounded reproduction                       │  │
│  │ - Implements changes, runs local test commands (`npm test`, `vitest`)      │  │
│  │ - Prepares verifiable evidence: command exit codes, commit SHA, PR URL     │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Fundamental Architectural Decisions

### 2.1. MCP Scope & Orchestration Model
- **Protocol Role:** TaskBoard provides an MCP server interface exposing tools and context resources. 
- **Orchestration Reality:** MCP provides standard tool calling and server-to-client notifications, but does not provide a portable guarantee that a host will independently begin coding or handle OS signals. The host environment still requires deliberate invocation and lifecycle management.
- **Phase 1 Scope:** Explicit, single-task execution. The developer initiates a task run (e.g. `npx @taskboard/runner run --task=<id>` or prompting Claude Code: `claude "Work on task <id> using TaskBoard MCP"`). Unattended multi-task daemons are deferred until single-task lifecycle resilience is proven.

### 2.2. Worktree Isolation vs. Sandboxing
- **Worktree Boundary:** Every execution attempt is allocated a dedicated Git worktree:
  ```bash
  git worktree add ../taskboard-runs/<taskId>-<attempt> -b agent/<taskId>/attempt-<attempt> <baseCommit>
  ```
  This prevents index corruption, dirty tree overwrites, and race conditions with the developer’s active VS Code session.
- **Worktrees are NOT Security Sandboxes:** A worktree shares `.git` objects and executes under the local user account with access to host networking and filesystems.
- **Security & Environment Hardening:**
  - Never mirror the developer’s full `.env.local`. Inject only explicitly declared, task-scoped test credentials.
  - Retain failed worktrees for post-mortem forensics; clean up only when changes are confirmed pushed or superseded.
  - Treat all task descriptions, card comments, and labels as **untrusted input**. The runner must never evaluate task text directly in shell commands (`eval`, unescaped string interpolation) or accept arbitrary paths from card metadata.

### 2.3. Workflow Gating: "Ready for Review" vs. "Done"
- **Separation of Concerns:** "Auto-Done" and "Auto-Merge" are distinct policies with differing risk profiles.
- **Default Lifecycle for Code Tasks:**
  $$\text{To Do} \longrightarrow \text{In Progress} \longrightarrow \text{Ready for Review} \longrightarrow \text{Done}$$
- **Ready for Review Requirements:**
  - Branch pushed to remote repository and/or Pull Request created.
  - Structured completion report attached with exact commands executed and exit codes.
- **Done Gate:**
  - Moving to **Done** requires an authorized human approval or a cryptographically verified webhook event from a merged PR.
  - **Backend Enforcement:** The transition into the `Done` column is blocked at the API layer for agent tokens. Prompting an agent not to mark Done is insufficient; the backend rejects unauthorized column transitions.
  - Autonomous Auto-Done is an explicit, per-task opt-in reserved strictly for zero-code workflows (e.g. documentation generation or ticket enrichment).

### 2.4. Atomic Leases & Crash Recovery
- **The Failure Mode:** Laptop lids close, processes crash with OOM, networks drop, or runners hang mid-execution. A simple `claimedBy` string creates permanent deadlocks.
- **Execution Run Record:** Every attempt creates an immutable subcollection document: `/boards/{boardId}/tasks/{taskId}/runs/{runId}`.
- **Lease Mechanics:**
  - The runner claims a task inside a **Firestore transaction**, verifying `task.currentRunId == null` and setting `leaseExpiresAt = now + 90s`.
  - **Heartbeats:** The runner sends background heartbeats (`POST /api/agent/v1/runs/{runId}/heartbeat`) every 30s to extend `leaseExpiresAt`.
  - **Optimistic Concurrency:** All updates (logs, questions, review submissions) must present the valid `runId`. Stale or expired runs receive `409 Conflict` and are rejected.
  - **Idempotency & External Side-Effects:** Firestore transaction callbacks retry automatically on conflict. Network calls (spawning CLIs, pushing branches, opening PRs) **must never run inside transaction callbacks**.
  - **Recovery Strategy:** Phase 1 uses **supervised recovery**. If a run expires, the task is flagged with a warning badge ("Agent Run Timed Out"). A human or explicit CLI flag resets or re-assigns the run; automatic aggressive re-claiming is disallowed to avoid infinite crash loops.

### 2.5. Runner-Enforced Operational Budgets
- **Supervisor Limits:** Limits are enforced externally by the runner process supervisor, not by the LLM:
  1. **Wall-Clock Deadline:** Hard ceiling (e.g., 15 minutes default). When exceeded, the supervisor terminates the child process tree (`SIGTERM` $\to$ 5s $\to$ `SIGKILL`).
  2. **Model Turn Limits:** Enforced via CLI flags (e.g. Claude Code `--max-turns`).
  3. **Spend Limits:** Enforced via provider spending ceilings where available.
- **Clarification Thresholds:** The agent is given a bounded window (e.g. 2 turns / 3 minutes) to inspect code and error traces before asking questions. It must request human input (`taskboard_ask_human_question`) only when forced to invent missing business logic or product requirements.

### 2.6. Decoupled Execution State
- TaskBoard supports user-defined column names and pipelines. Agent logic must never depend on a column being named `"In Progress"` or `"Done"`.
- Board settings map semantic stages (`todo`, `in_progress`, `review`, `done`) to board column IDs.
- High-frequency telemetry (terminal output, tool execution logs) is written to `/runs/{runId}/events` instead of bloating the main Task document toward Firestore's 1MB limit.

---

## 3. Data Model Specification

### 3.1. Extended Member Entity
```typescript
export interface Member {
  id: string;
  name: string;
  email?: string;
  photoURL?: string;
  role: 'owner' | 'member';
  type: 'human' | 'agent';
  agentConfig?: {
    provider: 'claude-code' | 'opencode' | 'codex' | 'custom';
    runtime: 'local-runner' | 'mcp-host';
    allowedRepositories: string[];
    capabilities: string[]; // e.g. ['typescript', 'vitest', 'refactor']
  };
  status?: 'idle' | 'working' | 'offline';
  lastSeenAt?: number;
}
```

### 3.2. Task Entity (Cloud Coordinating Plane)
```typescript
export interface Task {
  id: string;
  columnId: string;
  title: string;
  description: string;
  priority: 'none' | 'low' | 'medium' | 'high';
  assigneeId?: string | null; // Member ID or 'agent-pool'
  rank: number;
  revision: number;
  
  // Agent Execution State
  executionState: {
    status: 'unassigned' | 'claimed' | 'active' | 'review_ready' | 'blocked' | 'failed';
    currentRunId?: string | null;
    leaseExpiresAt?: number | null;
    attemptCount: number;
    activeBranch?: string | null;
    pullRequestUrl?: string | null;
    reviewReport?: StructuredReviewReport | null;
  };
}
```

### 3.3. Execution Run Subcollection (`/tasks/{id}/runs/{runId}`)
```typescript
export interface ExecutionRun {
  runId: string;
  taskId: string;
  agentId: string;
  attempt: number;
  status: 'claimed' | 'active' | 'submitted' | 'expired' | 'failed' | 'cancelled';
  
  // Git & Environment Provenance
  baseCommit: string;
  targetBranch: string;
  headCommit?: string | null;
  worktreePath: string;
  
  // Timestamps & Leases
  startedAt: number;
  leaseExpiresAt: number;
  completedAt?: number | null;
  
  // Budget & Termination
  limits: {
    maxDurationSeconds: number;
    maxTurns?: number;
  };
  terminationReason?: 'completed' | 'timeout' | 'error' | 'user_cancelled';
  errorMessage?: string | null;
}
```

### 3.4. Structured Review Report Schema
```typescript
export interface StructuredReviewReport {
  summary: string;
  baseCommit: string;
  headCommit: string;
  pullRequestUrl?: string;
  branchName: string;
  
  // Objective Evidence
  verification: Array<{
    command: string;      // e.g. "npm test tests/auth.test.ts"
    exitCode: number;     // 0 = pass
    durationMs: number;
    outputSnippet: string;
  }>;
  
  // Acceptance Verification
  criteriaChecklist: Array<{
    criterion: string;
    satisfied: boolean;
    explanation: string;
  }>;
  
  filesChanged: Array<{
    path: string;
    changeType: 'added' | 'modified' | 'deleted';
    insertions: number;
    deletions: number;
  }>;
  
  knownLimitations?: string[];
}
```

---

## 4. MCP Tool Interface (Phase 1)

The TaskBoard MCP Server exposes tools with strict parameter schemas and authorization controls:

| Tool Name | Parameters | Behavior |
|---|---|---|
| `taskboard_get_task` | `taskId: string` | Retrieves task details, accepted criteria, and active repository mapping. |
| `taskboard_claim_task` | `taskId: string, baseCommit: string` | Acquires transactional lease on task; provisions initial run record; transitions column to `In Progress`. |
| `taskboard_heartbeat` | `runId: string` | Renews the execution lease expiration timestamp by 90 seconds. |
| `taskboard_record_log` | `runId: string, level: 'info'\|'warn'\|'milestone', message: string` | Appends a structured log event to the run's audit stream. |
| `taskboard_ask_human_question` | `runId: string, question: string, context?: string` | Transitions task to `Blocked/Needs Input`; records the question; notifies human collaborators. |
| `taskboard_submit_for_review` | `runId: string, report: StructuredReviewReport` | Validates verification evidence; transitions task to `Ready for Review`; releases lease. |

> **Security Note:** There is intentionally **no** `taskboard_mark_done` tool exposed to agent tokens. The transition into `Done` is restricted to authorized human sessions or verified GitHub/GitLab merge webhooks.

---

## 5. Failure Mode & Edge Case Analysis

| Scenario | Risk | Mitigation Strategy |
|---|---|---|
| **Laptop sleep / Wi-Fi disconnect** | Task stays locked indefinitely. | Lease expires after 90s of missed heartbeats. Task displays an "Agent Offline" warning. Developer can resume the run or manually release the lease. |
| **Simultaneous claims on pool** | Race condition between multiple runners. | Firestore transaction with precondition: `executionState.status == 'unassigned'` and `currentRunId == null`. First transaction succeeds; subsequent claims receive atomic rollback and pick the next candidate. |
| **Human edits card during run** | Agent works on stale requirements. | Task revision number is checked at claim time and included in heartbeats. If task revision advances, the runner warns the agent or halts execution. |
| **Agent hallucinating test pass** | Broken code submitted to review. | The runner executes verification commands directly via the supervisor, capturing actual OS exit codes (`exitCode === 0`) rather than relying on agent self-assertion. |
| **Compaction / Long output bloat** | Firestore document limit (1MB) exceeded. | Execution logs stream to a subcollection (`/runs/{runId}/events`); only the finalized summary report is saved to the task record. |
| **Failed Git push** | Task claimed and modified locally, but unreviewable. | `taskboard_submit_for_review` requires a reachable remote branch or PR URL. If the push fails, the submission is rejected and the worktree is preserved for manual recovery. |

---

## 6. Implementation Milestones

### Phase 1: Explicit Single-Task Execution (MVP Scope)
- **Goal:** One repository, one supported runner CLI, explicit execution of one task, isolated worktrees, recoverable leases, bounded runtime, human review gate.
- **Deliverables:**
  1. Scoped Agent Token generation in Board Settings.
  2. Next.js API endpoints: `/api/agent/v1/claim`, `/heartbeat`, `/review-submit`.
  3. Standalone runner package (`@taskboard/runner`) managing Git worktrees and supervising Claude Code execution.
  4. Worktree recovery utility (`taskboard-runner recover <runId>`).
  5. UI updates: `Ready for Review` status badge and structured report viewer in Task modal.

### Phase 2: Resilience Verification Suite
- **Goal:** Validate recovery and concurrency before multi-agent rollout.
- **Required Automated Test Scenarios:**
  - Simulated process kill (`kill -9`) during execution and verify lease expiration.
  - Concurrent claim race test (5 runners attempting to claim 1 task simultaneously).
  - Stale agent rejection test (agent attempting to submit review after lease has been reassigned).
  - Worktree cleanup verification under both graceful exit and unhandled exception.

### Phase 3: Agent Pool & Autonomous Triage
- **Goal:** Unattended execution across multiple local and remote agent personas.
- **Deliverables:**
  1. `Agent Pool` virtual assignee with FIFO queue matching.
  2. Agent capability tags (matching task labels like `docs`, `frontend` to agent specializations).
  3. Trusted CI/CD webhook endpoint for auto-moving reviewed cards to `Done` upon merge.
