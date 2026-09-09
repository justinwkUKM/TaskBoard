import type { StructuredReviewReport, Task, Board } from '../lib/types';

export interface TaskBoardClientConfig {
  apiUrl: string;
  agentToken: string;
  boardId?: string;
}

export class TaskBoardApiClient {
  private apiUrl: string;
  private agentToken: string;
  private boardId?: string;

  constructor(config: TaskBoardClientConfig) {
    this.apiUrl = config.apiUrl.replace(/\/+$/, '');
    this.agentToken = config.agentToken.trim();
    this.boardId = config.boardId;
  }

  private async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const url = `${this.apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.agentToken}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`TaskBoard API returned non-JSON response (${response.status}): ${text.slice(0, 200)}`);
    }

    if (!response.ok) {
      const errorMsg = typeof data === 'object' && data && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data as T;
  }

  async getTasks(): Promise<{ tasks: Task[]; board: { id: string; name: string; columns: Board['columns'] } }> {
    const query = this.boardId ? `?boardId=${encodeURIComponent(this.boardId)}` : '';
    return this.request<{ tasks: Task[]; board: { id: string; name: string; columns: Board['columns'] } }>(`/api/agent/v1/tasks${query}`);
  }

  async getTask(taskId: string): Promise<{ task: Task; board: { id: string; name: string; columns: Board['columns'] } }> {
    const query = this.boardId ? `?boardId=${encodeURIComponent(this.boardId)}` : '';
    return this.request<{ task: Task; board: { id: string; name: string; columns: Board['columns'] } }>(`/api/agent/v1/tasks/${encodeURIComponent(taskId)}${query}`);
  }

  async claimTask(taskId: string, input: { baseCommit: string; targetBranch?: string; worktreePath?: string; limits?: { maxDurationSeconds?: number; maxTurns?: number } }): Promise<{
    runId: string;
    taskId: string;
    boardId: string;
    attempt: number;
    branchName: string;
    baseCommit: string;
    targetBranch: string;
    leaseExpiresAt: number;
  }> {
    return this.request(`/api/agent/v1/tasks/${encodeURIComponent(taskId)}/claim`, 'POST', input);
  }

  async heartbeat(runId: string, revision?: number): Promise<{ ok: boolean; runId: string; leaseExpiresAt: number }> {
    return this.request(`/api/agent/v1/runs/${encodeURIComponent(runId)}/heartbeat`, 'POST', { revision });
  }

  async recordLog(runId: string, level: 'info' | 'warn' | 'milestone' | 'error', message: string, metadata?: Record<string, unknown>): Promise<{ ok: boolean; eventId?: string }> {
    return this.request(`/api/agent/v1/runs/${encodeURIComponent(runId)}/log`, 'POST', { level, message, metadata });
  }

  async askHumanQuestion(runId: string, question: string, context?: string): Promise<{ ok: boolean; status: string; question: string }> {
    return this.request(`/api/agent/v1/runs/${encodeURIComponent(runId)}/question`, 'POST', { question, context });
  }

  async submitReview(runId: string, report: StructuredReviewReport): Promise<{ ok: boolean; status: string; taskId: string; columnId: string; pullRequestUrl?: string | null }> {
    return this.request(`/api/agent/v1/runs/${encodeURIComponent(runId)}/submit-review`, 'POST', report);
  }
}
