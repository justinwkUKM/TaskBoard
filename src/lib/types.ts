export type Column = { id: string; name: string };
export type Board = { id: string; name: string; description: string; ownerId: string; memberIds: string[]; columns: Column[]; revision: number; taskCount: number; deleting: boolean; updatedAt: unknown };

export interface VerificationResult {
  command: string;
  exitCode: number;
  durationMs: number;
  outputSnippet: string;
}

export interface CriteriaChecklistItem {
  criterion: string;
  satisfied: boolean;
  explanation: string;
}

export interface FileChangedItem {
  path: string;
  changeType: 'added' | 'modified' | 'deleted';
  insertions: number;
  deletions: number;
}

export interface StructuredReviewReport {
  summary: string;
  baseCommit: string;
  headCommit: string;
  pullRequestUrl?: string | null;
  branchName: string;
  verification: VerificationResult[];
  criteriaChecklist: CriteriaChecklistItem[];
  filesChanged: FileChangedItem[];
  knownLimitations?: string[];
}

export interface TaskExecutionState {
  status: 'unassigned' | 'claimed' | 'active' | 'review_ready' | 'blocked' | 'failed' | 'done';
  currentRunId?: string | null;
  leaseExpiresAt?: number | null;
  attemptCount: number;
  activeBranch?: string | null;
  pullRequestUrl?: string | null;
  reviewReport?: StructuredReviewReport | null;
  questionText?: string | null;
  questionContext?: string | null;
  questionAnswer?: string | null;
}

export type Task = {
  id: string;
  title: string;
  description: string;
  columnId: string;
  rank: number;
  priority: 'none' | 'low' | 'medium' | 'high';
  dueDate: string | null;
  assigneeId: string | null;
  createdBy: string;
  revision: number;
  executionState?: TaskExecutionState;
};

export type Member = {
  id: string;
  name: string;
  photoURL: string | null;
  role: 'owner' | 'member';
  lastSeen?: number;
  type?: 'human' | 'agent';
  agentConfig?: {
    provider: 'claude-code' | 'opencode' | 'codex' | 'custom';
    runtime: 'local-runner' | 'mcp-host';
    allowedRepositories?: string[];
    capabilities?: string[];
  };
  status?: 'idle' | 'working' | 'offline';
  lastSeenAt?: number;
};

export type Invitation = { id: string; email: string; expiresAt: number; state: string };

export interface ExecutionRun {
  runId: string;
  taskId: string;
  boardId: string;
  agentId: string;
  attempt: number;
  status: 'claimed' | 'active' | 'submitted' | 'expired' | 'failed' | 'cancelled';
  baseCommit: string;
  targetBranch: string;
  headCommit?: string | null;
  worktreePath?: string | null;
  startedAt: number;
  leaseExpiresAt: number;
  completedAt?: number | null;
  limits?: {
    maxDurationSeconds: number;
    maxTurns?: number;
  };
  terminationReason?: 'completed' | 'timeout' | 'error' | 'user_cancelled';
  errorMessage?: string | null;
}

export interface AgentToken {
  id: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  boardId: string;
  createdBy: string;
  createdAt: number;
  revokedAt?: number | null;
}

export interface AgentRunEvent {
  id: string;
  runId: string;
  taskId: string;
  timestamp: number;
  level: 'info' | 'warn' | 'milestone' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
}

export const LIMITS = { boards: 20, members: 20, columns: 20, tasks: 500, invites: 20, requestsPerMinute: 120, agentTokens: 10 };

export function isMemberActive(member: Member, now = Date.now()): boolean {
  if (member.type === 'agent') {
    const timestamp = member.lastSeenAt || member.lastSeen;
    return typeof timestamp === 'number' && (now - timestamp) < 120000;
  }
  return typeof member.lastSeen === 'number' && (now - member.lastSeen) < 80000;
}

export function isDoneColumn(column?: Column | null, index?: number, totalColumns?: number): boolean {
  if (!column) return false;
  const normName = column.name.trim().toLowerCase();
  const normId = column.id.trim().toLowerCase();
  return (
    normId === 'done' ||
    normName === 'done' ||
    normName.includes('done') ||
    normName.includes('completed') ||
    (typeof index === 'number' && typeof totalColumns === 'number' && totalColumns >= 2 && index === totalColumns - 1)
  );
}

export function isInProgressColumn(column?: Column | null, index?: number): boolean {
  if (!column) return false;
  const normName = column.name.trim().toLowerCase();
  const normId = column.id.trim().toLowerCase();
  return (
    normId === 'doing' ||
    normId === 'in_progress' ||
    normId === 'in-progress' ||
    normName.includes('progress') ||
    normName.includes('doing') ||
    normName.includes('working') ||
    (typeof index === 'number' && index === 1)
  );
}

export function isReviewColumn(column?: Column | null): boolean {
  if (!column) return false;
  const normName = column.name.trim().toLowerCase();
  const normId = column.id.trim().toLowerCase();
  return (
    normId === 'review' ||
    normId === 'in_review' ||
    normId === 'ready_for_review' ||
    normName.includes('review') ||
    normName.includes('testing') ||
    normName.includes('qa')
  );
}


