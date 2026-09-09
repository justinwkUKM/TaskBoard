# TaskBoard AI Agent Collaboration (MCP Architecture)

**Status:** Planned Roadmap Architecture  
**Execution Model:** Local-First via Model Context Protocol (MCP)  
**Target Agents:** Claude Code, OpenCode, Codex, Cursor, and any MCP-compliant coding assistant  

---

## 1. Executive Summary & Vision

Traditional issue trackers and Kanban boards are built exclusively for humans to manually read, discuss, and update task statuses. As autonomous coding agents become proficient team members, this separation creates friction: developers end up reading tasks from a web board, copying prompts into terminal CLIs, and manually updating tickets when code is done.

**TaskBoard AI Agent Collaboration** transforms TaskBoard into a shared canvas where humans and AI coding agents work side by side as first-class teammates on the same Kanban board.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TaskBoard Cloud Service                         │
│                                                                        │
│   [To do / Agent Pool] ──────► [In Progress] ──────► [Done (Struck)]   │
│             ▲                         ▲                     ▲          │
└─────────────┼─────────────────────────┼─────────────────────┼──────────┘
              │ (1) Claim Task          │ (2) Progress Logs   │ (3) Completion Report
              ▼                         ▼                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Developer's Local Machine                          │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                 TaskBoard MCP Server Layer                     │   │
│   │   Exposes tools: claim_task, get_context, post_report, etc.    │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ MCP Protocol                       │
│                                   ▼                                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │            Coding Agent (Claude Code / OpenCode)               │   │
│   │   - Inspects local git repo, dependencies, environment         │   │
│   │   - Implements code, executes unit tests, fixes regressions    │   │
│   │   - Verifies acceptance criteria autonomously                  │   │
│   │   - Generates comprehensive markdown report and strikes card   │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Principles

### A. Local Execution
- The coding agent runs **locally** on the developer's workstation inside their existing repository directory.
- **Benefits:**
  - Zero cloud VM/container infrastructure costs.
  - Access to local git branches, uncommitted files, private packages, and `.env.local` variables.
  - Complete data privacy: code stays on the developer's computer.

### B. Standardized MCP (Model Context Protocol) Integration
- Rather than maintaining proprietary plugins for dozens of AI tools, TaskBoard exposes an official **Model Context Protocol (MCP)** server interface.
- Any MCP-compliant tool (e.g., Claude Code, Claude Desktop, Cursor) connects instantly by adding TaskBoard to its MCP configuration.

### C. Dual-Assignment Model (Direct Assignment or Agent Pool)
1. **Direct Assignment:** A human assigns a card directly to a specific specialist agent (e.g., `Claude Code (Local)` or `Frontend Bot`).
2. **Agent Pool (FIFO):** Tasks can be assigned to the generic `Agent Pool` or dropped into a designated automation column. Any connected, idle local agent claims available tasks on a first-come, first-served basis with atomic locking.

### D. Autonomous Acceptance & Detailed Completion Reports
- **No strict human gate required:** The agent independently verifies the requirements described in the task (or infers them from context and local test suites).
- **Mandatory Completion Report:** Before moving a task to **Done**, the agent must generate and attach a structured, transparent report documenting:
  - Summary of architecture decisions.
  - List of created and modified files with line counts.
  - Test suites executed and pass/fail outputs.
  - Git branch and commit references.

---

## 3. The TaskBoard MCP Toolset

The TaskBoard MCP server exposes the following standardized tools to the local coding assistant:

```json
[
  {
    "name": "taskboard_get_assigned_tasks",
    "description": "Lists all tasks on the board that are assigned to this agent or are currently unassigned in the Agent Pool.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "boardId": { "type": "string", "description": "Optional board ID filter" },
        "includePool": { "type": "boolean", "default": true }
      }
    }
  },
  {
    "name": "taskboard_claim_task",
    "description": "Atomically claims a task, locks it to this agent ID, and moves it to the 'In Progress' column.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "taskId": { "type": "string" },
        "initialPlan": { "type": "string", "description": "Brief summary of how the agent plans to tackle the task" }
      },
      "required": ["taskId"]
    }
  },
  {
    "name": "taskboard_post_task_update",
    "description": "Appends an execution log or status message to the task card's live activity stream.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "taskId": { "type": "string" },
        "message": { "type": "string" },
        "level": { "type": "string", "enum": ["info", "warning", "milestone"] }
      },
      "required": ["taskId", "message"]
    }
  },
  {
    "name": "taskboard_ask_human_question",
    "description": "Moves the task to 'Needs Input' and posts a blocking question to the human collaborator.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "taskId": { "type": "string" },
        "question": { "type": "string" }
      },
      "required": ["taskId", "question"]
    }
  },
  {
    "name": "taskboard_complete_task",
    "description": "Submits the final completion report, strikes off the task, and moves it into the 'Done' column.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "taskId": { "type": "string" },
        "completionReport": {
          "type": "string",
          "description": "Detailed markdown report detailing changes made, files touched, test outputs, and git commit."
        },
        "branchName": { "type": "string" }
      },
      "required": ["taskId", "completionReport"]
    }
  }
]
```

---

## 4. End-to-End Workflow Walkthrough

### 1. Developer Setup
1. On TaskBoard Web, navigate to **Board Settings** → **Integrations & MCP**.
2. Click **Add Agent Teammate** → select agent persona (e.g. `Claude Code`).
3. Copy the generated MCP connection snippet:
   ```json
   {
     "mcpServers": {
       "taskboard": {
         "command": "npx",
         "args": ["-y", "@taskboard/mcp-server"],
         "env": {
           "TASKBOARD_API_KEY": "tb_live_sec_...",
           "TASKBOARD_BOARD_ID": "board_abc123"
         }
       }
     }
   }
   ```
4. Paste into `~/.claude.json` or project MCP config.

### 2. Task Intake & Atomic Lock
- The human drops a task into **To do** assigned to `Agent Pool`:
  - **Title:** `Add rate limiting to /api/auth/login endpoint`
  - **Description:** `5 attempts per 15 minutes per IP. Use in-memory Redis or Map fallback. Return 429 with Retry-After.`
- In terminal, the developer runs:
  ```bash
  claude "Check TaskBoard for tasks in the pool and implement the next available task."
  ```
- Claude calls `taskboard_get_assigned_tasks()`.
- Claude calls `taskboard_claim_task("task_123", "Creating rate-limiter middleware with unit tests")`.
- TaskBoard immediately moves the card to **In progress** in real-time across all connected human browser sessions.

### 3. Local Execution & Self-Verification
- Claude analyzes repository code, installs needed packages, and writes code.
- Claude runs the local test suite (`npm test`).
- If tests fail, Claude iterates locally until 100% green.
- Claude verifies all items in the task description:
  - 5 attempts per 15 min verified.
  - HTTP 429 status and header verified.
  - Unit tests created and passing.

### 4. Completion Report & Done Celebration
- Claude invokes `taskboard_complete_task()` with a structured completion report:
  ```markdown
  ### 🤖 Task Completed: Rate Limiting on Login

  #### Changes Made
  - Added sliding-window rate limit middleware in `src/middleware/rate-limit.ts`.
  - Bound `/api/auth/login` to the limiter.
  - Added unit test suite covering rate exhaustion and reset.

  #### Verification Results
  - Ran `npm test tests/rate-limit.test.ts` (4 passed, 0 failed).
  - Validated 429 response structure and `Retry-After` headers.

  #### Git Metadata
  - Branch: `agent/rate-limit-login`
  - Commit: `d4e5f6a`
  ```
- TaskBoard updates:
  - The task card moves to **Done**.
  - The title strikes off with the signature lime line (`line-through`).
  - Green `CheckCheck` badge pops into view.
  - The Done column pulses with celebration.

---

## 5. Data Schema Extensions

```typescript
export interface Member {
  id: string;
  name: string;
  email?: string;
  photoURL?: string;
  role: 'owner' | 'member';
  // Agent additions:
  type: 'human' | 'agent';
  agentProvider?: 'claude-code' | 'opencode' | 'codex' | 'custom';
  status?: 'idle' | 'working' | 'blocked' | 'offline';
  lastHeartbeat?: number;
}

export interface Task {
  id: string;
  columnId: string;
  title: string;
  description: string;
  priority: 'none' | 'low' | 'medium' | 'high';
  assigneeId?: string | null; // Human ID, Agent ID, or 'agent-pool'
  rank: number;
  revision: number;
  // Agent additions:
  claimedBy?: string | null; // Agent member ID actively running the task
  completionReport?: string; // Markdown summary generated upon completion
  executionLogs?: Array<{
    timestamp: number;
    message: string;
    level: 'info' | 'warning' | 'milestone';
  }>;
}

export interface AgentApiKey {
  id: string;
  boardId: string;
  keyHash: string;
  label: string;
  createdBy: string;
  createdAt: number;
  lastUsedAt?: number;
  revoked: boolean;
}
```

---

## 6. Phased Implementation Roadmap

1. **Phase 1: Agent Identity & API Authentication**
   - Support `Member.type = 'agent'`.
   - Add Board Settings UI to generate and revoke Agent API keys.
2. **Phase 2: TaskBoard MCP Server Package (`@taskboard/mcp-server`)**
   - Publish lightweight Node.js MCP server implementing the Model Context Protocol over stdio / HTTP SSE.
   - Support `claim_task`, `list_tasks`, `post_update`, and `complete_task`.
3. **Phase 3: Task Card Report & Activity Log UI**
   - Expandable "Agent Report" tab inside `TaskEditor` modal displaying the formatted markdown changelog and execution history.
   - Status indicators on cards when an agent is actively computing.
4. **Phase 4: Agent Pool Auto-Triage**
   - Dedicated "Agent Pool" assignee option in task creation dialog.
   - Optimistic concurrency control ensuring zero duplicate task claims across multiple concurrent local agents.
