import { execSync, spawnSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';

export interface WorktreeInfo {
  path: string;
  branchName: string;
  taskId: string;
  attempt: number;
}

export class WorktreeManager {
  private repoRoot: string;
  private baseRunsDir: string;

  constructor(repoRoot = process.cwd()) {
    this.repoRoot = path.resolve(repoRoot);
    this.baseRunsDir = path.resolve(this.repoRoot, '.taskboard-runs');
    if (!fs.existsSync(this.baseRunsDir)) {
      fs.mkdirSync(this.baseRunsDir, { recursive: true });
    }
  }

  getCurrentCommit(): string {
    try {
      return execSync('git rev-parse HEAD', { cwd: this.repoRoot, encoding: 'utf8' }).trim();
    } catch (err) {
      throw new Error(`Failed to resolve git HEAD commit: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  createWorktree(taskId: string, attempt: number, baseCommit?: string): WorktreeInfo {
    const commit = baseCommit || this.getCurrentCommit();
    const branchName = `agent/${taskId}/attempt-${attempt}`;
    const worktreePath = path.resolve(this.baseRunsDir, `${taskId}-${attempt}`);

    // If worktree already exists, remove it first
    if (fs.existsSync(worktreePath)) {
      this.removeWorktree(worktreePath, branchName, true);
    }

    // Check if branch already exists locally; delete if stale
    const branchExists = spawnSync('git', ['rev-parse', '--verify', branchName], { cwd: this.repoRoot }).status === 0;
    if (branchExists) {
      spawnSync('git', ['branch', '-D', branchName], { cwd: this.repoRoot });
    }

    // Create worktree
    const addResult = spawnSync(
      'git',
      ['worktree', 'add', worktreePath, '-b', branchName, commit],
      { cwd: this.repoRoot, encoding: 'utf8' }
    );

    if (addResult.status !== 0) {
      throw new Error(`Failed to create git worktree at ${worktreePath}: ${addResult.stderr || addResult.stdout}`);
    }

    return {
      path: worktreePath,
      branchName,
      taskId,
      attempt
    };
  }

  removeWorktree(worktreePath: string, branchName?: string, force = false): void {
    const args = ['worktree', 'remove'];
    if (force) args.push('--force');
    args.push(worktreePath);

    spawnSync('git', args, { cwd: this.repoRoot });

    // Ensure directory is cleaned up
    if (fs.existsSync(worktreePath)) {
      try {
        fs.rmSync(worktreePath, { recursive: true, force: true });
      } catch {
        // Ignore fallback cleanup errors
      }
    }

    // Prune stale worktrees
    spawnSync('git', ['worktree', 'prune'], { cwd: this.repoRoot });

    if (branchName) {
      spawnSync('git', ['branch', '-D', branchName], { cwd: this.repoRoot });
    }
  }

  listActiveWorktrees(): Array<{ path: string; head: string; branch: string }> {
    try {
      const output = execSync('git worktree list --porcelain', { cwd: this.repoRoot, encoding: 'utf8' });
      const entries: Array<{ path: string; head: string; branch: string }> = [];
      let current: { path?: string; head?: string; branch?: string } = {};

      for (const line of output.split('\n')) {
        if (line.startsWith('worktree ')) {
          if (current.path) entries.push(current as { path: string; head: string; branch: string });
          current = { path: line.slice(9).trim() };
        } else if (line.startsWith('HEAD ')) {
          current.head = line.slice(5).trim();
        } else if (line.startsWith('branch ')) {
          current.branch = line.slice(7).trim();
        }
      }
      if (current.path) entries.push(current as { path: string; head: string; branch: string });
      return entries.filter(e => e.path.includes('.taskboard-runs'));
    } catch {
      return [];
    }
  }
}
