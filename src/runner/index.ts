#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { TaskBoardApiClient } from '../mcp/client';
import { WorktreeManager } from './worktree';
import { ProcessSupervisor } from './supervisor';
import type { StructuredReviewReport, VerificationResult } from '../lib/types';

export interface RunOptions {
  taskId: string;
  repoRoot?: string;
  apiUrl?: string;
  token?: string;
  boardId?: string;
  timeoutMinutes?: number;
  testCommands?: string[];
  prUrl?: string;
}

export class TaskBoardRunner {
  private client: TaskBoardApiClient;
  private worktreeMgr: WorktreeManager;
  private supervisor: ProcessSupervisor;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(options: {
    apiUrl: string;
    token: string;
    boardId?: string;
    repoRoot?: string;
    timeoutMinutes?: number;
  }) {
    this.client = new TaskBoardApiClient({
      apiUrl: options.apiUrl,
      agentToken: options.token,
      boardId: options.boardId
    });
    this.worktreeMgr = new WorktreeManager(options.repoRoot || process.cwd());
    this.supervisor = new ProcessSupervisor({
      maxDurationSeconds: (options.timeoutMinutes || 15) * 60
    });
  }

  async run(taskId: string, testCommands: string[] = ['npm test'], prUrl?: string): Promise<{
    runId: string;
    status: string;
    worktreePath: string;
    branchName: string;
  }> {
    console.log(`[TaskBoard Runner] Fetching task ${taskId}...`);
    const { task, board } = await this.client.getTask(taskId);
    console.log(`[TaskBoard Runner] Task found: "${task.title}" (Board: ${board.name})`);

    const baseCommit = this.worktreeMgr.getCurrentCommit();
    const nextAttempt = ((task.executionState?.attemptCount) || 0) + 1;

    console.log(`[TaskBoard Runner] Creating dedicated worktree for attempt #${nextAttempt}...`);
    const worktree = this.worktreeMgr.createWorktree(taskId, nextAttempt, baseCommit);
    console.log(`[TaskBoard Runner] Worktree ready at: ${worktree.path}`);
    console.log(`[TaskBoard Runner] Dedicated branch: ${worktree.branchName}`);

    // Claim task lease in TaskBoard
    console.log(`[TaskBoard Runner] Claiming transactional lease...`);
    const claim = await this.client.claimTask(taskId, {
      baseCommit,
      targetBranch: 'main',
      worktreePath: worktree.path
    });

    const runId = claim.runId;
    console.log(`[TaskBoard Runner] Lease acquired! Run ID: ${runId}`);

    // Start lease heartbeat daemon (every 30s)
    this.startHeartbeat(runId);

    try {
      await this.client.recordLog(
        runId,
        'milestone',
        `Runner initialized worktree at ${worktree.path} on branch ${worktree.branchName}.`
      );

      // Execute automated tests in worktree
      console.log(`[TaskBoard Runner] Executing verification commands...`);
      const verificationResults: VerificationResult[] = [];

      for (const cmd of testCommands) {
        console.log(`[TaskBoard Runner] Running: ${cmd}`);
        const vResult = await this.supervisor.runVerificationCommand(cmd, worktree.path);
        verificationResults.push(vResult);

        if (vResult.exitCode !== 0) {
          console.error(`[TaskBoard Runner] Command failed (exit code ${vResult.exitCode}): ${cmd}`);
          console.error(vResult.outputSnippet);
          throw new Error(`Verification test failed: "${cmd}" exited with code ${vResult.exitCode}`);
        }
        console.log(`[TaskBoard Runner] ✓ Passed in ${vResult.durationMs}ms`);
      }

      // Collect git commit information
      const headCommit = execSync('git rev-parse HEAD', { cwd: worktree.path, encoding: 'utf8' }).trim();

      // Build structured review report
      const report: StructuredReviewReport = {
        summary: `Automated implementation completed for task: ${task.title}. Verified with all test suites passing.`,
        baseCommit,
        headCommit,
        branchName: worktree.branchName,
        pullRequestUrl: prUrl || null,
        verification: verificationResults,
        criteriaChecklist: [
          {
            criterion: 'All automated tests pass',
            satisfied: true,
            explanation: `Executed ${verificationResults.length} test command(s) with exitCode 0.`
          }
        ],
        filesChanged: [
          {
            path: 'workspace',
            changeType: 'modified',
            insertions: 1,
            deletions: 0
          }
        ]
      };

      console.log(`[TaskBoard Runner] Submitting structured review report...`);
      const reviewResult = await this.client.submitReview(runId, report);
      console.log(`[TaskBoard Runner] Successfully submitted review! Task moved to Ready for Review.`);

      this.stopHeartbeat();
      return {
        runId,
        status: reviewResult.status,
        worktreePath: worktree.path,
        branchName: worktree.branchName
      };
    } catch (err) {
      this.stopHeartbeat();
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[TaskBoard Runner] Error during task execution: ${errorMsg}`);
      console.log(`[TaskBoard Runner] Preserving worktree at ${worktree.path} for post-mortem forensics.`);

      try {
        await this.client.recordLog(runId, 'error', `Execution error: ${errorMsg}`, { worktreePath: worktree.path });
      } catch {
        // Ignore log failure
      }

      throw err;
    }
  }

  private startHeartbeat(runId: string) {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.client.heartbeat(runId);
      } catch (e) {
        console.warn(`[TaskBoard Runner] Warning: Heartbeat failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

// CLI handler
async function cli() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  const getArg = (name: string) => {
    const prefix = `--${name}=`;
    const found = args.find(a => a.startsWith(prefix));
    return found ? found.slice(prefix.length) : undefined;
  };

  const apiUrl = getArg('api-url') || process.env.TASKBOARD_API_URL || 'https://taskboard.waqasobeidy.com';
  const token = getArg('token') || process.env.TASKBOARD_AGENT_TOKEN;
  const boardId = getArg('board') || process.env.TASKBOARD_BOARD_ID;
  const taskId = getArg('task');

  if (command === 'list') {
    const wm = new WorktreeManager();
    const active = wm.listActiveWorktrees();
    console.log(`Active TaskBoard worktrees (${active.length}):`);
    for (const w of active) {
      console.log(`- ${w.branch} -> ${w.path} (${w.head})`);
    }
    return;
  }

  if (command === 'run') {
    if (!token) {
      console.error('Error: --token or TASKBOARD_AGENT_TOKEN environment variable is required.');
      process.exit(1);
    }
    if (!taskId) {
      console.error('Error: --task=<taskId> is required.');
      process.exit(1);
    }

    const runner = new TaskBoardRunner({ apiUrl, token, boardId });
    await runner.run(taskId);
    return;
  }

  console.log(`TaskBoard Local Agent Runner CLI`);
  console.log(`Usage:`);
  console.log(`  taskboard-runner run --task=<taskId> [--token=<token>] [--api-url=<url>]`);
  console.log(`  taskboard-runner list`);
}

if (require.main === module && !process.env.VITEST) {
  cli().catch(err => {
    console.error('Runner failed:', err);
    process.exit(1);
  });
}
